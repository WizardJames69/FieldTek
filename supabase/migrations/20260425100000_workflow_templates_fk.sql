-- ============================================================
-- Workflow Templates System — Phase 1b: FK Additions
-- ============================================================
-- Links existing tables to the new workflow execution model.
-- ============================================================

-- Link jobs to their active workflow execution
ALTER TABLE public.scheduled_jobs
  ADD COLUMN IF NOT EXISTS workflow_execution_id UUID
    REFERENCES public.workflow_executions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_workflow_execution
  ON public.scheduled_jobs (workflow_execution_id)
  WHERE workflow_execution_id IS NOT NULL;

-- Link evidence records to specific workflow step executions
ALTER TABLE public.workflow_step_evidence
  ADD COLUMN IF NOT EXISTS step_execution_id UUID
    REFERENCES public.workflow_step_executions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_step_evidence_step_execution
  ON public.workflow_step_evidence (step_execution_id)
  WHERE step_execution_id IS NOT NULL;
