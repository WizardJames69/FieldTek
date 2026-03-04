-- ============================================================
-- Phase 9C: Workflow Intelligence Graph
-- ============================================================
-- Creates 6 tables for diagnostic learning from completed jobs:
--   workflow_symptoms, workflow_failures, workflow_diagnostics,
--   workflow_repairs, workflow_outcomes, workflow_intelligence_edges
-- Plus aggregation views, indexes, RLS, and feature flag.
-- ============================================================

-- ── 1. workflow_symptoms ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  symptom_key TEXT NOT NULL,
  symptom_label TEXT NOT NULL,
  equipment_type TEXT,
  category TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, symptom_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_symptoms_tenant ON public.workflow_symptoms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_symptoms_equipment ON public.workflow_symptoms(equipment_type);

-- ── 2. workflow_failures ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  failure_key TEXT NOT NULL,
  failure_label TEXT NOT NULL,
  equipment_type TEXT,
  component_id UUID REFERENCES public.equipment_components(id) ON DELETE SET NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, failure_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_failures_tenant ON public.workflow_failures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_failures_equipment ON public.workflow_failures(equipment_type);

-- ── 3. workflow_diagnostics ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  diagnostic_key TEXT NOT NULL,
  diagnostic_label TEXT NOT NULL,
  equipment_type TEXT,
  success_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 1,
  avg_duration_minutes DOUBLE PRECISION,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, diagnostic_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_diagnostics_tenant ON public.workflow_diagnostics(tenant_id);

-- ── 4. workflow_repairs ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  repair_key TEXT NOT NULL,
  repair_label TEXT NOT NULL,
  equipment_type TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  avg_cost DOUBLE PRECISION,
  common_parts TEXT[],
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, repair_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_repairs_tenant ON public.workflow_repairs(tenant_id);

-- ── 5. workflow_outcomes ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  outcome_key TEXT NOT NULL,
  outcome_label TEXT NOT NULL,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN (
    'resolved', 'escalated', 'repeat_visit', 'parts_ordered', 'warranty_claim'
  )),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, outcome_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_outcomes_tenant ON public.workflow_outcomes(tenant_id);

-- ── 6. workflow_intelligence_edges ────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_intelligence_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('symptom', 'failure', 'diagnostic', 'repair', 'outcome')),
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('symptom', 'failure', 'diagnostic', 'repair', 'outcome')),
  target_id UUID NOT NULL,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('leads_to', 'diagnosed_by', 'repaired_by', 'resulted_in')),
  frequency INTEGER NOT NULL DEFAULT 1,
  probability DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, source_type, source_id, target_type, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_wie_source ON public.workflow_intelligence_edges(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_wie_tenant ON public.workflow_intelligence_edges(tenant_id);

-- ── 7. Views ──────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.workflow_failure_paths AS
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

CREATE OR REPLACE VIEW public.workflow_diagnostic_success AS
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

-- ── 8. RLS ────────────────────────────────────────────────────

ALTER TABLE public.workflow_symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_intelligence_edges ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by Edge Functions)
-- Authenticated users can SELECT their own tenant's data

CREATE POLICY "Tenant members can view workflow symptoms"
  ON public.workflow_symptoms FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can view workflow failures"
  ON public.workflow_failures FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can view workflow diagnostics"
  ON public.workflow_diagnostics FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can view workflow repairs"
  ON public.workflow_repairs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can view workflow outcomes"
  ON public.workflow_outcomes FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Tenant members can view workflow edges"
  ON public.workflow_intelligence_edges FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- ── 9. Upsert Helper Functions ────────────────────────────────
-- These handle atomic upsert + increment for workflow nodes/edges.
-- Using ON CONFLICT DO UPDATE with occurrence_count + 1.

CREATE OR REPLACE FUNCTION public.upsert_workflow_symptom(
  p_tenant_id UUID, p_symptom_key TEXT, p_symptom_label TEXT,
  p_equipment_type TEXT, p_category TEXT
) RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO public.workflow_symptoms (tenant_id, symptom_key, symptom_label, equipment_type, category)
  VALUES (p_tenant_id, p_symptom_key, p_symptom_label, p_equipment_type, p_category)
  ON CONFLICT (tenant_id, symptom_key) DO UPDATE SET
    occurrence_count = workflow_symptoms.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.upsert_workflow_failure(
  p_tenant_id UUID, p_failure_key TEXT, p_failure_label TEXT,
  p_equipment_type TEXT
) RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO public.workflow_failures (tenant_id, failure_key, failure_label, equipment_type)
  VALUES (p_tenant_id, p_failure_key, p_failure_label, p_equipment_type)
  ON CONFLICT (tenant_id, failure_key) DO UPDATE SET
    occurrence_count = workflow_failures.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.upsert_workflow_diagnostic(
  p_tenant_id UUID, p_diagnostic_key TEXT, p_diagnostic_label TEXT,
  p_equipment_type TEXT, p_success BOOLEAN
) RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO public.workflow_diagnostics (tenant_id, diagnostic_key, diagnostic_label, equipment_type, success_count, total_count)
  VALUES (p_tenant_id, p_diagnostic_key, p_diagnostic_label, p_equipment_type, CASE WHEN p_success THEN 1 ELSE 0 END, 1)
  ON CONFLICT (tenant_id, diagnostic_key) DO UPDATE SET
    total_count = workflow_diagnostics.total_count + 1,
    success_count = workflow_diagnostics.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    last_seen_at = now()
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.upsert_workflow_repair(
  p_tenant_id UUID, p_repair_key TEXT, p_repair_label TEXT,
  p_equipment_type TEXT
) RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO public.workflow_repairs (tenant_id, repair_key, repair_label, equipment_type)
  VALUES (p_tenant_id, p_repair_key, p_repair_label, p_equipment_type)
  ON CONFLICT (tenant_id, repair_key) DO UPDATE SET
    occurrence_count = workflow_repairs.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.upsert_workflow_outcome(
  p_tenant_id UUID, p_outcome_key TEXT, p_outcome_label TEXT,
  p_outcome_type TEXT
) RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO public.workflow_outcomes (tenant_id, outcome_key, outcome_label, outcome_type)
  VALUES (p_tenant_id, p_outcome_key, p_outcome_label, p_outcome_type)
  ON CONFLICT (tenant_id, outcome_key) DO UPDATE SET
    occurrence_count = workflow_outcomes.occurrence_count + 1,
    last_seen_at = now()
  RETURNING id;
$$;

CREATE OR REPLACE FUNCTION public.upsert_workflow_edge(
  p_tenant_id UUID, p_source_type TEXT, p_source_id UUID,
  p_target_type TEXT, p_target_id UUID, p_edge_type TEXT
) RETURNS UUID LANGUAGE sql AS $$
  INSERT INTO public.workflow_intelligence_edges
    (tenant_id, source_type, source_id, target_type, target_id, edge_type)
  VALUES (p_tenant_id, p_source_type, p_source_id, p_target_type, p_target_id, p_edge_type)
  ON CONFLICT (tenant_id, source_type, source_id, target_type, target_id, edge_type) DO UPDATE SET
    frequency = workflow_intelligence_edges.frequency + 1,
    last_seen_at = now()
  RETURNING id;
$$;

-- ── 10. Feature Flag ─────────────────────────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES (
  'workflow_intelligence',
  'Workflow Intelligence Graph',
  'Collects diagnostic patterns from completed jobs to build probabilistic failure path graphs.',
  false,
  0
)
ON CONFLICT (key) DO NOTHING;
