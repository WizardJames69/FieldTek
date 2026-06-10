-- ============================================================
-- Re-issue: Security Advisor Fixes (Phase 0)
-- ============================================================
-- Supersedes the never-applied 20260511000000_security_advisor_fixes.sql,
-- which was stranded behind the deferred workflow-template migration
-- stream (20260425000000–20260513000000) and therefore never reached
-- staging or production.
--
-- This re-issue contains ONLY the fixes whose target objects exist in
-- currently-deployed environments:
--   A. tenant_usage: enable RLS + policies (advisor ERROR).
--      The table exists only in remote environments (created via
--      dashboard, no local CREATE TABLE migration), so this section is
--      guarded and no-ops where the table is absent (e.g. fresh local).
--   B. increment_job_usage: SET search_path (advisor warning)
--   C. 3 intelligence views recreated WITH (security_invoker=on)
--      (advisor ERRORs — views otherwise execute with owner privileges
--      and bypass RLS). Views originate from applied migrations
--      20260410200000 / 20260415000000.
--   D. 9 functions: SET search_path = public (advisor warnings).
--      Functions originate from applied migrations 20260221140000,
--      20260225000000, 20260410200000, 20260415000000.
--
-- EXCLUDED from the original on purpose: search_path fixes for
-- upsert_workflow_step_statistic, fetch_clusterable_chains and
-- convert_suggestion_to_template — those functions are created by the
-- deferred workflow stream (20260501000000 / 20260510000000) and do not
-- exist in deployed environments. Their search_path fix must ship with
-- that stream when it is applied (tracked in docs/RUNBOOK.md).
--
-- All statements are idempotent.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- A. tenant_usage: Enable RLS + Policies (guarded)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.tenant_usage') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Tenant members can view own usage" ON public.tenant_usage';
    EXECUTE 'CREATE POLICY "Tenant members can view own usage"
      ON public.tenant_usage FOR SELECT
      TO authenticated
      USING (tenant_id = public.get_user_tenant_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Service role full access to tenant_usage" ON public.tenant_usage';
    EXECUTE 'CREATE POLICY "Service role full access to tenant_usage"
      ON public.tenant_usage FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Deny anon access to tenant_usage" ON public.tenant_usage';
    EXECUTE 'CREATE POLICY "Deny anon access to tenant_usage"
      ON public.tenant_usage FOR ALL
      TO anon
      USING (false)';
  ELSE
    RAISE NOTICE 'tenant_usage does not exist in this environment; skipping RLS enablement';
  END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- B. increment_job_usage: SET search_path (guarded)
-- ────────────────────────────────────────────────────────────
-- The function exists only in remote environments (no local CREATE in
-- migrations). Patch it where present; do not create an orphan where
-- it is absent.

DO $$
BEGIN
  IF to_regprocedure('public.increment_job_usage()') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.increment_job_usage()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public
      AS $body$
      DECLARE
        v_subscription_status TEXT;
      BEGIN
        SELECT subscription_status
        INTO v_subscription_status
        FROM public.tenants
        WHERE id = NEW.tenant_id;

        IF v_subscription_status NOT IN ('active', 'trialing') THEN
          RAISE EXCEPTION 'Subscription inactive. Please update billing.';
        END IF;

        RETURN NEW;
      END;
      $body$
    $fn$;
  ELSE
    RAISE NOTICE 'increment_job_usage() does not exist in this environment; skipping search_path fix';
  END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- C. Views: Recreate with security_invoker=on
-- ────────────────────────────────────────────────────────────

-- C1. workflow_failure_paths
DROP VIEW IF EXISTS public.workflow_failure_paths;
CREATE VIEW public.workflow_failure_paths
WITH (security_invoker=on) AS
  SELECT
    ws.tenant_id,
    ws.symptom_key,
    ws.symptom_label,
    ws.equipment_type,
    wf.failure_key,
    wf.failure_label,
    wie.frequency,
    wie.probability
  FROM public.workflow_intelligence_edges wie
  JOIN public.workflow_symptoms ws ON wie.source_id = ws.id AND wie.source_type = 'symptom'
  JOIN public.workflow_failures wf ON wie.target_id = wf.id AND wie.target_type = 'failure'
  WHERE wie.edge_type = 'leads_to'
  ORDER BY wie.probability DESC;

GRANT SELECT ON public.workflow_failure_paths TO authenticated, anon, service_role;

-- C2. workflow_diagnostic_success
DROP VIEW IF EXISTS public.workflow_diagnostic_success;
CREATE VIEW public.workflow_diagnostic_success
WITH (security_invoker=on) AS
  SELECT
    wd.tenant_id,
    wd.diagnostic_key,
    wd.diagnostic_label,
    wd.equipment_type,
    wd.success_count,
    wd.total_count,
    CASE WHEN wd.total_count > 0
      THEN ROUND((wd.success_count::numeric / wd.total_count) * 100, 1)
      ELSE 0
    END AS success_rate_pct,
    wd.avg_duration_minutes
  FROM public.workflow_diagnostics wd
  ORDER BY success_rate_pct DESC;

GRANT SELECT ON public.workflow_diagnostic_success TO authenticated, anon, service_role;

-- C3. workflow_repair_effectiveness
DROP VIEW IF EXISTS public.workflow_repair_effectiveness;
CREATE VIEW public.workflow_repair_effectiveness
WITH (security_invoker=on) AS
  SELECT
    ws.tenant_id,
    ws.symptom_key,
    ws.symptom_label,
    ws.equipment_type,
    wf.failure_key,
    wf.failure_label,
    wr.repair_key,
    wr.repair_label,
    e_sf.frequency AS symptom_to_failure_freq,
    e_sf.probability AS symptom_to_failure_prob,
    e_fr.frequency AS failure_to_repair_freq,
    e_fr.probability AS failure_to_repair_prob,
    e_ro.frequency AS repair_to_outcome_freq,
    wo.outcome_type,
    wo.outcome_key
  FROM public.workflow_intelligence_edges e_sf
  JOIN public.workflow_symptoms ws
    ON e_sf.source_id = ws.id AND e_sf.source_type = 'symptom'
  JOIN public.workflow_failures wf
    ON e_sf.target_id = wf.id AND e_sf.target_type = 'failure'
  JOIN public.workflow_intelligence_edges e_fr
    ON e_fr.source_id = wf.id AND e_fr.source_type = 'failure'
    AND e_fr.target_type = 'repair' AND e_fr.edge_type = 'repaired_by'
  JOIN public.workflow_repairs wr
    ON e_fr.target_id = wr.id
  LEFT JOIN public.workflow_intelligence_edges e_ro
    ON e_ro.source_id = wr.id AND e_ro.source_type = 'repair'
    AND e_ro.target_type = 'outcome' AND e_ro.edge_type = 'resulted_in'
  LEFT JOIN public.workflow_outcomes wo
    ON e_ro.target_id = wo.id
  WHERE e_sf.edge_type = 'leads_to'
  ORDER BY e_sf.probability DESC, e_fr.probability DESC;

GRANT SELECT ON public.workflow_repair_effectiveness TO authenticated, anon, service_role;


-- ────────────────────────────────────────────────────────────
-- D. Functions: SET search_path = public
-- ────────────────────────────────────────────────────────────

-- D1. set_tenant_ai_policies_updated_at (origin: 20260221140000)
CREATE OR REPLACE FUNCTION public.set_tenant_ai_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- D2. document_chunks_search_vector_trigger (origin: 20260225000000)
CREATE OR REPLACE FUNCTION public.document_chunks_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- D3. upsert_workflow_symptom (origin: 20260410200000)
CREATE OR REPLACE FUNCTION public.upsert_workflow_symptom(
  p_tenant_id UUID, p_symptom_key TEXT, p_symptom_label TEXT,
  p_equipment_type TEXT, p_category TEXT
) RETURNS UUID LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.workflow_symptoms (tenant_id, symptom_key, symptom_label, equipment_type, category)
  VALUES (p_tenant_id, p_symptom_key, p_symptom_label, p_equipment_type, p_category)
  ON CONFLICT (tenant_id, symptom_key) DO UPDATE SET
    occurrence_count = workflow_symptoms.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

-- D4. upsert_workflow_failure (origin: 20260410200000)
CREATE OR REPLACE FUNCTION public.upsert_workflow_failure(
  p_tenant_id UUID, p_failure_key TEXT, p_failure_label TEXT,
  p_equipment_type TEXT
) RETURNS UUID LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.workflow_failures (tenant_id, failure_key, failure_label, equipment_type)
  VALUES (p_tenant_id, p_failure_key, p_failure_label, p_equipment_type)
  ON CONFLICT (tenant_id, failure_key) DO UPDATE SET
    occurrence_count = workflow_failures.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

-- D5. upsert_workflow_diagnostic (origin: 20260410200000)
CREATE OR REPLACE FUNCTION public.upsert_workflow_diagnostic(
  p_tenant_id UUID, p_diagnostic_key TEXT, p_diagnostic_label TEXT,
  p_equipment_type TEXT, p_success BOOLEAN
) RETURNS UUID LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.workflow_diagnostics (tenant_id, diagnostic_key, diagnostic_label, equipment_type, success_count, total_count)
  VALUES (p_tenant_id, p_diagnostic_key, p_diagnostic_label, p_equipment_type, CASE WHEN p_success THEN 1 ELSE 0 END, 1)
  ON CONFLICT (tenant_id, diagnostic_key) DO UPDATE SET
    total_count = workflow_diagnostics.total_count + 1,
    success_count = workflow_diagnostics.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    last_seen_at = now()
  RETURNING id;
$$;

-- D6. upsert_workflow_repair (origin: 20260410200000)
CREATE OR REPLACE FUNCTION public.upsert_workflow_repair(
  p_tenant_id UUID, p_repair_key TEXT, p_repair_label TEXT,
  p_equipment_type TEXT
) RETURNS UUID LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.workflow_repairs (tenant_id, repair_key, repair_label, equipment_type)
  VALUES (p_tenant_id, p_repair_key, p_repair_label, p_equipment_type)
  ON CONFLICT (tenant_id, repair_key) DO UPDATE SET
    occurrence_count = workflow_repairs.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

-- D7. upsert_workflow_outcome (origin: 20260410200000)
CREATE OR REPLACE FUNCTION public.upsert_workflow_outcome(
  p_tenant_id UUID, p_outcome_key TEXT, p_outcome_label TEXT,
  p_outcome_type TEXT
) RETURNS UUID LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.workflow_outcomes (tenant_id, outcome_key, outcome_label, outcome_type)
  VALUES (p_tenant_id, p_outcome_key, p_outcome_label, p_outcome_type)
  ON CONFLICT (tenant_id, outcome_key) DO UPDATE SET
    occurrence_count = workflow_outcomes.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

-- D8. upsert_workflow_edge (origin: 20260410200000)
CREATE OR REPLACE FUNCTION public.upsert_workflow_edge(
  p_tenant_id UUID, p_source_type TEXT, p_source_id UUID,
  p_target_type TEXT, p_target_id UUID, p_edge_type TEXT
) RETURNS UUID LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.workflow_intelligence_edges
    (tenant_id, source_type, source_id, target_type, target_id, edge_type)
  VALUES (p_tenant_id, p_source_type, p_source_id, p_target_type, p_target_id, p_edge_type)
  ON CONFLICT (tenant_id, source_type, source_id, target_type, target_id, edge_type) DO UPDATE SET
    frequency = workflow_intelligence_edges.frequency + 1,
    last_seen_at = now()
  RETURNING id;
$$;

-- D9. aggregate_diagnostic_patterns (origin: 20260415000000)
CREATE OR REPLACE FUNCTION public.aggregate_diagnostic_patterns(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  row_count INTEGER := 0;
BEGIN
  INSERT INTO public.workflow_diagnostic_statistics
    (tenant_id, symptom, failure_component, repair_action, equipment_type,
     occurrence_count, success_count, success_rate, confidence_score, last_calculated_at)
  SELECT
    ws.tenant_id,
    ws.symptom_key,
    wf.failure_key,
    wr.repair_key,
    ws.equipment_type,
    SUM(e_sf.frequency),
    COALESCE(SUM(
      CASE WHEN wo.outcome_type = 'resolved' THEN e_ro.frequency ELSE 0 END
    ), 0),
    CASE
      WHEN COALESCE(SUM(e_ro.frequency), 0) > 0
      THEN COALESCE(SUM(
        CASE WHEN wo.outcome_type = 'resolved' THEN e_ro.frequency ELSE 0 END
      ), 0)::float / SUM(e_ro.frequency)
      ELSE 0.0
    END,
    LEAST(1.0 - EXP(-0.1 * SUM(e_sf.frequency)), 0.99),
    now()
  FROM public.workflow_intelligence_edges e_sf
  JOIN public.workflow_symptoms ws
    ON e_sf.source_id = ws.id AND e_sf.source_type = 'symptom'
  JOIN public.workflow_failures wf
    ON e_sf.target_id = wf.id AND e_sf.target_type = 'failure'
  JOIN public.workflow_intelligence_edges e_fr
    ON e_fr.source_id = wf.id AND e_fr.source_type = 'failure'
    AND e_fr.target_type = 'repair' AND e_fr.edge_type = 'repaired_by'
  JOIN public.workflow_repairs wr
    ON e_fr.target_id = wr.id
  LEFT JOIN public.workflow_intelligence_edges e_ro
    ON e_ro.source_id = wr.id AND e_ro.source_type = 'repair'
    AND e_ro.target_type = 'outcome' AND e_ro.edge_type = 'resulted_in'
  LEFT JOIN public.workflow_outcomes wo
    ON e_ro.target_id = wo.id
  WHERE ws.tenant_id = p_tenant_id
    AND e_sf.edge_type = 'leads_to'
  GROUP BY ws.tenant_id, ws.symptom_key, wf.failure_key, wr.repair_key, ws.equipment_type
  ON CONFLICT (tenant_id, symptom, failure_component, repair_action) DO UPDATE SET
    occurrence_count = EXCLUDED.occurrence_count,
    success_count = EXCLUDED.success_count,
    success_rate = EXCLUDED.success_rate,
    confidence_score = EXCLUDED.confidence_score,
    equipment_type = EXCLUDED.equipment_type,
    last_calculated_at = now();

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count;
END;
$$;
