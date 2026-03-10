-- ============================================================
-- Workflow Templates System — Feature Flag
-- ============================================================
-- Gates all workflow template UI and Sentinel AI context injection.
-- Disabled by default; enable per-tenant or globally when ready.
-- ============================================================

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage, metadata)
VALUES (
  'workflow_templates',
  'Workflow Templates',
  'Admin-defined workflow templates with step-by-step execution tracking, evidence collection, and Sentinel AI workflow awareness.',
  false,
  0,
  '{"phase": "v1", "tables": ["workflow_templates", "workflow_template_steps", "workflow_executions", "workflow_step_executions"]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
