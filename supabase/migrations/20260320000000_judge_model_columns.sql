-- ============================================================
-- Phase 4: Judge Model Columns on ai_audit_logs
-- ============================================================
-- Adds columns for async post-generation grounding evaluation.
-- The judge runs AFTER the response is streamed to the user,
-- then UPDATEs these columns on the existing audit log row.
-- ============================================================

-- Judge evaluation result columns
ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS judge_grounded BOOLEAN,
  ADD COLUMN IF NOT EXISTS judge_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS judge_contradiction BOOLEAN,
  ADD COLUMN IF NOT EXISTS judge_explanation TEXT,
  ADD COLUMN IF NOT EXISTS judge_model TEXT,
  ADD COLUMN IF NOT EXISTS judge_latency_ms INTEGER;

-- Add constraint: confidence must be 1-5 when set
ALTER TABLE public.ai_audit_logs
  ADD CONSTRAINT chk_judge_confidence
  CHECK (judge_confidence IS NULL OR (judge_confidence >= 1 AND judge_confidence <= 5));

-- Index for quality analysis queries (only rows that have been judged)
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_judge_grounded
  ON public.ai_audit_logs(judge_grounded)
  WHERE judge_grounded IS NOT NULL;

-- Composite index for dashboard queries: grounding rate by tenant over time
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_judge_tenant_date
  ON public.ai_audit_logs(tenant_id, created_at)
  WHERE judge_grounded IS NOT NULL;

-- Seed the rag_judge feature flag (disabled by default)
INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES (
  'rag_judge',
  'RAG Judge Model',
  'Async post-generation grounding evaluation using a lightweight judge model. Logs grounding, confidence, and contradiction scores to ai_audit_logs.',
  false,
  0
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN public.ai_audit_logs.judge_grounded
  IS 'Whether the AI response is grounded in retrieved chunks (true=all claims supported, false=some claims unsupported)';
COMMENT ON COLUMN public.ai_audit_logs.judge_confidence
  IS 'Judge confidence in its grounding assessment (1=very uncertain, 5=very confident)';
COMMENT ON COLUMN public.ai_audit_logs.judge_contradiction
  IS 'Whether the AI response contradicts information in the retrieved chunks';
COMMENT ON COLUMN public.ai_audit_logs.judge_explanation
  IS 'Brief explanation from the judge model about its assessment';
COMMENT ON COLUMN public.ai_audit_logs.judge_model
  IS 'Model used for judge evaluation (e.g. gpt-4.1-mini)';
COMMENT ON COLUMN public.ai_audit_logs.judge_latency_ms
  IS 'Latency of the judge evaluation API call in milliseconds';
