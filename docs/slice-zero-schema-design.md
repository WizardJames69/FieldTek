# FieldTek Form Engine — Design Document

**Date:** 2026-07-24 · **Base:** main @ `c641959` · **Status:** **APPROVED by founder 2026-07-24 with directed changes — all incorporated below.** No code, no migrations exist yet.
**Prerequisite (standing, founder-decided):** the first commit of form-engine work is the `field-assistant` dead-path removal (`docs/backlog.md`, "Form-engine opener"), which means one field-assistant deploy + the 12/12 live eval rerun *before* any schema lands.

All file references are to real code at `c641959` and are cited as evidence, not as things this design changes.

---

## Founder review — 2026-07-24 (incorporated)

Design approved with directed changes; every item below is folded into the steps that follow. Recorded here so the review-baseline diff is explicit.

**Schema-changing (all land in Migration 1):**
1. **Labour hours promoted** — the `role` tag union gains `'labor_hours'` (questions) and `'part'` / `'quantity'` (table columns); `form_instances.labor_hours numeric` is promoted and extracted at completion exactly like `serial_numbers`; the completion RPC gains `p_labor_hours` (§1.3, §1.5, §1.8). Reason: the weeks-4–6 invoice importer must find hours generically across templates it did not author.
2. **`outcome` freezes at completion** — it prints on the customer PDF, so the delivered document and the record can never silently diverge; it **stays on the PDF**. A wrong outcome is corrected by void + reissue, consistent with the amendments posture (§1.8).
3. **`form_instance_revisions`** — a fifth table: trigger-written audit rows for every post-completion edit to the still-editable columns (`fault_category`, `responsible_party`, `blocker`, bindings): who, when, old → new (§1.4b, Step 2).
4. **Post-completion edits are staff-only** — the instance UPDATE policy branches on status: creator + staff while `in_progress`; admin/dispatcher only once `completed` (Step 2).
5. **Counter prefix derives from tenant name at seed time**, `FT` fallback (§1.4 — open question 1 answered: `NSH-00042` beats every tenant sharing a prefix).

**Plan/behavior-changing (no schema impact):**
6. **Autosave is delta after first sync** — full-row INSERT once, then `answers`-only patches; the 40–80 KB definition snapshot never retransmits over a mechanical-room connection (Step 5).
7. **PDF photo embedding gets a byte budget** — 10 MB embedded, document order, explicit overflow note in the PDF. Chosen over server-side downscale (a wasm image codec inside an edge function is the exact memory risk being guarded) and over thumbnails-with-appendix (same bytes unless downscaled first). Client capture compression remains the primary control (Step 6).
8. **`responsible_party` input is suggestion-first** from the recency index, free entry as the secondary affordance; Q1 is stated fuzzy by construction (§1.1, Steps 3–4).
9. **Unanswered `neq` nailed down** — an unanswered referenced node makes `eq` / `neq` / `in` **all** evaluate false; only `answered` tests answeredness. Children never reveal before their parent is answered (§1.5, Step 3).

**Approved as proposed (unchanged):** readings grid as a `table` mode; admin template preview route in Slice Zero; deficiency rows over flags; snapshot Option A; hidden-subtree retained-but-excluded; optional unit binding; one jsonb tree; untouched checklist system.
**Open questions answered:** (1) prefix derived-with-fallback, above; (2) void = creator may void own `in_progress`, admin-only once `completed` — as designed; (3) portal arm ships designed-in with no UI, C2 posture — as designed.

---

## Step 1 — Schema

### 1.0 Table inventory and the argument for each

Five tables, two enums, one storage bucket, one RPC, two triggers. Every table beyond the required two is argued, not assumed:

| Table | Verdict | Why |
|---|---|---|
| `form_templates` | required | The authored artifact. One row per template; the definition is **one jsonb tree** (constraint 2). |
| `form_instances` | required | One row per filled form. Carries its own definition snapshot (constraint 4). |
| `form_instance_revisions` | **added — founder-directed (review item 3)** | Who re-categorized a fault and when is exactly the accountability question this engine exists to answer. Append-only audit rows, written by trigger on every post-completion edit to the still-editable columns; cannot be bypassed from the client. |
| `form_deficiencies` | **added — argued for** | Query 4.5 ("deficiencies raised >30 days ago still open") is unanswerable from jsonb answers alone: a deficiency has a *lifecycle* (raised → resolved, possibly by a later visit or a manual office action) that outlives the instance that raised it. Cross-instance identity inside `answers` jsonb would mean scanning every instance's json on every query. Promoted rows are the only sane shape. |
| `form_number_counters` | **added — argued for** | Document numbers must be unique under concurrency and gap-tolerant. `max(document_number)+1` races; client generation is exactly the anti-pattern the invoice system has today (`src/components/invoices/InvoiceFormDialog.tsx:173-178` — `INV-${Date.now}-${random}`, fine for invoices, unacceptable for numbers quoted in warranty disputes). A per-tenant counter row updated under row lock inside a SECURITY DEFINER RPC is the standard correct mechanism. |
| `form_template_versions` | **rejected** | Snapshot-on-instance makes the instance the version record. In Slice Zero, templates are versioned JSON seeds in git — the repo *is* the version history. A versions table would add a second RLS surface, a portal-reachable join, and a mutable-row risk for zero Slice-Zero value. Clean retrofit exists if the builder UI ever needs it (backfill by checksum from instance snapshots). |
| row-per-field / row-per-answer tables | **rejected** | This is the retired stream's exact mistake: `workflow_template_steps` was a linear `step_number INTEGER` sequence with `UNIQUE (workflow_id, step_number)` and a hard-coded stage CHECK (`supabase/migrations-parked/guided-procedures/20260425000000_workflow_templates.sql:54-71`). Nesting, conditionals, and repeat groups fought that shape at every turn. Constraint 2 stands; nothing in this design creates a per-field row. |
| separate attachments table | **rejected (for now)** | Attachment refs live inside `answers`; storage paths are deterministic (`{tenant_id}/{instance_id}/{localId}.{ext}`), so garbage collection is a prefix listing, and authorization is the bucket policy. An attachments table earns its keep only when we need per-attachment metadata queries — no query in Step 4 does. |

### 1.1 Enums

```sql
-- Outcome is a FIXED enum (founder constraint). Wording is trade-neutral on
-- purpose — 'complete', not 'commissioned' (see Step 7).
CREATE TYPE public.form_outcome AS ENUM (
  'complete',                     -- done, nothing owed
  'complete_with_deficiencies',   -- done, deficiency rows raised
  'incomplete',                   -- stopped; blocker/responsible_party say why
  'failed'                        -- work attempted, unit failed
);

-- Blocker is a SMALL fixed enum (founder constraint). It answers "what kind of
-- thing is in the way"; responsible_party (free text) answers "who".
CREATE TYPE public.form_blocker AS ENUM (
  'none', 'other_trade', 'parts', 'access', 'customer', 'weather'
);
```

`fault_category` is deliberately **not** an enum: it is a tenant-configurable list following the `tenant_settings.job_types` pattern (`src/integrations/supabase/types.ts:2871` — Json column on `tenant_settings`). First migration adds `tenant_settings.fault_categories jsonb` alongside it. `responsible_party` is free text (founder constraint: it names third-party companies; a config list goes stale weekly) — but the input is **suggestion-first** (review item 8): a combobox fed from the tenant's recent values via the `form_instances_resp_party` index, with free entry as the secondary "add new company" affordance. Answer quality still rides on entry discipline, which is why Q1 is stated fuzzy by construction (Step 4).

### 1.2 `form_templates`

```sql
CREATE TABLE public.form_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_key   text NOT NULL,        -- seed identity ('hvac-commissioning-v1' file → stable key)
  name         text NOT NULL,
  description  text,
  version      int  NOT NULL DEFAULT 1,   -- bumped by the seed script on every published change
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','published','archived')),
  definition   jsonb NOT NULL,       -- the FormDefinition tree (§1.5); current version only
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_key)     -- idempotent re-seeding
);
```

Templates are never hard-deleted (`archived` instead) — instances FK to them for lineage. There is no template builder UI in Slice Zero (constraint 1): FieldTek authors JSON seed files in-repo, validated by a script (§1.5.4), applied per-tenant by `npm run forms:seed` following the `scripts/provision-demo-tenant.ts` precedent. Seeds-in-git is what keeps this inside the Week-0 "no out-of-band state" rule: the applied artifact is versioned, diffable, and re-applicable, unlike hand-run SQL.

### 1.3 `form_instances`

```sql
CREATE TABLE public.form_instances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                      -- client-GENERATED uuid when created offline; DEFAULT covers online creates.
                      -- Client generation is what makes offline creation + idempotent sync possible.
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id),
  template_id         uuid NOT NULL REFERENCES public.form_templates(id),
  template_version    int  NOT NULL,
  definition_snapshot jsonb NOT NULL,        -- full copy of definition at creation (§1.6)
  answers             jsonb NOT NULL DEFAULT '{}',
                      -- named 'answers', not 'values' — VALUES is an SQL keyword and a
                      -- lifetime of quoting bugs is not worth the prettier name.
  status              text NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','completed','void')),

  -- The four-way status split (founder constraint: the incumbent crams these
  -- into one flat multi-select). All promoted; none touch job_status.
  -- outcome FREEZES at completion (review item 2) — it prints on the customer
  -- PDF; the other three stay staff-editable post-completion, revision-logged.
  outcome             public.form_outcome,   -- null until completed; immutable after
  fault_category      text,
  responsible_party   text,                  -- suggestion-first input (review item 8)
  blocker             public.form_blocker NOT NULL DEFAULT 'none',

  -- Bindings — ALL optional (constraint 5). SET NULL, never CASCADE: a
  -- commissioning record outlives the job row it was created under.
  job_id              uuid REFERENCES public.scheduled_jobs(id)    ON DELETE SET NULL,
  equipment_id        uuid REFERENCES public.equipment_registry(id) ON DELETE SET NULL,
  client_id           uuid REFERENCES public.clients(id)            ON DELETE SET NULL,

  -- Identity & audit
  document_number     text,                  -- server-issued at completion; null before
  serial_numbers      text[] NOT NULL DEFAULT '{}',  -- promoted from role-tagged answers (§1.7)
  labor_hours         numeric,               -- review item 1: sum of visible role:'labor_hours'
                                             -- answers at completion, serial_numbers pattern
  superseded_by       uuid REFERENCES public.form_instances(id),   -- void/amend breadcrumb; no UI in Slice Zero
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz
);
```

**Promoted columns, each justified against a real query** (constraint 3 — everything else stays in `answers`):

| Column | The query that demands it |
|---|---|
| `tenant_id` | every RLS policy and every query below |
| `template_id`, `template_version` | "all commissioning forms" (Step 4 Q2 groups by template); "which instances were filled against v6" |
| `job_id` | "every form for this job"; Q1's site join (site = the job's client/address — `scheduled_jobs.address`/`client_id`, `types.ts:2263`) |
| `equipment_id` | unit history; Q1 per-unit dedup; Q3 return-visit chains |
| `client_id` | the portal RLS arm (one join instead of two — §2), "all reports for client Y" |
| `status` | filter every list view; void exclusion in every query |
| `outcome` | Q2 first-visit completion rate |
| `fault_category` | Q3 return visits by fault |
| `responsible_party` | Q1 "blocked by the mechanical contractor" |
| `blocker` | Q1; "everything currently blocked" dashboard |
| `document_number` | lookup by the number a customer quotes on the phone |
| `serial_numbers` | Q4 — serial lookup 18 months later must not scan jsonb (§1.7) |
| `labor_hours` | review item 1 — the weeks-4–6 invoice importer asks "hours for this job" **generically**, across templates it did not author; without promotion the hours sit in `answers` under per-template node ids. Extracted at completion as the sum of visible `role:'labor_hours'` numeric answers (repeat rows included), same pattern as `serial_numbers` |
| `created_by`, `created_at`, `completed_at` | tech workload, date-range filters, Q2 quarter window |

**Deliberately not promoted:** a deficiency count (join `form_deficiencies` — one source of truth), site (lives on the job), model numbers / parts / quantities — the `role: 'model_number'` / `'part'` / `'quantity'` tags parse and seed, so a future importer can locate parts tables generically by walking `answers` with the snapshot's role map, but no query yet forces column promotion (same bar as everything else; see Step 9).

### 1.4 `form_deficiencies` and `form_number_counters`

```sql
CREATE TABLE public.form_deficiencies (
  id              uuid PRIMARY KEY,           -- client-generated (created during offline completion)
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
  job_id          uuid,                                              -- denormalized, no FK (survives job deletion)
  equipment_id    uuid REFERENCES public.equipment_registry(id) ON DELETE SET NULL
);

CREATE TABLE public.form_number_counters (
  tenant_id  uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix     text  NOT NULL DEFAULT 'FT',    -- 'FT' is the FALLBACK only (review ruling):
                                             -- forms:seed upserts this row with a prefix
                                             -- derived from the tenant name (North Shore
                                             -- HVAC → 'NSH'); the RPC's lazy insert keeps
                                             -- FT for tenants never seeded.
  next_value bigint NOT NULL DEFAULT 1
);
-- RLS enabled with ZERO policies: default-deny for every client role.
-- Only the SECURITY DEFINER completion RPC touches this table.
```

Deficiency rows are born **server-side, inside the completion RPC** (§1.8), from the client-computed list of visible failing answers. Resolution in Slice Zero is a manual staff action (UPDATE policy, §2); auto-resolution by a later passing instance is deliberately deferred (Step 9).

### 1.4b `form_instance_revisions` (review item 3)

```sql
CREATE TABLE public.form_instance_revisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id  uuid NOT NULL REFERENCES public.form_instances(id) ON DELETE CASCADE,
  changed_by   uuid NOT NULL,               -- auth.uid(), captured by the trigger
  changed_at   timestamptz NOT NULL DEFAULT now(),
  changes      jsonb NOT NULL               -- { column: { "old": …, "new": … } } per changed column
);
```

Written **only by trigger**: an `AFTER UPDATE` trigger on `form_instances` (SECURITY DEFINER function, same privilege model as the completion RPC) fires whenever a `completed` instance's still-editable columns (`fault_category`, `responsible_party`, `blocker`, `job_id`, `equipment_id`, `client_id`) change, and records the per-column old → new diff plus `auth.uid()`. Because the writer is a trigger, no client — including staff — can edit analytics without leaving a row; "who re-categorized this fault and when" becomes a query, not a shrug. The `completed → void` transition is also recorded. In-progress edits (autosave) are deliberately **not** revision-logged — that would log every keystroke sync; accountability attaches to the issued record, not the draft. RLS in Step 2: staff SELECT only, zero write policies (trigger-only, C5-style deny posture by absence).

One file is the single source of truth for renderer, validator, PDF walker, and the seed validator: `src/lib/forms/schema.ts`.

```ts
export type NodeId = string;   // unique within a template; stable across versions; authored, never derived

export interface FormDefinition {
  schema_version: 1;           // version of THIS format (migration lever), not the template version
  title: string;
  nodes: FormNode[];           // document order = render order = PDF order = condition-reference order
}

export type FormNode = SectionNode | QuestionNode | RepeatGroupNode | TableNode | StaticNode;

interface BaseNode {
  id: NodeId;
  clause?: string;             // "1.01", "2.11(a)" — authored, quoted in disputes; renumbering = new version
  label?: string;              // short label for PDF/index rows, distinct from the question text
  visible_when?: Condition;    // AND-ed with ancestor visibility (§3)
  include_in_pdf?: boolean;    // default true; false = internal-only field (constraint: actively used)
}

export interface SectionNode extends BaseNode {
  kind: 'section';
  text: string;                // heading
  children: FormNode[];
}

export interface StaticNode extends BaseNode {
  kind: 'instruction' | 'page_break';
  text?: string;               // instruction body; page_break has no text
}

export interface QuestionNode extends BaseNode {
  kind: 'question';
  text: string;                // the question as asked on the device
  input: InputSpec;
  required?: boolean;          // enforced only while visible (§3)
  flags?: {
    deficiency_on?: string[];  // answers that raise a deficiency row: ['no'], ['fail'], option ids
    role?: 'serial_number' | 'model_number' | 'labor_hours';
                               // semantic promotion (§1.7); 'labor_hours' (review item 1) lets the
                               // invoice importer find hours on templates it did not author —
                               // number inputs only (validator-enforced)
  };
  children?: FormNode[];       // the conditional TREE: revealed sub-nodes, each with its own
                               // visible_when; a child can itself be a parent (ERV chain)
}

export type InputSpec =
  | { type: 'text'; multiline?: boolean; placeholder?: string }
  | { type: 'number'; unit?: string; min?: number; max?: number }
  | { type: 'date' }
  | { type: 'select'; options: Option[] }               // dropdown
  | { type: 'chips'; options: Option[]; multi?: boolean }  // chip grid, single or multi
  | { type: 'tri_state' }                               // 'yes' | 'no' | 'na'
  | { type: 'binary'; pass_value: 'yes' | 'no' }        // green when answer === pass_value, red otherwise
  | { type: 'photo'; max?: number }
  | { type: 'file' }
  | { type: 'signature' };

export interface Option { id: string; label: string }

export interface RepeatGroupNode extends BaseNode {
  kind: 'repeat_group';        // the spray-pump fix: clauses 2.03/2.03(b)/2.03(C) become ONE group
  text: string;                // "Spray pump"
  count: { min: number; max: number; prompt?: string };  // "How many spray pumps?"
                               // future: bindable to an asset attribute — count shape leaves room
  children: FormNode[];        // full sub-form repeated per row; conditionals allowed; may nest
}

export interface TableNode extends BaseNode {
  kind: 'table';
  text: string;
  columns: TableColumn[];      // typed columns — the real SN/Model/Picture table
  rows?: { fixed: string[] };  // fixed labeled rows = the numeric readings grid; absent = tech adds rows
  max_rows?: number;
}

export interface TableColumn {
  id: string;                  // unique within the table
  label: string;
  type: 'text' | 'number' | 'photo';
  unit?: string;
  required?: boolean;
  role?: 'serial_number' | 'model_number' | 'part' | 'quantity';
                               // 'part'/'quantity' (review item 1): importer-facing tags so a
                               // parts table is findable generically; no column promotion yet
}

export type Condition =
  | { node: NodeId; op: 'eq' | 'neq'; value: string }
  | { node: NodeId; op: 'in'; values: string[] }
  | { node: NodeId; op: 'answered' }
  | { all: Condition[] }
  | { any: Condition[] };
// Unanswered semantics (review item 6, the visibility.ts contract): when the
// referenced node is UNANSWERED, eq / neq / in ALL evaluate false — neq is not
// "not yet answered". Only op:'answered' tests answeredness. Children therefore
// never reveal before their parent is answered, under every operator.
```

**Field-type coverage** (every observed type → schema construct):

| Teardown type | Construct |
|---|---|
| short text / long text | `text` / `text multiline` |
| number | `number` (+unit/min/max) |
| date | `date` |
| single-select dropdown | `select` |
| single/multi chip grid | `chips` / `chips multi` |
| tri-state Yes/No/NA | `tri_state` |
| binary with green/red pass | `binary` + `pass_value` |
| repeatable typed table (SN/Model/Picture) | `table` (dynamic rows, `photo` column) |
| fixed numeric readings grid | `table` with `rows.fixed` + `number` columns |
| photo / file / signature | `photo` / `file` / `signature` |
| section header / instruction / page break | `section` / `instruction` / `page_break` |
| repeatable clause group (three spray pumps) | `repeat_group` |

One deliberate simplification: the readings grid is a `table` configuration, not a separate kind — same value shape, same validation, one renderer with a fixed-rows mode. **Approved as proposed in the founder review.**

**Condition scope rules** (validator-enforced, §1.5.4):
1. `visible_when.node` must reference a node **earlier in document order**. This kills cycles by construction and makes visibility a single forward pass.
2. Inside a `repeat_group`, a reference resolves **within the same row first**, then to nodes outside the group. A condition may never reach *into* a repeat group from outside (row-ambiguous — rejected at validation).

#### 1.5.4 Seed validation

`scripts/validate-form-seed.ts` (pure, vitest-covered): node-id uniqueness, forward-only condition references, repeat-scope rule, option-id integrity for `eq/in` values, `deficiency_on` values that exist in the input's answer domain, `pass_value` validity, clause format `^\d+\.\d+([a-z]\))?$` when present, and **role/type agreement** (review item 1): `labor_hours` and `quantity` only on `number` inputs/columns, `part` only on `text` columns, serial/model roles on text-shaped inputs. The unanswered-condition rule (eq/neq/in false when the referenced node is unanswered — review item 6) is asserted by shared fixture tests against `visibility.ts` so validator and runtime can never disagree. `forms:seed` refuses invalid seeds. This script is the reason no template builder UI is needed for correctness in Slice Zero.

### 1.6 Answers shape, node addressing, and repeat-count changes

```ts
export interface FormAnswers { [nodeId: string]: AnswerValue }

export type AnswerValue =
  | string             // text, date (ISO), select option id, tri_state ('yes'|'no'|'na'), binary
  | number
  | string[]           // chips multi
  | AttachmentRef[]    // photo, file
  | SignatureValue
  | RowValue[];        // table AND repeat_group

export interface RowValue {
  _row: string;        // stable uuid minted when the row is created
  [childOrColumnId: string]: AnswerValue | string;
}

export interface AttachmentRef {
  path?: string;       // storage path once uploaded: {tenant_id}/{instance_id}/{localId}.jpg
  local?: string;      // IndexedDB blob key while offline — exactly one of path/local is set
  mime: string;
  captured_at: string;
}

export interface SignatureValue {
  path?: string; local?: string;   // PNG of the strokes, same attachment lifecycle
  signed_name: string;             // typed name
  signed_at: string;               // device timestamp
}
```

- **Addressing:** non-repeated nodes are addressed flat by `NodeId` (ids are template-unique). Repeated children live inside their row object — the pair `(groupId, _row, childId)` addresses them. Deficiency rows carry both `node_id` and `row_id` for exactly this reason.
- **Repeat count changes mid-fill:** answers belong to `_row` uuids, **not** to indexes. Raising the count appends fresh `_row`s (empty). Lowering it removes specific rows — the UI requires picking which row to remove and confirms when it holds answers; surviving rows keep their answers untouched. Letter suffixes (`2.03(a)`) are **presentational**, computed from row *order* at render/PDF time — deleting row (b) re-letters (c)→(b), which is correct because the letters are positional, and the issued PDF freezes them at completion.
- **Hidden-node answers are retained in `answers`** but excluded from validation, PDF, and extraction — the full argument is in Step 3.

### 1.7 Snapshot mechanism — both options argued

**Option A — full copy on the instance (`definition_snapshot jsonb`).**
For: the instance is completely self-contained — renderer, validator, PDF, and the portal read **one row**; RLS never has to grant portal customers access to a template/version table; nothing mutable exists to corrupt (a version row can be UPDATEd by a future bug or a well-meaning admin; a copy cannot); template hard-deletion can never orphan an instance's rendering. Against: storage — a 40-clause definition is ~40–80 KB raw; TOAST/pglz compresses the highly repetitive key structure to roughly 10–20 KB; at the observed 21 forms/day/tech that is ~5,500 instances/tech-year ≈ 60–110 MB/year per heavy tenant. Real but boring at FieldTek's scale for years.

**Option B — content-addressed `form_template_versions` referenced by hash.**
For: dedupe (one definition row serves thousands of instances); "every instance on v7" is a join. Against: the instance is no longer self-contained — the portal arm and the PDF renderer need a second table + join; immutability of version rows is a *discipline* (or another deny-all policy + trigger) rather than a property; and the offline device must cache version content anyway to render at all, so the client-side story is identical.

**Mid-fill template change on an offline device — what breaks under each:** under **A**, nothing: the device copied the definition at instance creation and never consults the server again; a template edit affects only future instances. Under **B**, also nothing *provided* version rows are truly append-only and the device cached the referenced version at creation — but if either guarantee slips (a mutated version row, an instance created from a stale template list whose version content was never cached), the device holds an instance it cannot render offline. A's failure mode does not exist; B's failure mode is a support call from a mechanical room.

**Pick: Option A, full copy** — plus `template_id` + `template_version int` columns so lineage queries stay cheap. B's only advantage is storage we don't need to save; A's self-containment simplifies RLS (Step 2), PDF (Step 6), and offline (Step 5) simultaneously. The dedupe retrofit (checksum backfill into a versions table) remains open if scale ever demands it.

### 1.8 Document numbers — issuance, concurrency, offline

Client-side generation is disqualified (see counters rationale, §1.0). Server mechanism:

```sql
CREATE OR REPLACE FUNCTION public.complete_form_instance(
  p_instance_id     uuid,
  p_answers         jsonb,
  p_outcome         public.form_outcome,
  p_fault_category  text,
  p_responsible_party text,
  p_blocker         public.form_blocker,
  p_serial_numbers  text[],
  p_labor_hours     numeric,   -- review item 1: client-extracted like serials
  p_deficiencies    jsonb      -- [{id, node_id, row_id, clause, description}]
) RETURNS TABLE (document_number text, completed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_instance form_instances%ROWTYPE;
  v_prefix text; v_seq bigint; v_doc text;
BEGIN
  SELECT * INTO v_instance FROM form_instances WHERE id = p_instance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;

  -- Authorization inside the definer (counters have no client policies):
  -- caller must be the creator or tenant staff of the instance's tenant.
  IF NOT (v_instance.created_by = auth.uid()
          OR (public.get_user_tenant_id() = v_instance.tenant_id
              AND (public.is_tenant_admin() OR public.get_user_role() = 'dispatcher'))) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- IDEMPOTENT: offline replay retries safely. Already completed → return the
  -- existing number, write nothing.
  IF v_instance.status = 'completed' THEN
    RETURN QUERY SELECT v_instance.document_number, v_instance.completed_at; RETURN;
  END IF;
  IF v_instance.status = 'void' THEN RAISE EXCEPTION 'instance is void'; END IF;

  -- Atomic per-tenant sequence: upsert-increment under row lock serializes
  -- concurrent completions; numbers are unique and dense per tenant.
  INSERT INTO form_number_counters (tenant_id) VALUES (v_instance.tenant_id)
  ON CONFLICT (tenant_id) DO UPDATE SET next_value = form_number_counters.next_value + 1
  RETURNING prefix, next_value INTO v_prefix, v_seq;
  v_doc := v_prefix || '-' || lpad(v_seq::text, 5, '0');

  UPDATE form_instances SET
    answers = p_answers, status = 'completed', outcome = p_outcome,
    fault_category = p_fault_category, responsible_party = p_responsible_party,
    blocker = p_blocker, serial_numbers = coalesce(p_serial_numbers, '{}'),
    labor_hours = p_labor_hours,
    document_number = v_doc, completed_at = now(), updated_at = now()
  WHERE id = p_instance_id;

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
```

- **Uniqueness under concurrency:** the counter row `FOR UPDATE`-serializes (via the upsert's row lock); the partial unique index below is the belt-and-braces backstop.
- **Immutability once issued (tightened per review item 2):** a `BEFORE UPDATE` trigger freezes `answers`, `definition_snapshot`, `document_number`, `completed_at`, `template_id`, `template_version`, `serial_numbers`, `labor_hours`, **`outcome`**, `created_by`, `created_at`, `tenant_id` once `status = 'completed'`. `outcome` joins the frozen set because it prints on the customer PDF — the delivered document and the record must never silently disagree; it stays on the PDF, and a wrong outcome is corrected by void + reissue, consistent with the amendments posture. The editable-triage argument survives only for the columns that **don't** print: `fault_category`, `responsible_party`, `blocker`, and the bindings remain editable post-completion — by **staff only** (review item 2c, enforced by the status-branching UPDATE policy in Step 2, so a technician cannot re-categorize their own completed work) — and every such edit writes a `form_instance_revisions` row via the companion `AFTER UPDATE` audit trigger (§1.4b; review item 2b). Status transitions: `completed → void` requires `is_tenant_admin()` (trigger-enforced); a creator may void their own `in_progress` instance (review ruling 2). This trigger pair is the direct answer to the checklist system's corruption mode — `job_checklist_completions` has no such guarantee and `JobStageWorkflow.tsx:246-271` happily rewrites history when a template changes.
- **Offline:** an instance created offline has `document_number = NULL` and completes *locally* into a "completed — pending sync" state; the number is issued when the queued `complete_form_instance` call replays (Step 5). The device shows a provisional reference (instance short-id) until then; the PDF — which is server-rendered anyway — always carries the real number. The number is **never** minted client-side. Accepted gap: a tech cannot quote the final number to a customer while still offline (Step 9 has the mitigation ladder).

### 1.9 Indexes (built for Step 4's queries)

```sql
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
```

---

## Step 2 — RLS

Role lattice mirrored from the live system: `owner/admin` via `is_tenant_admin()`, `dispatcher` via `get_user_role()`, technicians by ownership/assignment, portal customers via `clients.user_id = auth.uid()`. Each policy below states **copied vs invented**.

### `form_templates`

```sql
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: all tenant members read PUBLISHED templates (techs must render them);
-- drafts/archived are admin-only. Invented (no existing published/draft split
-- in the repo), but composed from the standard helpers.
CREATE POLICY "Members read published templates" ON public.form_templates
FOR SELECT USING (
  tenant_id = get_user_tenant_id()
  AND (status = 'published' OR is_tenant_admin())
);

-- Writes: admin-only. COPIED from the "Admins can manage/update" shape used on
-- workflow_step_evidence (20260420000000_workflow_step_evidence.sql:57-59).
CREATE POLICY "Admins manage templates" ON public.form_templates
FOR ALL USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
WITH CHECK  (tenant_id = get_user_tenant_id() AND is_tenant_admin());
```

No portal arm — the snapshot decision (§1.7) means a portal customer never needs template access. In practice Slice Zero writes templates via the seed script (service role, RLS-bypassing, founder-run); the admin write policy exists so a future builder UI has a correct surface waiting.

### `form_instances`

```sql
ALTER TABLE public.form_instances ENABLE ROW LEVEL SECURITY;

-- SELECT staff arm: COPIED from "Role-based job visibility"
-- (20260203061900:116-131) — admin/dispatcher see all; technicians see their
-- own — EXTENDED with an assigned-job arm (invented: a second tech sent to an
-- assigned job must be able to open the form the first tech started).
CREATE POLICY "Role-based instance visibility" ON public.form_instances
FOR SELECT USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_tenant_admin() OR get_user_role() = 'dispatcher'
    OR created_by = auth.uid()
    OR job_id IN (SELECT id FROM public.scheduled_jobs WHERE assigned_to = auth.uid())
  )
);

-- Portal arm: COPIED verbatim in shape from C2's
-- "Portal clients can view their own invoice items"
-- (20260723200000_tighten_invoice_line_items_select.sql:40-50), single join
-- because client_id is promoted. Completed reports only — never drafts.
CREATE POLICY "Portal clients view their completed reports" ON public.form_instances
FOR SELECT USING (
  status = 'completed'
  AND client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- INSERT: any tenant member creates, as themselves. COPIED from
-- "Technicians can insert evidence" (20260420000000:53-55).
CREATE POLICY "Members create instances" ON public.form_instances
FOR INSERT WITH CHECK (
  tenant_id = get_user_tenant_id() AND created_by = auth.uid()
);

-- UPDATE: branches on status (review item 2c). WHAT may change per state is the
-- trigger's job (policies can't compare OLD/NEW); WHO may write is this
-- policy's job — and once completed, WHO is staff only: a technician cannot
-- re-categorize their own completed work. In-progress rows accept creator
-- writes (autosave, and the creator-void ruling) plus staff.
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

-- DELETE: explicit deny-all. COPIED from C5
-- (20260723500000 explicit deny on workflow_step_evidence) — immutability is
-- deliberate and self-documenting; mistakes are voided, never deleted.
CREATE POLICY "No instance deletion" ON public.form_instances
FOR DELETE USING (false);
```

Note carried forward honestly: like C2's portal arm, the instance portal arm ships with **zero portal users in existence** (`docs/backlog.md` — demo portal account task). It is correct by construction, unexercised at runtime, and Slice Zero ships **no portal UI**. The backlog demo-portal account becomes its first real exercise, same as planned for invoice line items.

### `form_deficiencies`

SELECT: same lattice as instances, same policy body (technicians see deficiencies they raised or on their assigned jobs; staff see all — copied shape). INSERT: **no client policy** — rows are born only through the SECURITY DEFINER RPC. UPDATE (resolution): admin/dispatcher only. DELETE: explicit deny-all (C5 shape). `form_number_counters`: RLS enabled, zero policies, definer-only — invented, trivially safe, stated here so it never looks like an oversight.

### `form_instance_revisions`

RLS enabled. SELECT: staff only (`tenant_id = get_user_tenant_id() AND (is_tenant_admin() OR get_user_role() = 'dispatcher')` — the audit view is an office surface, not a technician one). INSERT/UPDATE/DELETE: **zero policies** — rows are written exclusively by the SECURITY DEFINER audit trigger (§1.4b), so the table is append-only from every client's point of view, counters-style.

### Storage — bucket `form-attachments`

COPIED wholesale from the `job-evidence` bucket (`20260420000000:85-115`): private bucket, 5 MB limit, tenant-folder scoping via `(storage.foldername(name))[1] = get_user_tenant_id()::text` (the same construction C3 retro-fitted onto branding). Mime allowlist: `image/jpeg`, `image/png`, `image/webp`, plus `application/pdf` for the `file` field type. INSERT + SELECT for tenant members; **no UPDATE/DELETE policies** (attachment immutability matches instance immutability; lifecycle question inherited with the evidence-lifecycle backlog item). Path convention: `{tenant_id}/{instance_id}/{localId}.{ext}` — capture normalizes photos to JPEG client-side (Step 5/6 need this: pdf-lib embeds only JPEG/PNG). Portal customers get photos only inside the PDF (service-role render), never via direct bucket reads.

---

## Step 3 — Renderer walk

### Storage of a 40-clause, 3-level commissioning checklist

One `definition` jsonb. Abbreviated but real — the observed ERV chain and spray-pump group:

```jsonc
{
  "schema_version": 1,
  "title": "HVAC Commissioning Checklist",
  "nodes": [
    { "id": "s2", "kind": "section", "clause": "2", "text": "Air-side systems", "children": [
      { "id": "q_erv", "kind": "question", "clause": "2.01", "text": "Does the unit have an integrated ERV?",
        "input": { "type": "tri_state" }, "required": true,
        "children": [
          { "id": "q_erv_motors", "kind": "question", "clause": "2.01(a)",
            "text": "Are both ERV motors running?",
            "visible_when": { "node": "q_erv", "op": "eq", "value": "yes" },
            "input": { "type": "binary", "pass_value": "yes" },
            "flags": { "deficiency_on": ["no"] },
            "children": [
              { "id": "q_erv_timer", "kind": "question", "clause": "2.01(b)",
                "text": "Does the bathroom timer speed up the ERV motors?",
                "visible_when": { "node": "q_erv_motors", "op": "eq", "value": "yes" },
                "input": { "type": "binary", "pass_value": "yes" },
                "flags": { "deficiency_on": ["no"] } }
            ] }
        ] },
      { "id": "q_model", "kind": "question", "clause": "2.02", "text": "Equipment model",
        "input": { "type": "chips", "options": [
          { "id": "carrier_24acc6", "label": "Carrier 24ACC6" }, { "id": "trane_xr16", "label": "Trane XR16" } ] },
        "children": [
          { "id": "q_model_no", "kind": "question", "clause": "2.02(a)", "text": "Model number",
            "visible_when": { "node": "q_model", "op": "eq", "value": "carrier_24acc6" },
            "input": { "type": "select", "options": [
              { "id": "24acc624", "label": "24ACC624" }, { "id": "24acc636", "label": "24ACC636" } ] },
            "flags": { "role": "model_number" } }
        ] },
      { "id": "g_pumps", "kind": "repeat_group", "clause": "2.03", "text": "Spray pump",
        "count": { "min": 1, "max": 3, "prompt": "How many spray pumps does this tower have?" },
        "children": [
          { "id": "q_pump_rot", "kind": "question", "text": "Correct rotation verified?",
            "input": { "type": "binary", "pass_value": "yes" }, "required": true,
            "flags": { "deficiency_on": ["no"] } },
          { "id": "q_pump_amps", "kind": "question", "text": "Motor amp draw",
            "input": { "type": "number", "unit": "A" } }
        ] },
      { "id": "t_units", "kind": "table", "clause": "2.04", "text": "Installed units",
        "columns": [
          { "id": "c_sn",    "label": "SN",      "type": "text",  "role": "serial_number", "required": true },
          { "id": "c_model", "label": "Model",   "type": "text" },
          { "id": "c_pic",   "label": "Picture", "type": "photo" } ] }
    ] }
  ]
}
```

Matching answers fragment: `{ "q_erv": "yes", "q_erv_motors": "yes", "q_erv_timer": "no", "g_pumps": [ { "_row": "r1…", "q_pump_rot": "yes", "q_pump_amps": 6.2 }, { "_row": "r2…", "q_pump_rot": "no" } ], "t_units": [ { "_row": "r3…", "c_sn": "ABC123", "c_pic": [{ "path": "…/r3-pic.jpg", "mime": "image/jpeg", "captured_at": "…" }] } ] }`

### Traversal and visibility

Pure function, no React: `computeVisibility(definition, answers): Set<string>` in `src/lib/forms/visibility.ts`. One depth-first forward pass; a node is visible iff its parent chain is visible AND its own `visible_when` evaluates true against `answers` (repeat children evaluate row-scoped, keyed `nodeId@rowId`). The forward-reference validator rule (§1.5) is what makes a single pass sufficient — no fixpoint, no cycles possible. ~200 nodes × a few rows is sub-millisecond; recomputed via `useMemo` on every answer change. An unanswered referenced node makes any `eq/neq/in` condition false — **including `neq`** (review item 6: unanswered is not "not-equal"; only the `answered` op tests answeredness) — so children stay hidden until the parent is actually answered, under every operator.

The same visible-set feeds **all four consumers** — renderer, required-validation, PDF walker, and extraction (serials, labour hours + deficiencies) — from one function. That single-source property is the design's main defense against the ghost-data class of bugs.

### Hidden subtrees: retained-but-excluded (picked, defended)

Answers under a newly-hidden subtree are **retained in `answers`, excluded from validation, PDF, deficiency extraction, and serial/labour-hours promotion**.

- *Why not clear:* the mis-tap case is the field reality — a tech fat-fingers "No ERV" on a phone in a mechanical room, six answered sub-questions vanish, and offline there is no server copy to restore from. Destroying captured field data on a UI transition is the worst failure mode available here.
- *Why not retain-and-include:* ghost data. A hidden "ERV motors running: no" must not raise a deficiency, block completion, or print on the customer PDF for a unit that has no ERV.
- The cost — stale invisible answers persisting in jsonb — is bounded and harmless *because* every consumer filters through the same visible set. The completed PDF and the analytics never see them.

### Required-field validation

`required` is enforced **only while visible** (a hidden required question is simply not part of the form right now). `missingRequired(definition, answers)` = visible ∩ required ∩ unanswered, per repeat-row for repeated children. Completion is blocked until it returns empty; the UI shows per-section progress and a "jump to first missing" affordance. The server-side RPC does **not** re-walk the tree in plpgsql — Slice Zero accepts client-side validation with the trust boundary stated plainly: a tampering client can only corrupt *its own tenant's* document quality, not cross a tenant boundary (RLS pins that); revisit post-Slice-Zero if partner data shows garbage (Step 9).

### Wide tables on mobile

The incumbent transposes; that survives to about three columns and dies the moment a column is a photo. Instead: **row-as-card** on mobile — each table row renders as a card of `label: value` pairs stacked vertically, photo cells as capture-button/thumbnail, an "Add row" button beneath (dynamic tables); ≥`md` breakpoints render a true grid. This matches the existing mobile card idiom (`JobChecklist.tsx` renders every checklist item as a card) rather than inventing a new interaction. Fixed-row readings grids (2–4 numeric columns) keep the grid on mobile — they fit — with horizontal scroll inside the container as the fallback.

### Reused vs new

**Reused:** shadcn primitives throughout (`Checkbox`, `Textarea`, `Input`, `Select`, `Calendar`, `Badge`, `Progress` — same set the checklist uses); the camera capture pattern (`<input type="file" accept="image/*" capture="environment">`, `StepEvidenceCapture.tsx:143-150`); `BarcodeScanner` (`src/components/mobile/BarcodeScanner.tsx`) wired to any field with `role: 'serial_number'`; the queued/failed inline feedback idiom (`JobChecklist.tsx:248-277`) and `CloudOff` badge language; the offline queue machinery (Step 5); `useFeatureFlags` gating.

**New:** `src/lib/forms/{schema,visibility,validate,extract}.ts` (pure, vitest-covered — built and tested *before* any UI); `src/components/forms/FormRenderer.tsx` + ~10 node components (`TriState`, `BinaryPassFail`, `ChipGrid`, `RepeatGroup`, `TableField`, `PhotoField`, `SignaturePad`, …); `SignaturePad` is net-new — **no signature component exists in the codebase** (verified: the only "signature" hit in src is landing-page demo copy); a **completion sheet** (outcome / fault category / blocker / responsible-party capture at completion time) whose `responsible_party` field is a suggestion-first combobox fed from the tenant's recent values (`form_instances_resp_party` index), free entry as the secondary affordance (review item 8); `useFormInstance` (local-first state + autosave-to-queue); pages `Forms.tsx` (list) + `FormFill.tsx` (renderer) + a "Forms" section on the technician job sheet.

---

## Step 4 — Queryability

All five run against promoted columns + the indexes in §1.9. None touch `answers` jsonb except where noted by design.

```sql
-- Q1: How many units at site X are blocked by the mechanical contractor?
-- "Site X" = the client whose premises the job is at (scheduled_jobs.client_id;
-- swap the predicate for j.address ILIKE ... when the site is an address).
-- Current-state semantics: latest completed instance per unit decides.
SELECT count(*) AS blocked_units
FROM (
  SELECT DISTINCT ON (fi.equipment_id) fi.blocker, fi.responsible_party
  FROM form_instances fi
  JOIN scheduled_jobs j ON j.id = fi.job_id
  WHERE fi.tenant_id = :tenant AND j.client_id = :site_client
    AND fi.equipment_id IS NOT NULL AND fi.status = 'completed'
  ORDER BY fi.equipment_id, fi.created_at DESC
) latest
WHERE latest.blocker = 'other_trade'
  AND latest.responsible_party ILIKE '%mechanical%';
-- Index: form_instances_equip_time. Honest limit: instances with no equipment
-- binding can't be deduped per-unit — count them per-instance in a UNION arm
-- if a tenant runs unbound. This is the price of constraint 5, not a bug.
-- FUZZY BY CONSTRUCTION (review item 5): responsible_party is free text, so
-- this ILIKE match is only as good as entry discipline. The suggestion-first
-- input (Step 3) exists to keep spellings converged; it narrows the fuzz, it
-- does not eliminate it. Stated plainly so nobody mistakes Q1 for exact.

-- Q2: First-visit completion rate this quarter (per job, commissioning template).
WITH first_visits AS (
  SELECT DISTINCT ON (job_id) job_id, outcome, completed_at
  FROM form_instances
  WHERE tenant_id = :tenant AND template_id = :commissioning_template
    AND status = 'completed' AND job_id IS NOT NULL
  ORDER BY job_id, created_at ASC
)
SELECT round(100.0 * count(*) FILTER (WHERE outcome = 'complete') / nullif(count(*), 0), 1)
       AS first_visit_completion_pct
FROM first_visits
WHERE completed_at >= date_trunc('quarter', now());
-- Index: form_instances_template_time.

-- Q3: Which fault category generates the most return visits?
-- A return visit = a completed instance on a unit that has an earlier completed
-- instance; attribution goes to the PRIOR visit's fault_category.
SELECT prior.fault_category, count(*) AS return_visits
FROM form_instances ret
JOIN LATERAL (
  SELECT p.fault_category
  FROM form_instances p
  WHERE p.tenant_id = ret.tenant_id AND p.equipment_id = ret.equipment_id
    AND p.status = 'completed' AND p.created_at < ret.created_at
  ORDER BY p.created_at DESC LIMIT 1
) prior ON true
WHERE ret.tenant_id = :tenant AND ret.status = 'completed'
  AND ret.equipment_id IS NOT NULL AND prior.fault_category IS NOT NULL
GROUP BY prior.fault_category ORDER BY return_visits DESC;
-- Index: form_instances_equip_time drives both sides. Requires equipment
-- binding — return-visit analytics on unbound instances is undefined by nature.

-- Q4: Every form instance for serial number ABC123, oldest first.
SELECT id, document_number, template_id, outcome, created_at
FROM form_instances
WHERE tenant_id = :tenant AND serial_numbers @> ARRAY['ABC123']
ORDER BY created_at ASC;
-- GIN index form_instances_serials. This works REGARDLESS of whether the unit
-- was ever registered in equipment_registry: serial_numbers aggregates the
-- bound equipment record's serial AND every role:'serial_number' answer,
-- including repeat-table columns. This is the 18-months-later warranty query
-- and it never scans jsonb.

-- Q5: Deficiencies raised >30 days ago, still open.
SELECT d.clause, d.description, d.raised_at, fi.document_number, fi.job_id
FROM form_deficiencies d
JOIN form_instances fi ON fi.id = d.instance_id
WHERE d.tenant_id = :tenant AND d.status = 'open'
  AND d.raised_at < now() - interval '30 days'
ORDER BY d.raised_at ASC;
-- Index: form_deficiencies_open — this query is the reason the table exists.
```

Schema changes forced by this exercise (already folded into Step 1): `serial_numbers text[]` + GIN (Q4 was the forcing function), `form_deficiencies` as a table (Q5), `client_id` promoted (Q1's portal-free join and the portal policy).

---

## Step 5 — Offline: IndexedDB v3 → v4

### Upgrade safety

`DB_VERSION` 3 → 4 in `src/lib/offlineDb.ts:7`. The existing `onupgradeneeded` handler already guards every store with `objectStoreNames.contains(...)` (`offlineDb.ts:63-95`); v4 **adds three stores in the same guarded style and touches nothing else**. IndexedDB upgrades preserve stores the handler doesn't modify, so queued mutations in `sync_queue` — and everything in the five other v3 stores — survive the upgrade untouched. (This property is asserted by a unit test that opens a fake v3 DB with queued rows and upgrades it.)

### New stores

```ts
// form_templates_cache — published templates for offline instance creation
{ id: string /* template id */, tenantId: string, data: FormTemplateRow, cachedAt: string }
// form_instances_local — the LOCAL source of truth while filling
{ id: string /* instance uuid */, data: FormInstanceRow /* incl. answers, snapshot */,
  dirty: boolean, conflict: boolean, serverKnown: boolean /* first sync done? */,
  updatedAt: string }
// form_blobs — photo/file/signature bytes, referenced by AttachmentRef.local
{ localId: string, instanceId: string, blob: Blob, storedAt: string }
```

Templates are cached on every online app load (published only). Instance creation offline = copy cached `definition` into a new local instance row with a client-minted uuid — the snapshot decision (§1.7) is what makes this a pure local operation.

### New queue operation types

Extends the `QueuedOperation.type` union (`offlineDb.ts:11`) and the `processOperation` switch (`useOfflineSync.ts:136-250`):

1. **`form_instance_upsert`** — periodic autosave of an in-progress instance, **delta after first sync** (review item 3). The first successful replay INSERTs the full row — the only time `definition_snapshot` crosses the wire; every later replay PATCHes only `answers` + `updated_at` via `.update(...).eq('id', …).eq('status','in_progress')`, so the 40–80 KB snapshot is never retransmitted over a mechanical-room connection. `serverKnown` on the local row picks INSERT vs patch; the client-generated uuid makes both idempotent (an INSERT that raced a prior success falls through to the patch path). Payload strips attachments to `local` refs — blobs never ride the queue payload (same discipline as `evidence_blobs`, which stores the Blob separately keyed by queue id, `offlineDb.ts:395-406`).
2. **`form_instance_complete`** — the terminal op. Replay sequence: (a) for every `AttachmentRef.local` still unresolved in the answers — including refs nested inside repeat-group and table rows — read `form_blobs`, upload to `form-attachments` at the deterministic path `{tenant}/{instance}/{localId}.{ext}` with `upsert: true` (deterministic path + upsert = retry-safe after a half-failed batch), rewrite `local` → `path` in the payload answers; (b) call `supabase.rpc('complete_form_instance', …)` — idempotent server-side (§1.8); (c) delete the uploaded blobs. Large photos inside a repeat-row are therefore handled identically to top-level photos: the ref's location in the tree is irrelevant to storage — `form_blobs` is flat, keyed by `localId`.

No separate photo-upload op type: coupling upload into the completion op removes the ordering hazard entirely (a completion can never replay before its attachments — it *is* the uploader). Autosave upserts carry `local` refs harmlessly; the storage-path rewrite happens exactly once, at completion replay.

### Conflict rule when the server has moved on

Instances are effectively single-author (one tech, one device), so conflicts are rare and simple by policy: **server wins once completed**. If a queued upsert/complete finds the server instance already `completed` or `void` (the guarded update matches 0 rows / the RPC returns the already-completed result with a *different* answers hash), the local op is dropped from the queue, the local copy is flagged `conflict: true` (kept read-only in `form_instances_local`, never silently discarded), and the loud persistent-toast pattern from `notifyPermanentDrop` (`useOfflineSync.ts:59-71`) fires. The server-side freeze trigger (§1.8) enforces the same rule at depth. While both sides are `in_progress`, last-write-wins on the whole answers document — acceptable at single-author reality; per-node merge is explicitly out of scope.

### Deliberately NOT supported offline in Slice Zero

Document-number issuance (deferred to sync — §1.8); PDF generation (server-side by design); deficiency resolution; template list refresh; creating an instance from a template never cached on that device; the portal; multi-device concurrent editing of one instance. Also: `navigator.storage.persist()` is requested on first form use, and photos are client-compressed (canvas re-encode to ≤1600 px JPEG, ~200–400 KB) before hitting `form_blobs` — both for quota survival at 21 forms/day and because the storage bucket caps files at 5 MB (`job-evidence` precedent) and the PDF embedder requires JPEG/PNG anyway.

---

## Step 6 — PDF

New edge function `generate-form-pdf`, cloning `generate-invoice-pdf`'s architecture file-for-file:

- **`index.ts`** — same flow as the invoice function: `verify_jwt=false` in config.toml + `getUser` authentication, service-role fetch of the instance, **authorize before render**, non-enumerating 404 on failure. The authorization module is a near-verbatim copy of `authorize.ts` (`generate-invoice-pdf/authorize.ts:36-67`): staff arm (`tenant_users` active + owner/admin/dispatcher) OR portal arm (`clients.user_id = auth.uid()` matching `instance.client_id`), fail-closed on lookup error. This is the B1-IDOR lesson applied on day one, not retrofitted. One addition: portal callers get `status = 'completed'` instances only.
- **`renderFormPdf.ts`** — pure, side-effect-free, unit-tested with injected `generatedAt`, exactly like `renderInvoicePdf.ts`'s header comment promises for its own tests.

**Directly reusable from `renderInvoicePdf.ts`:** `sanitizeWinAnsi` (:64-73), `hexToRgb` (:75-83), `wrapText` with injectable measure (:102-129), `formatDate`, the pagination discipline (`newPage`/`drawTableHeader` re-issue + `FOOTER_RESERVE`, :259-284), the branding fetch + `primary_color` theming, the footer block, page geometry (612×792, 40 margin). **Recommendation: lift the four pure text helpers into `supabase/functions/_shared/pdfText.ts`** and import from both functions — they are already written as injectable pure functions, the invoice function's behavior doesn't change, and both functions will live for years. (If the founder prefers zero touch on the shipped invoice function, copy-first is acceptable; the lift is a later no-op refactor.)

**New abstraction — the block walker.** Invoices render a fixed layout; forms render a *tree*. `renderFormPdf.ts` walks `definition_snapshot` depth-first, filtered by `computeVisibility(snapshot, answers)` ∩ `include_in_pdf !== false`, and emits typed layout blocks:

| Node | PDF treatment |
|---|---|
| `section` | clause + heading in brand primary, rule beneath — the invoice header idiom |
| `question` | clause + (label ?? text) left; answer right. `tri_state`/`binary` answers render as colored chips — green pass / red fail / gray NA — via the invoice `STATUS_STYLE` badge technique (:229-235) |
| `instruction` | gray italic paragraph (`include_in_pdf: false` is common here — internal notes stay off customer paper, the constraint's stated use) |
| `page_break` | forced `newPage()` |
| `table` | the invoice line-items table pattern (header re-issued after page breaks); >4 columns falls back to stacked per-row blocks; photo cells embed thumbnails |
| `repeat_group` | children rendered per row under `clause(letter)` subheads — `2.03(a)`, `2.03(b)` — letters assigned from row order at render |
| `photo`/`file` | photos: service-role storage download + `embedJpg`/`embedPng`, scaled to fit width, max ~240 pt tall, own page-break check per image, **subject to the embedded-byte budget below**. Non-image files: filename line, no embed |
| `signature` | embedded stroke PNG above a rule, `signed_name` + `signed_at` beneath — the legal block |

Document chrome: header carries the tenant branding (name + primary color, invoice pattern), the **document number** in the masthead slot where "INVOICE" sits, status/outcome badge, completion date. (`outcome` printing here is safe precisely because review item 2 froze it — the paper and the record cannot diverge.) A closing auto-section lists open deficiencies raised by this instance (clause + description) — the customer-visible deficiency summary. Fonts stay WinAnsi Helvetica; `sanitizeWinAnsi` already handles the emoji/CJK realities. Photos are guaranteed embeddable because capture normalized to JPEG (Step 5).

**Photo embedding cap (review item 4) — pick: a per-document embedded-byte budget of 10 MB, walker-enforced in document order.** pdf-lib embeds original bytes — page-scaling to 240 pt shrinks nothing — so an uncapped 20-photo commissioning form means megabytes downloaded and embedded inside an edge function with time and memory limits. Why this option over the other two: server-side downscale needs a wasm image codec inside Deno edge — a heavy dependency whose decode buffers are the exact memory risk being guarded; thumbnails-inline-with-photo-appendix still embeds the same original bytes unless downscaled first, so it rearranges the cost without reducing it. The **primary** control is upstream and already designed: capture compresses to ≤1600 px JPEG at ~200–400 KB (Step 5), so a typical 20-photo form embeds ~4–8 MB and fits entirely. The budget is the backstop for pathological forms: once cumulative embedded bytes would exceed 10 MB, each remaining photo renders as a labeled "photo on file" line, and the final page states "N additional photos not embedded — available in FieldTek." Degradation is deterministic (document order), visible on the paper itself, and never fails the render.

---

## Step 7 — The cross-trade test

A two-truck plumbing outfit's service-call form, authored against the schema exactly as it stands:

```jsonc
{
  "schema_version": 1,
  "title": "Plumbing Service Call",
  "nodes": [
    { "id": "s_dispatch", "kind": "section", "text": "Dispatch", "children": [
      { "id": "q_date", "kind": "question", "text": "Service date", "input": { "type": "date" }, "required": true },
      { "id": "q_addr", "kind": "question", "text": "Service address", "input": { "type": "text" } },
      { "id": "q_reported", "kind": "question", "text": "Reported issue",
        "input": { "type": "text", "multiline": true } } ] },
    { "id": "s_diag", "kind": "section", "text": "Diagnostic checks", "children": [
      { "id": "q_shutoff", "kind": "question", "text": "Main shutoff operational?",
        "input": { "type": "tri_state" }, "flags": { "deficiency_on": ["no"] } },
      { "id": "q_relief", "kind": "question", "text": "Water heater relief valve OK?",
        "input": { "type": "binary", "pass_value": "yes" }, "flags": { "deficiency_on": ["no"] },
        "children": [
          { "id": "q_relief_note", "kind": "question", "text": "Describe the relief valve issue",
            "visible_when": { "node": "q_relief", "op": "eq", "value": "no" },
            "input": { "type": "text", "multiline": true }, "required": true } ] },
      { "id": "q_leak_photo", "kind": "question", "text": "Photo of issue",
        "input": { "type": "photo", "max": 4 } } ] },
    { "id": "s_work", "kind": "section", "text": "Work performed", "children": [
      { "id": "t_parts", "kind": "table", "text": "Parts used", "columns": [
          { "id": "c_part", "label": "Part", "type": "text", "required": true, "role": "part" },
          { "id": "c_qty",  "label": "Qty",  "type": "number", "role": "quantity" } ] },
      { "id": "q_hours", "kind": "question", "text": "Labor hours",
        "input": { "type": "number", "unit": "h" }, "required": true,
        "flags": { "role": "labor_hours" } },
      { "id": "q_internal", "kind": "question", "text": "Internal notes (not on customer copy)",
        "include_in_pdf": false, "input": { "type": "text", "multiline": true } } ] },
    { "id": "q_sig", "kind": "question", "text": "Customer signature",
      "input": { "type": "signature" }, "required": true }
  ]
}
```

- **Zero new field types.** Confirmed: every node above uses constructs already required by the HVAC teardown. The signature, parts table, tri-states, conditional note, and internal-only field are the same machinery.
- **The importer-facing roles are cross-trade by construction** (review item 1): `labor_hours` on the hours question and `part`/`quantity` on the parts table mean the weeks-4–6 invoice importer reads this plumbing form and the HVAC commissioning form with the same code — no per-template node-id knowledge anywhere.
- **No clause numbers anywhere** — and nothing breaks: `clause` is optional; the renderer and PDF show numbers only when authored. A plumbing form without legalese numbering renders clean.
- **Exists only because of HVAC commissioning?** Audit of every schema feature: `clause` (keep — optional capability, zero cost when absent); fixed-row tables/readings grids (keep — already generalized into `table.rows.fixed`; a plumber's pressure-test grid uses it identically); `repeat_group` (generic — bathrooms, fixtures, roof drains); `role: 'serial_number'` (generic — water heaters have serials); equipment binding (optional by constraint 5); `blocker.other_trade` (generic on any construction site); `outcome` wording (deliberately trade-neutral — `complete`, not `commissioned`). **Nothing needs cutting; nothing is HVAC-hard-coded.** The two-truck company's only mandatory ceremony is a document number — which they want anyway, because their customers dispute invoices too.

---

## Step 8 — Migration path and coexistence

**Coexistence is structural, not procedural.** The form engine adds five tables, one bucket, one flag, and new routes. It writes to none of `job_stage_templates`, `job_checklist_completions`, `job_status` (constraint 7); its only contact with the existing system is three *nullable, SET NULL* FKs pointing at `scheduled_jobs`/`equipment_registry`/`clients`. There is no FK from the old system into the new one and none from the new into the old system's tables. Both surfaces run simultaneously: the technician job sheet shows the existing checklist *and*, flag-gated, a Forms section; `JobChecklistResults` (`src/components/jobs/JobChecklistResults.tsx`) keeps rendering historical checklist rows untouched.

**Rollout control:** runtime feature flag `form_engine` (row inserted `is_enabled=false, rollout 0` in the first migration — the exact pattern of `workflow_step_verification`, `20260420000000:69-79`), gating all UI entry points. Tier gating via `FeatureGate` can layer on later without schema impact.

**What must be true before retiring `job_stage_templates`** (stated, not planned — per the brief):
1. Every stage template a tenant actively uses has a published form-template equivalent (seed parity, verifiable by query).
2. Technician adoption measured — form instances created per week ≥ checklist completions per week for N consecutive weeks on the target tenant.
3. Offline parity proven in the field (the founder device drill, form edition).
4. Historical `job_checklist_completions` rows are **never migrated** — they lack snapshots, so any migration would fabricate history (the exact sin this engine exists to end). `JobChecklistResults` survives as the read-only archive view indefinitely.
5. The evidence-lifecycle decision (backlog) is resolved, since `workflow_step_evidence` retirement rides with the checklist system.
6. Sentinel's compliance/workflow context (`field-assistant` reads `job_stage_templates` stage context today) gets a form-engine-aware replacement — an AI-side task, tracked when retirement is actually planned.

Because coexistence is structural, retirement is *UI removal plus table freeze* — no data surgery, no FK untangling. No corner is painted. The parked guided-procedures stream also composes cleanly: its namespace (`workflow_templates` et al.) collides with nothing here, and a revived procedures layer would *reference* form templates, not compete with them.

---

## Step 9 — Risks, open questions, and pushback

**Least confident (would prototype before committing UI):**
1. **Repeat-group condition scoping** (§1.5 rule 2) is the subtlest part of the visibility engine. Prototype: build `visibility.ts` + `extract.ts` first, test-first, against the full commissioning fixture — before any component exists. They are pure functions; this is cheap insurance.
2. **The offline photo pipeline** (compress → `form_blobs` → deterministic-path upload → ref rewrite) on a real iPhone PWA, at 21-forms-a-day volume. Prototype on the founder's device early — quota behavior and HEIC→JPEG normalization are empirically discovered, not designed.
3. **Counter RPC under concurrency** — two parallel completions on one tenant. A 20-line Deno test proves serialization + idempotent replay before anything depends on it.

**Known-accepted gaps (stated so nobody discovers them in week three):**
- **Client-computed extraction trust boundary:** serials, labour hours, and deficiencies are computed client-side from the shared pure lib; the RPC validates ownership/status/shape but does not re-walk the tree. A hostile client corrupts only its own tenant's analytics — RLS pins the blast radius. Server-side re-derivation is a contained future hardening (the jsonpath machinery to verify node ids exists) if partner data ever warrants it.
- **No document number while offline:** the number arrives at sync. Mitigation ladder: provisional short-id on device → if partners genuinely need on-site numbers, per-device reserved ranges later. Not solving this now is deliberate — reserved ranges are complexity with a smell, and the PDF (the artifact customers actually receive) always carries the real number.
- **Amendments are undesigned.** Completed instances are immutable; the escape hatch is `void` (admin-gated) + a fresh instance, with `superseded_by` recorded — but no amendment UI, no partial-correction flow. That is a product conversation for after partners hit it. The column exists now because schema is cheap and retrofit is not (the founder's own principle).
- **Attachment/evidence lifecycle:** `form-attachments` has no DELETE path, matching C5's deliberate immutability and inheriting the same open product decision already tracked in `docs/backlog.md` (evidence deletion lifecycle). The form engine consciously adopts the same posture rather than inventing retention policy mid-design.
- **`fault_category` renames orphan history** — text against a tenant-editable list means renaming a category strands old rows, exactly like `job_types` today. Accepted for consistency with the established pattern; a lookup-table refactor is possible later if analytics demand it.

**Pushback on the constraints (asked for plainly):**
- **Constraint 1 (full schema day one) — agreed, with one deviation to flag:** the readings grid landed as a `table` mode rather than a distinct type (§1.5). If the founder wants the distinct authoring concept for template-author clarity, it is a five-line schema addition — but the renderer/value/validation machinery would be identical, so I recommend the merge.
- **Constraint 1's "no builder UI" — right, but it needs one small companion:** an admin-only, flag-gated **template preview route** (render any template's current definition against empty answers, no persistence). Without it, every seed iteration is "deploy seed → find a phone → create a throwaway instance," and FieldTek's own authoring loop becomes the slowest part of Slice Zero. The renderer already exists by then; the route is ~50 lines. I've included it in Slice Zero and flag it here because it is technically UI for templates — it is *not* a builder.
- **Constraint 3 (promoted columns) — pushed one step further than written:** the founder's list implies deficiency *flags*; the queries force deficiency *rows* (§1.0). That is a schema-shape decision beyond the stated constraint, taken per the Step 4 mandate ("change the schema rather than the question").
- **Everything else** — snapshot-on-instance, jsonb tree, optional unit binding, mobile-first, untouched checklist system — survives contact with the code and the queries intact. No constraint is wrong.

**Open questions — ANSWERED by founder review (2026-07-24):**
1. Document-number prefix: **derived from tenant name at seed time, `FT` fallback** (a customer quoting `NSH-00042` beats every tenant sharing a prefix). Folded into §1.4 and the seed script.
2. Void: **creator may void their own in-progress instance; admin-only once completed** — as designed.
3. Portal arm: **ships designed-in with no UI**, same posture as C2; one revoke away if it ever looks wrong.

---

## The first implementable slice

**Slice Zero** (one PR series, flag-gated, nothing user-visible until `form_engine` enables):

0. **Commit 0 (standing rule):** `field-assistant` dead-path removal + deploy + 12/12 live eval (`docs/backlog.md` opener). No form-engine code before this lands.
1. **Migration 1 (the "full schema on day one" migration):** two enums; `form_templates`, `form_instances` (incl. `labor_hours`), `form_deficiencies`, `form_number_counters`, `form_instance_revisions`; immutability trigger (outcome frozen) + audit trigger; `complete_form_instance` RPC (incl. `p_labor_hours`); all §1.9 indexes; RLS per Step 2 (status-branching UPDATE policy); `form-attachments` bucket + policies; `tenant_settings.fault_categories` column; `form_engine` flag row (off). Must replay clean under the db-replay CI gate.
2. **Pure libs first:** `schema/visibility/validate/extract.ts` + seed validator, vitest-covered against the commissioning fixture (risk item 1).
3. **Seeds:** `npm run forms:seed` (idempotent on `(tenant_id, source_key)`) + two real templates — HVAC commissioning (the 40-clause teardown) and the Step-7 plumbing service call (cross-trade proof lives in the repo, not in this document).
4. **Mobile-first renderer:** all input kinds, row-as-card tables, camera + barcode + signature capture; technician job-sheet "Forms" section + `Forms`/`FormFill` pages; admin template **preview route**.
5. **Offline v4:** three stores, two queue ops, conflict flagging (Step 5), upgrade-preservation test.
6. **`generate-form-pdf`:** authorize clone + block walker (Step 6), Deno tests for authz + renderer purity.
7. **Deficiency minimum:** auto-raise at completion (RPC), staff list + resolve UI (one page), Q5 as its default view.
8. **Tests/gates:** Deno authz matrix for the RPC + PDF function; Playwright happy path (create → conditional reveal → repeat group → complete → number issued) + flag-off assertion; demo-tenant seed for founder smoke.

**Slice Zero deliberately excludes:** template builder UI (seeds + validator + preview only); any portal UI (policy ships, surface waits for the backlog demo-portal account); amendments/supersede flow (column only); auto-resolution of deficiencies by later visits; repeat-count binding to asset attributes (`count` shape reserves the slot); `model_number`/`part`/`quantity` column promotion (the role tags parse and seed; only serials and labour hours are extracted and promoted); analytics dashboards (the five queries exist as SQL, not UI); a revisions-history UI (the table fills from day one; reading it is a later page); Sentinel integration; per-template document prefixes or numbering pattern language; server-side answer re-validation; multi-device concurrent editing; guided procedures.
