-- ============================================================
-- Workflow Templates System — Phase 1: Core Tables
-- ============================================================
-- Creates the workflow template + execution model for FieldTek.
-- Integrates with: scheduled_jobs, workflow_step_evidence,
-- tenants, auth.users, compliance_rules (via stage_name).
--
-- V1: Linear step sequences only. Stage names locked to
-- ['Startup', 'Service', 'Maintenance', 'Inspection'].
-- ============================================================

-- 1. workflow_templates — Admin-defined workflow definitions
CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('installation', 'repair', 'maintenance', 'inspection', 'diagnostic')),
  equipment_type TEXT,
  equipment_model TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested', 'manufacturer')),
  source_document_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  estimated_duration_minutes INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow templates"
  ON public.workflow_templates FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage workflow templates"
  ON public.workflow_templates FOR ALL
  USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

CREATE INDEX idx_workflow_templates_tenant_equipment
  ON public.workflow_templates (tenant_id, equipment_type);

CREATE INDEX idx_workflow_templates_tenant_category
  ON public.workflow_templates (tenant_id, category);

CREATE INDEX idx_workflow_templates_tenant_published
  ON public.workflow_templates (tenant_id, is_published)
  WHERE is_published = true AND is_active = true;


-- 2. workflow_template_steps — Linear step sequence within a template
CREATE TABLE public.workflow_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  stage_name TEXT NOT NULL CHECK (stage_name IN ('Startup', 'Service', 'Maintenance', 'Inspection')),
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  instruction_detail TEXT,
  media_urls TEXT[],
  step_type TEXT NOT NULL DEFAULT 'action' CHECK (step_type IN ('action', 'inspection', 'measurement', 'decision')),
  required_inputs JSONB NOT NULL DEFAULT '{}',
  evidence_requirements JSONB NOT NULL DEFAULT '{}',
  validation_rules JSONB NOT NULL DEFAULT '{}',
  estimated_minutes INTEGER,
  safety_warning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, step_number)
);

ALTER TABLE public.workflow_template_steps ENABLE ROW LEVEL SECURITY;

-- RLS via join to parent workflow_templates
CREATE POLICY "Users can view workflow steps"
  ON public.workflow_template_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_templates wt
      WHERE wt.id = workflow_id
        AND wt.tenant_id = public.get_user_tenant_id()
    )
  );

CREATE POLICY "Admins can manage workflow steps"
  ON public.workflow_template_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_templates wt
      WHERE wt.id = workflow_id
        AND wt.tenant_id = public.get_user_tenant_id()
        AND public.is_tenant_admin()
    )
  );

CREATE INDEX idx_workflow_steps_workflow
  ON public.workflow_template_steps (workflow_id, step_number);


-- 3. workflow_executions — Tracks a technician executing a workflow on a job
CREATE TABLE public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.workflow_templates(id),
  job_id UUID NOT NULL REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'paused', 'completed', 'aborted')),
  current_step_number INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  abort_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow executions"
  ON public.workflow_executions FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can create workflow executions"
  ON public.workflow_executions FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Members can update own workflow executions"
  ON public.workflow_executions FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE INDEX idx_workflow_executions_job
  ON public.workflow_executions (job_id);

CREATE INDEX idx_workflow_executions_workflow
  ON public.workflow_executions (workflow_id);

CREATE INDEX idx_workflow_executions_technician_status
  ON public.workflow_executions (technician_id, status);

CREATE INDEX idx_workflow_executions_tenant_status
  ON public.workflow_executions (tenant_id, status);

-- One active (non-terminal) execution per job
CREATE UNIQUE INDEX idx_workflow_executions_active_job
  ON public.workflow_executions (job_id)
  WHERE status IN ('not_started', 'in_progress', 'paused');


-- 4. workflow_step_executions — Per-step execution data
CREATE TABLE public.workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.workflow_template_steps(id),
  step_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  technician_notes TEXT,
  measurement_value DOUBLE PRECISION,
  measurement_unit TEXT,
  serial_number TEXT,
  photos TEXT[],
  gps_location JSONB,
  custom_inputs JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_step_executions ENABLE ROW LEVEL SECURITY;

-- RLS via join to parent workflow_executions
CREATE POLICY "Users can view step executions"
  ON public.workflow_step_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      WHERE we.id = execution_id
        AND we.tenant_id = public.get_user_tenant_id()
    )
  );

CREATE POLICY "Members can create step executions"
  ON public.workflow_step_executions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      WHERE we.id = execution_id
        AND we.tenant_id = public.get_user_tenant_id()
    )
  );

CREATE POLICY "Members can update step executions"
  ON public.workflow_step_executions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workflow_executions we
      WHERE we.id = execution_id
        AND we.tenant_id = public.get_user_tenant_id()
    )
  );

CREATE INDEX idx_step_executions_execution
  ON public.workflow_step_executions (execution_id, step_number);

CREATE INDEX idx_step_executions_step
  ON public.workflow_step_executions (step_id);
