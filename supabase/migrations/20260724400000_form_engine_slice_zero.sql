-- ============================================================================
-- FORM ENGINE — Slice Zero, Migration 1 ("full schema on day one")
-- ============================================================================
-- Implements docs/slice-zero-schema-design.md as merged (PR #76, incl. the
-- founder-review section), plus two founder-directed additions from the
-- implementation order (2026-07-24):
--   (1) complete_form_instance rejects outcome 'complete' submitted together
--       with a non-empty deficiency list (contradictory by construction),
--       raising a distinguishable 'outcome_deficiency_conflict' error.
--   (2) is a PDF-renderer behavior (photo retention priority) — design-doc
--       change only, no SQL here.
--
-- Touches NOTHING in job_stage_templates, job_checklist_completions, or the
-- job_status enum (design constraint 7). Contact with the existing system is
-- three nullable SET NULL FKs (scheduled_jobs / equipment_registry / clients).
--
-- Everything here must replay clean from zero under db-replay.yml — that gate
-- is the acceptance condition for this migration.
-- ============================================================================


-- ─── Enums (design §1.1) ────────────────────────────────────────────────────

-- Outcome is a FIXED enum (founder constraint). Trade-neutral wording on
-- purpose — 'complete', not 'commissioned' (design Step 7).
CREATE TYPE public.form_outcome AS ENUM (
  'complete',                     -- done, nothing owed
  'complete_with_deficiencies',   -- done, deficiency rows raised
  'incomplete',                   -- stopped; blocker/responsible_party say why
  'failed'                        -- work attempted, unit failed
);

-- Blocker is a SMALL fixed enum. It answers "what kind of thing is in the
-- way"; responsible_party (free text, suggestion-first UI) answers "who".
CREATE TYPE public.form_blocker AS ENUM (
  'none', 'other_trade', 'parts', 'access', 'customer', 'weather'
);


-- ─── tenant_settings.fault_categories (design §1.1) ─────────────────────────

-- Tenant-configurable list following the job_types pattern on the same table.
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS fault_categories JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tenant_settings.fault_categories IS
  'Form-engine fault categories (tenant-editable list, like job_types). Free-text values referenced by form_instances.fault_category; renames strand history — accepted, same as job_types (design Step 9).';


-- ─── form_templates (design §1.2) ───────────────────────────────────────────

CREATE TABLE public.form_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_key   text NOT NULL,        -- seed identity ('hvac-commissioning-v1')
  name         text NOT NULL,
  description  text,
  version      int  NOT NULL DEFAULT 1,   -- bumped by the seed script per published change
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','published','archived')),
  definition   jsonb NOT NULL,       -- the FormDefinition tree; current version only
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_key)     -- idempotent re-seeding
);

COMMENT ON TABLE public.form_templates IS
  'Form-engine authored templates. One jsonb definition tree per template (design constraint 2); versioned JSON seeds in git are the authoring surface in Slice Zero — no builder UI. Templates are archived, never hard-deleted (instances FK here for lineage).';


-- ─── form_instances (design §1.3) ───────────────────────────────────────────

CREATE TABLE public.form_instances (
  -- Client-GENERATED uuid when created offline; DEFAULT covers online creates.
  -- Client generation is what makes offline creation + idempotent sync work.
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id),
  template_id         uuid NOT NULL REFERENCES public.form_templates(id),
  template_version    int  NOT NULL,
  definition_snapshot jsonb NOT NULL,        -- full copy at creation (snapshot Option A, design §1.7)
  answers             jsonb NOT NULL DEFAULT '{}',
  status              text NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','completed','void')),

  -- Four-way status split. outcome FREEZES at completion (founder review
  -- item 2 — it prints on the customer PDF); the other three stay
  -- staff-editable post-completion, every edit revision-logged.
  outcome             public.form_outcome,   -- null until completed; immutable after
  fault_category      text,
  responsible_party   text,
  blocker             public.form_blocker NOT NULL DEFAULT 'none',

  -- Bindings — ALL optional (design constraint 5). SET NULL, never CASCADE:
  -- a commissioning record outlives the job row it was created under.
  job_id              uuid REFERENCES public.scheduled_jobs(id)     ON DELETE SET NULL,
  equipment_id        uuid REFERENCES public.equipment_registry(id) ON DELETE SET NULL,
  client_id           uuid REFERENCES public.clients(id)            ON DELETE SET NULL,

  -- Identity & audit
  document_number     text,                  -- server-issued at completion; never client-minted
  serial_numbers      text[] NOT NULL DEFAULT '{}',  -- extracted from role-tagged answers
  labor_hours         numeric,               -- review item 1: sum of visible role:'labor_hours'
                                             -- answers at completion (serial_numbers pattern)
  superseded_by       uuid REFERENCES public.form_instances(id),   -- void/amend breadcrumb
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);

COMMENT ON TABLE public.form_instances IS
  'One row per filled form. Self-contained: definition_snapshot is a full copy at creation, so renderer/validator/PDF/portal read one row and a mid-fill template edit can never corrupt it. Completed instances freeze via trigger; corrections = void + reissue (superseded_by).';
COMMENT ON COLUMN public.form_instances.answers IS
  'Flat NodeId → AnswerValue map; repeat groups/tables are arrays of row objects keyed by a stable _row uuid. Named answers, not values — VALUES is an SQL keyword. Hidden-subtree answers are retained here but excluded from validation/PDF/extraction by the shared visibility pass (design Step 3).';


-- ─── form_deficiencies (design §1.4) ────────────────────────────────────────

CREATE TABLE public.form_deficiencies (
  id              uuid PRIMARY KEY,           -- client-generated (offline completion); RPC-supplied
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id),
  instance_id     uuid NOT NULL REFERENCES public.form_instances(id) ON DELETE CASCADE,
  node_id         text NOT NULL,              -- which question raised it
  row_id          text,                       -- repeat-row provenance ('_row' uuid), null otherwise
  clause          text,                       -- denormalized clause label at raise time ("2.03(b)")
  description     text NOT NULL,              -- question label + failing answer + optional tech note
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  raised_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  resolution_note text,
  job_id          uuid,                       -- denormalized, no FK (survives job deletion)
  equipment_id    uuid REFERENCES public.equipment_registry(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.form_deficiencies IS
  'Deficiency lifecycle rows (raised → resolved), born ONLY inside complete_form_instance (no client INSERT policy). Outlive the raising instance''s fill; resolution is a manual staff action in Slice Zero.';


-- ─── form_number_counters (design §1.4) ─────────────────────────────────────

CREATE TABLE public.form_number_counters (
  tenant_id  uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- 'FT' is the FALLBACK only (founder ruling): forms:seed upserts this row
  -- with a prefix derived from the tenant name (North Shore HVAC → 'NSH');
  -- the RPC's lazy insert keeps FT for tenants never seeded.
  prefix     text  NOT NULL DEFAULT 'FT',
  next_value bigint NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.form_number_counters IS
  'Per-tenant document-number sequence. RLS enabled with ZERO policies: default-deny for every client role — only the SECURITY DEFINER completion RPC touches it.';


-- ─── form_instance_revisions (design §1.4b, founder review item 3) ──────────

CREATE TABLE public.form_instance_revisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id  uuid NOT NULL REFERENCES public.form_instances(id) ON DELETE CASCADE,
  -- Design doc says NOT NULL; relaxed to nullable here (documented deviation):
  -- auth.uid() is NULL for service-role/system edits, and refusing to audit
  -- those would be worse than recording an anonymous system actor.
  changed_by   uuid,                          -- auth.uid(); NULL = service-role/system actor
  changed_at   timestamptz NOT NULL DEFAULT now(),
  changes      jsonb NOT NULL                 -- { column: { "old": …, "new": … } } per changed column
);

COMMENT ON TABLE public.form_instance_revisions IS
  'Trigger-written audit of every post-completion edit to a form instance''s still-editable columns. Append-only from every client''s point of view (zero write policies; the SECURITY DEFINER trigger is the only writer). "Who re-categorized this fault and when" is a query, not a shrug.';


-- ─── Indexes (design §1.9) ──────────────────────────────────────────────────

CREATE UNIQUE INDEX form_instances_doc_number_uniq
  ON public.form_instances (tenant_id, document_number) WHERE document_number IS NOT NULL;
CREATE INDEX form_instances_tenant_created  ON public.form_instances (tenant_id, created_at DESC);
CREATE INDEX form_instances_job             ON public.form_instances (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX form_instances_equip_time      ON public.form_instances (tenant_id, equipment_id, created_at)
                                            WHERE equipment_id IS NOT NULL;      -- Q1, Q3
CREATE INDEX form_instances_template_time   ON public.form_instances (tenant_id, template_id, created_at); -- Q2
CREATE INDEX form_instances_serials         ON public.form_instances USING gin (serial_numbers);           -- Q4
CREATE INDEX form_instances_blocked         ON public.form_instances (tenant_id, blocker)
                                            WHERE blocker <> 'none';             -- Q1 / blocked dashboard
CREATE INDEX form_instances_resp_party      ON public.form_instances (tenant_id, responsible_party)
                                            WHERE responsible_party IS NOT NULL; -- suggestions dropdown
CREATE INDEX form_deficiencies_open         ON public.form_deficiencies (tenant_id, status, raised_at);    -- Q5
CREATE INDEX form_deficiencies_instance     ON public.form_deficiencies (instance_id);
CREATE INDEX form_templates_tenant_status   ON public.form_templates (tenant_id, status);
CREATE INDEX form_instance_revisions_inst   ON public.form_instance_revisions (instance_id, changed_at);   -- audit view


-- ─── Immutability trigger (design §1.8, review item 2) ──────────────────────

-- WHAT may change per state. WHO may write is the RLS policies' job below;
-- policies cannot compare OLD/NEW, so column-level freezing lives here.
CREATE OR REPLACE FUNCTION public.form_instance_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Identity columns never change after INSERT, in any state. definition
  -- snapshot and template lineage are the record's provenance; created_* and
  -- tenant_id are its identity.
  IF NEW.tenant_id           IS DISTINCT FROM OLD.tenant_id
     OR NEW.template_id      IS DISTINCT FROM OLD.template_id
     OR NEW.template_version IS DISTINCT FROM OLD.template_version
     OR NEW.definition_snapshot IS DISTINCT FROM OLD.definition_snapshot
     OR NEW.created_by       IS DISTINCT FROM OLD.created_by
     OR NEW.created_at       IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'form_instance_frozen: identity columns (tenant, template, snapshot, creator) are immutable';
  END IF;

  -- Void is terminal: nothing on a void row may change.
  IF OLD.status = 'void' THEN
    RAISE EXCEPTION 'form_instance_frozen: void instances are immutable';
  END IF;

  IF OLD.status = 'completed' THEN
    -- The issued record: answers, number, outcome, extraction, timestamps.
    IF NEW.answers            IS DISTINCT FROM OLD.answers
       OR NEW.document_number IS DISTINCT FROM OLD.document_number
       OR NEW.completed_at    IS DISTINCT FROM OLD.completed_at
       OR NEW.serial_numbers  IS DISTINCT FROM OLD.serial_numbers
       OR NEW.labor_hours     IS DISTINCT FROM OLD.labor_hours
       OR NEW.outcome         IS DISTINCT FROM OLD.outcome THEN
      RAISE EXCEPTION 'form_instance_frozen: completed instances are immutable (answers, document number, outcome, extracted values). Corrections = void + reissue.';
    END IF;

    -- Only transition out: completed → void, tenant-admin (or service role) only.
    IF NEW.status = 'void' THEN
      IF NOT (public.is_tenant_admin() OR auth.role() = 'service_role') THEN
        RAISE EXCEPTION 'form_instance_frozen: only a tenant admin may void a completed instance';
      END IF;
    ELSIF NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'form_instance_frozen: invalid status transition from completed to %', NEW.status;
    END IF;
    -- Still-editable on completed rows: fault_category, responsible_party,
    -- blocker, bindings, superseded_by, updated_at — audited by the companion
    -- revision trigger below; restricted to staff by the UPDATE policy.
    RETURN NEW;
  END IF;

  -- OLD.status = 'in_progress' from here.
  -- The ONLY road to 'completed' is complete_form_instance: the RPC marks the
  -- transaction with a local setting the trigger checks. A direct client
  -- UPDATE to status='completed' would mint a frozen, numberless record and
  -- bypass number issuance — rejected. (set_config is not reachable through
  -- PostgREST, so clients cannot forge the marker.)
  IF NEW.status = 'completed' THEN
    IF current_setting('app.form_engine_completing', true) IS DISTINCT FROM OLD.id::text THEN
      RAISE EXCEPTION 'form_instance_frozen: completion must go through complete_form_instance()';
    END IF;
  ELSIF NEW.status = 'void' THEN
    -- in_progress → void: allowed (creator may void own draft — founder
    -- ruling 2; WHO is enforced by the UPDATE policy).
    NULL;
  END IF;

  -- Document numbers exist only on completed instances and only via the RPC.
  IF NEW.document_number IS DISTINCT FROM OLD.document_number
     AND NEW.status <> 'completed' THEN
    RAISE EXCEPTION 'form_instance_frozen: document_number is server-issued at completion only';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_form_instance_immutability
  BEFORE UPDATE ON public.form_instances
  FOR EACH ROW EXECUTE FUNCTION public.form_instance_enforce_immutability();

-- Deletes are policy-denied for every client role (explicit deny below), so no
-- BEFORE DELETE trigger is needed; service-role deletion remains possible for
-- founder-operated cleanup, same posture as workflow_step_evidence (C5).


-- ─── Revision-audit trigger (design §1.4b, review items 2b/2c) ──────────────

CREATE OR REPLACE FUNCTION public.form_instance_record_revision()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF NEW.fault_category IS DISTINCT FROM OLD.fault_category THEN
    v_changes := v_changes || jsonb_build_object('fault_category',
      jsonb_build_object('old', to_jsonb(OLD.fault_category), 'new', to_jsonb(NEW.fault_category)));
  END IF;
  IF NEW.responsible_party IS DISTINCT FROM OLD.responsible_party THEN
    v_changes := v_changes || jsonb_build_object('responsible_party',
      jsonb_build_object('old', to_jsonb(OLD.responsible_party), 'new', to_jsonb(NEW.responsible_party)));
  END IF;
  IF NEW.blocker IS DISTINCT FROM OLD.blocker THEN
    v_changes := v_changes || jsonb_build_object('blocker',
      jsonb_build_object('old', to_jsonb(OLD.blocker), 'new', to_jsonb(NEW.blocker)));
  END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id THEN
    v_changes := v_changes || jsonb_build_object('job_id',
      jsonb_build_object('old', to_jsonb(OLD.job_id), 'new', to_jsonb(NEW.job_id)));
  END IF;
  IF NEW.equipment_id IS DISTINCT FROM OLD.equipment_id THEN
    v_changes := v_changes || jsonb_build_object('equipment_id',
      jsonb_build_object('old', to_jsonb(OLD.equipment_id), 'new', to_jsonb(NEW.equipment_id)));
  END IF;
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    v_changes := v_changes || jsonb_build_object('client_id',
      jsonb_build_object('old', to_jsonb(OLD.client_id), 'new', to_jsonb(NEW.client_id)));
  END IF;
  IF NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
    v_changes := v_changes || jsonb_build_object('superseded_by',
      jsonb_build_object('old', to_jsonb(OLD.superseded_by), 'new', to_jsonb(NEW.superseded_by)));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changes := v_changes || jsonb_build_object('status',
      jsonb_build_object('old', to_jsonb(OLD.status), 'new', to_jsonb(NEW.status)));
  END IF;

  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO public.form_instance_revisions (tenant_id, instance_id, changed_by, changes)
    VALUES (OLD.tenant_id, OLD.id, auth.uid(), v_changes);
  END IF;
  RETURN NULL;
END $$;

-- Fires only for edits to already-issued records (OLD completed). In-progress
-- autosave is deliberately NOT revision-logged — accountability attaches to
-- the issued record, not to every draft keystroke (design §1.4b).
CREATE TRIGGER trg_form_instance_revision
  AFTER UPDATE ON public.form_instances
  FOR EACH ROW WHEN (OLD.status = 'completed')
  EXECUTE FUNCTION public.form_instance_record_revision();


-- ─── complete_form_instance (design §1.8 + founder addition 1) ──────────────

CREATE OR REPLACE FUNCTION public.complete_form_instance(
  p_instance_id       uuid,
  p_answers           jsonb,
  p_outcome           public.form_outcome,
  p_fault_category    text,
  p_responsible_party text,
  p_blocker           public.form_blocker,
  p_serial_numbers    text[],
  p_labor_hours       numeric,
  p_deficiencies      jsonb      -- [{id, node_id, row_id, clause, description}]
) RETURNS TABLE (document_number text, completed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_instance form_instances%ROWTYPE;
  v_prefix text; v_seq bigint; v_doc text;
BEGIN
  SELECT * INTO v_instance FROM form_instances WHERE id = p_instance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;

  -- Authorization inside the definer (counters have no client policies):
  -- caller must be the creator, or tenant staff (admin/dispatcher) of the
  -- instance's tenant. Anonymous callers fail both arms (auth.uid() is NULL).
  IF NOT (v_instance.created_by = auth.uid()
          OR (public.get_user_tenant_id() = v_instance.tenant_id
              AND (public.is_tenant_admin() OR public.get_user_role() = 'dispatcher'))) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- IDEMPOTENT: offline replay retries safely. Already completed → return the
  -- existing number, write nothing. (Runs BEFORE the contradiction guard so a
  -- replay of a legitimately-completed instance can never start erroring.)
  IF v_instance.status = 'completed' THEN
    RETURN QUERY SELECT v_instance.document_number, v_instance.completed_at;
    RETURN;
  END IF;
  IF v_instance.status = 'void' THEN RAISE EXCEPTION 'instance is void'; END IF;

  -- Founder addition 1 (2026-07-24): outcome 'complete' with deficiencies is
  -- contradictory by construction — and outcome freezes at completion, so
  -- letting it through would make the mistake fixable only by void + refill.
  -- Distinguishable token first in the message; clients map on it.
  IF p_outcome = 'complete'
     AND jsonb_array_length(coalesce(p_deficiencies, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'outcome_deficiency_conflict: outcome ''complete'' cannot be submitted with % open deficiencie(s) — use ''complete_with_deficiencies''',
      jsonb_array_length(p_deficiencies)
      USING HINT = 'outcome_deficiency_conflict';
  END IF;

  -- Atomic per-tenant sequence: upsert-increment under row lock serializes
  -- concurrent completions; numbers are unique and dense per tenant.
  INSERT INTO form_number_counters (tenant_id) VALUES (v_instance.tenant_id)
  ON CONFLICT (tenant_id) DO UPDATE SET next_value = form_number_counters.next_value + 1
  RETURNING form_number_counters.prefix, form_number_counters.next_value INTO v_prefix, v_seq;
  v_doc := v_prefix || '-' || lpad(v_seq::text, 5, '0');

  -- Transaction-local marker the immutability trigger requires for the
  -- in_progress → completed transition (clients cannot reach set_config
  -- through PostgREST, so this path cannot be forged).
  PERFORM set_config('app.form_engine_completing', v_instance.id::text, true);

  UPDATE form_instances SET
    answers = p_answers, status = 'completed', outcome = p_outcome,
    fault_category = p_fault_category, responsible_party = p_responsible_party,
    blocker = p_blocker, serial_numbers = coalesce(p_serial_numbers, '{}'),
    labor_hours = p_labor_hours,
    document_number = v_doc, completed_at = now(), updated_at = now()
  WHERE id = p_instance_id;

  PERFORM set_config('app.form_engine_completing', '', true);

  -- Deficiency rows: ids are client-generated → ON CONFLICT DO NOTHING makes
  -- replay idempotent here too.
  INSERT INTO form_deficiencies (id, tenant_id, instance_id, node_id, row_id, clause,
                                 description, job_id, equipment_id)
  SELECT (d->>'id')::uuid, v_instance.tenant_id, p_instance_id,
         d->>'node_id', d->>'row_id', d->>'clause', d->>'description',
         v_instance.job_id, v_instance.equipment_id
  FROM jsonb_array_elements(coalesce(p_deficiencies, '[]'::jsonb)) d
  ON CONFLICT (id) DO NOTHING;

  RETURN QUERY SELECT v_doc, now()::timestamptz;
END $$;


-- ─── RLS (design Step 2) ────────────────────────────────────────────────────

ALTER TABLE public.form_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_instances          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_deficiencies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_number_counters    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_instance_revisions ENABLE ROW LEVEL SECURITY;

-- form_templates ------------------------------------------------------------

-- SELECT: all tenant members read PUBLISHED templates (techs must render
-- them); drafts/archived are admin-only. Invented, composed from standard
-- helpers (design Step 2).
CREATE POLICY "Members read published templates" ON public.form_templates
FOR SELECT USING (
  tenant_id = get_user_tenant_id()
  AND (status = 'published' OR is_tenant_admin())
);

-- Writes: admin-only. Copied from the "Admins can manage" shape on
-- workflow_step_evidence (20260420000000).
CREATE POLICY "Admins manage templates" ON public.form_templates
FOR ALL USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
WITH CHECK  (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- form_instances ------------------------------------------------------------

-- SELECT staff arm: copied from "Role-based job visibility" (20260203061900),
-- extended with an assigned-job arm (a second tech sent to an assigned job
-- must be able to open the form the first tech started).
CREATE POLICY "Role-based instance visibility" ON public.form_instances
FOR SELECT USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_tenant_admin() OR get_user_role() = 'dispatcher'
    OR created_by = auth.uid()
    OR job_id IN (SELECT id FROM public.scheduled_jobs WHERE assigned_to = auth.uid())
  )
);

-- Portal arm: copied in shape from C2's portal invoice-items policy
-- (20260723200000), single join because client_id is promoted. Completed
-- reports only — never drafts. Ships designed-in with no portal UI (founder
-- ruling 3, C2 posture).
CREATE POLICY "Portal clients view their completed reports" ON public.form_instances
FOR SELECT USING (
  status = 'completed'
  AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- INSERT: any tenant member creates, as themselves. Copied from "Technicians
-- can insert evidence" (20260420000000).
CREATE POLICY "Members create instances" ON public.form_instances
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id() AND created_by = auth.uid()
);

-- UPDATE: branches on status (founder review item 2c). WHAT may change per
-- state is the trigger's job; WHO may write is this policy's job — and once
-- completed, WHO is staff only: a technician cannot re-categorize their own
-- completed work. In-progress rows accept creator writes (autosave, and the
-- creator-void ruling) plus staff.
CREATE POLICY "Creator and staff update instances" ON public.form_instances
FOR UPDATE USING (
  tenant_id = get_user_tenant_id()
  AND (
    (status = 'in_progress'
      AND (created_by = auth.uid() OR is_tenant_admin() OR get_user_role() = 'dispatcher'))
    OR (status = 'completed'
      AND (is_tenant_admin() OR get_user_role() = 'dispatcher'))
  )
);

-- DELETE: explicit deny-all, copied from C5 (20260723500000) — immutability
-- is deliberate and self-documenting; mistakes are voided, never deleted.
CREATE POLICY "No instance deletion" ON public.form_instances
FOR DELETE USING (false);

-- form_deficiencies ---------------------------------------------------------

-- SELECT: same lattice as instances — staff see all; technicians see
-- deficiencies raised by their own instances or on their assigned jobs.
CREATE POLICY "Role-based deficiency visibility" ON public.form_deficiencies
FOR SELECT USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_tenant_admin() OR get_user_role() = 'dispatcher'
    OR instance_id IN (SELECT id FROM public.form_instances WHERE created_by = auth.uid())
    OR job_id IN (SELECT id FROM public.scheduled_jobs WHERE assigned_to = auth.uid())
  )
);

-- INSERT: no client policy — rows are born only through the SECURITY DEFINER
-- RPC. (Stated so the absence never looks like an oversight.)

-- UPDATE (resolution): staff only.
CREATE POLICY "Staff resolve deficiencies" ON public.form_deficiencies
FOR UPDATE USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR get_user_role() = 'dispatcher')
);

-- DELETE: explicit deny-all (C5 shape).
CREATE POLICY "No deficiency deletion" ON public.form_deficiencies
FOR DELETE USING (false);

-- form_number_counters: RLS enabled, ZERO policies — default-deny for every
-- client role; only the definer RPC reads or writes it. Deliberate.

-- form_instance_revisions ---------------------------------------------------

-- SELECT: staff only — the audit view is an office surface, not a technician
-- one. Zero write policies: the SECURITY DEFINER trigger is the only writer,
-- so the table is append-only from every client's point of view.
CREATE POLICY "Staff read instance revisions" ON public.form_instance_revisions
FOR SELECT USING (
  tenant_id = get_user_tenant_id()
  AND (is_tenant_admin() OR get_user_role() = 'dispatcher')
);

-- ─── Storage: form-attachments bucket (design Step 2) ───────────────────────

-- Copied wholesale from the job-evidence bucket (20260420000000): private,
-- 5 MB limit, tenant-folder scoping. Mime allowlist adds application/pdf for
-- the 'file' field type. Paths: {tenant_id}/{instance_id}/{localId}.{ext}.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-attachments',
  'form-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tenant members upload form attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'form-attachments'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

CREATE POLICY "Tenant members view form attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'form-attachments'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );

-- No UPDATE/DELETE policies on purpose: attachment immutability matches
-- instance immutability; the lifecycle decision is tracked in docs/backlog.md
-- (evidence deletion lifecycle) and applies here identically.


-- ─── Feature flag (design Step 8) ───────────────────────────────────────────

-- Runtime flag gating ALL form-engine UI entry points. Off, rollout 0 —
-- exact pattern of workflow_step_verification (20260420000000).
INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES (
  'form_engine',
  'Form Engine',
  'Slice Zero form engine: templates, instances, deficiencies, document numbers. Gates all form UI entry points.',
  false,
  0
)
ON CONFLICT (key) DO NOTHING;
