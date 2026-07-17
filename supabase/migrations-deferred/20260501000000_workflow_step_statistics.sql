-- ============================================================
-- Workflow Step Statistics — Aggregated Intelligence
-- ============================================================
-- Pre-computed step-level success rates and average durations.
-- Enables Sentinel AI to prefer historically effective steps
-- when guiding technicians through workflows.
--
-- Populated by collect-workflow-intelligence edge function
-- via the upsert_workflow_step_statistic RPC.
-- ============================================================

CREATE TABLE public.workflow_step_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.workflow_template_steps(id) ON DELETE SET NULL,
  equipment_type TEXT NOT NULL DEFAULT '',
  equipment_model TEXT NOT NULL DEFAULT '',
  total_executions INTEGER NOT NULL DEFAULT 0,
  resolved_count INTEGER NOT NULL DEFAULT 0,
  improved_count INTEGER NOT NULL DEFAULT 0,
  no_change_count INTEGER NOT NULL DEFAULT 0,
  worsened_count INTEGER NOT NULL DEFAULT 0,
  success_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_duration_seconds DOUBLE PRECISION,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, workflow_id, step_id, equipment_type, equipment_model)
);

ALTER TABLE public.workflow_step_statistics ENABLE ROW LEVEL SECURITY;

-- SELECT-only for tenant members (service role bypasses RLS for INSERT/UPDATE via RPC)
CREATE POLICY "Tenant members can view step statistics"
  ON public.workflow_step_statistics FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_step_statistics_tenant_workflow
  ON public.workflow_step_statistics (tenant_id, workflow_id);

CREATE INDEX idx_step_statistics_step
  ON public.workflow_step_statistics (step_id);

CREATE INDEX idx_step_statistics_equipment
  ON public.workflow_step_statistics (equipment_type, equipment_model)
  WHERE equipment_type != '';

-- ── RPC: Atomic upsert with running average ─────────────────

CREATE OR REPLACE FUNCTION public.upsert_workflow_step_statistic(
  p_tenant_id UUID,
  p_workflow_id UUID,
  p_step_id UUID,
  p_equipment_type TEXT,
  p_equipment_model TEXT,
  p_outcome_type TEXT,
  p_duration_seconds DOUBLE PRECISION
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_equip TEXT := COALESCE(p_equipment_type, '');
  v_model TEXT := COALESCE(p_equipment_model, '');
BEGIN
  INSERT INTO workflow_step_statistics (
    tenant_id, workflow_id, step_id, equipment_type, equipment_model,
    total_executions, resolved_count, improved_count, no_change_count, worsened_count,
    success_rate, avg_duration_seconds)
  VALUES (
    p_tenant_id, p_workflow_id, p_step_id, v_equip, v_model,
    1,
    (p_outcome_type = 'resolved')::int,
    (p_outcome_type = 'improved')::int,
    (p_outcome_type = 'no_change')::int,
    (p_outcome_type = 'worsened')::int,
    (p_outcome_type = 'resolved')::int::float,
    p_duration_seconds)
  ON CONFLICT (tenant_id, workflow_id, step_id, equipment_type, equipment_model)
  DO UPDATE SET
    total_executions = workflow_step_statistics.total_executions + 1,
    resolved_count   = workflow_step_statistics.resolved_count + (p_outcome_type = 'resolved')::int,
    improved_count   = workflow_step_statistics.improved_count + (p_outcome_type = 'improved')::int,
    no_change_count  = workflow_step_statistics.no_change_count + (p_outcome_type = 'no_change')::int,
    worsened_count   = workflow_step_statistics.worsened_count + (p_outcome_type = 'worsened')::int,
    success_rate     = (workflow_step_statistics.resolved_count + (p_outcome_type = 'resolved')::int)::float
                       / (workflow_step_statistics.total_executions + 1),
    avg_duration_seconds = CASE
      WHEN p_duration_seconds IS NOT NULL THEN
        COALESCE(workflow_step_statistics.avg_duration_seconds, 0)
        + (p_duration_seconds - COALESCE(workflow_step_statistics.avg_duration_seconds, 0))
        / (workflow_step_statistics.total_executions + 1)
      ELSE workflow_step_statistics.avg_duration_seconds END,
    last_updated = now();
END;
$$;
