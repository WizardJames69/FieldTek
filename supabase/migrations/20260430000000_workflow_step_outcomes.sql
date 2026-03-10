-- ============================================================
-- Workflow Step Outcomes — Learning Table
-- ============================================================
-- Records per-step outcome data from workflow executions.
-- Enables Sentinel AI to learn which workflow steps actually
-- resolve equipment issues, with measurement data for
-- diagnostic threshold learning.
--
-- Populated by collect-workflow-intelligence edge function
-- when a job completes with a workflow execution.
-- ============================================================

CREATE TABLE public.workflow_step_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.workflow_template_steps(id) ON DELETE SET NULL,
  step_execution_id UUID REFERENCES public.workflow_step_executions(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.scheduled_jobs(id) ON DELETE SET NULL,
  equipment_type TEXT,
  equipment_model TEXT,
  symptom TEXT,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('resolved', 'improved', 'no_change', 'worsened')),
  measurement_value DOUBLE PRECISION,
  measurement_unit TEXT,
  technician_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_step_outcomes ENABLE ROW LEVEL SECURITY;

-- SELECT-only for tenant members (service role bypasses RLS for INSERT)
CREATE POLICY "Tenant members can view step outcomes"
  ON public.workflow_step_outcomes FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_step_outcomes_tenant_workflow
  ON public.workflow_step_outcomes (tenant_id, workflow_id);

CREATE INDEX idx_step_outcomes_symptom
  ON public.workflow_step_outcomes (symptom)
  WHERE symptom IS NOT NULL;

CREATE INDEX idx_step_outcomes_equipment_type
  ON public.workflow_step_outcomes (equipment_type)
  WHERE equipment_type IS NOT NULL;

CREATE INDEX idx_step_outcomes_equipment_model
  ON public.workflow_step_outcomes (equipment_model)
  WHERE equipment_model IS NOT NULL;

CREATE INDEX idx_step_outcomes_step
  ON public.workflow_step_outcomes (step_id);
