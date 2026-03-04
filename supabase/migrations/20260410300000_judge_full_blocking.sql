-- ============================================================
-- Phase 9D: Judge Full Blocking Mode
-- ============================================================
-- Adds 'blocked' to judge_verdict CHECK constraint and creates
-- the judge_full_blocking feature flag.
-- ============================================================

-- ── 1. Feature Flag ──────────────────────────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES (
  'judge_full_blocking',
  'Judge Full Blocking Mode',
  'Replaces ungrounded AI responses (confidence >= 5) with a safe fallback instead of appending a disclaimer.',
  false,
  5
)
ON CONFLICT (key) DO NOTHING;

-- ── 2. Expand judge_verdict CHECK ────────────────────────────

ALTER TABLE public.ai_audit_logs
  DROP CONSTRAINT IF EXISTS ai_audit_logs_judge_verdict_check;

ALTER TABLE public.ai_audit_logs
  ADD CONSTRAINT ai_audit_logs_judge_verdict_check
  CHECK (judge_verdict IS NULL OR judge_verdict IN ('none', 'pass', 'warn_appended', 'blocked'));

COMMENT ON COLUMN public.ai_audit_logs.judge_verdict
  IS 'Result of judge evaluation: none=not evaluated, pass=grounded or low confidence, warn_appended=disclaimer injected, blocked=response replaced with safe fallback';
