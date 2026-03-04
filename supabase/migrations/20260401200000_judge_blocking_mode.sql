-- ============================================================
-- Phase 8D: Judge Blocking Mode
-- ============================================================
-- Adds feature flag for progressive rollout of judge warning
-- mode and a verdict column to track blocking decisions.
-- ============================================================

-- ── Feature Flag ──────────────────────────────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES (
  'judge_blocking_mode',
  'Judge Blocking Mode',
  'When enabled, if the judge returns grounded=false AND confidence >= 4, a disclaimer warning is appended to the AI response. Does NOT block responses — only appends a notice.',
  false,
  10
)
ON CONFLICT (key) DO NOTHING;

-- ── Audit Column ──────────────────────────────────────────────

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS judge_verdict TEXT
    CHECK (judge_verdict IS NULL OR judge_verdict IN ('none', 'pass', 'warn_appended'));

COMMENT ON COLUMN public.ai_audit_logs.judge_verdict
  IS 'Result of judge blocking evaluation: none=not evaluated, pass=grounded or low confidence, warn_appended=disclaimer injected into response';
