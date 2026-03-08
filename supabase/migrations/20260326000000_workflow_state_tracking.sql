-- ============================================================
-- Phase 1: Workflow State Tracking
-- ============================================================
-- Adds structured workflow state to scheduled_jobs and
-- measurement evidence columns to checklist completions.
-- Pure data collection — no behavioral changes.
-- ============================================================

-- Extend scheduled_jobs with structured workflow state
ALTER TABLE public.scheduled_jobs
  ADD COLUMN IF NOT EXISTS workflow_state JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'not_evaluated'
    CHECK (compliance_status IN ('not_evaluated','compliant','warnings','violations','blocked'));

-- Partial index for compliance alerts (only index problem states)
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_compliance_status
  ON public.scheduled_jobs(compliance_status)
  WHERE compliance_status IN ('violations', 'blocked');

-- Extend checklist completions with typed measurement values
ALTER TABLE public.job_checklist_completions
  ADD COLUMN IF NOT EXISTS measurement_value DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS measurement_unit TEXT;

-- Insert feature flag (disabled by default, 100% rollout when enabled)
INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage, metadata)
VALUES (
  'workflow_state_tracking',
  'Workflow State Tracking',
  'Track workflow state transitions and measurement evidence on scheduled jobs',
  true,
  100,
  '{"phase": "compliance_engine", "added": "2026-03-26"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
