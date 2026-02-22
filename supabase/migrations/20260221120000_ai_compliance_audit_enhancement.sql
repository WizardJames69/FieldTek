-- ============================================================
-- Enhance ai_audit_logs for compliance-grade traceability
-- ============================================================
-- Adds columns needed for full audit trail:
-- - correlation_id: links audit log to conversation messages and feedback
-- - chunk_ids / similarity_scores: which chunks were retrieved and how relevant
-- - system_prompt_hash: SHA-256 of the system prompt version used
-- - retrieval_quality_score: 0-100 score based on chunk count and similarity
-- - token counts: prompt and response token estimates
-- - human_review_*: flags for high-stakes interactions requiring human review
-- - injection_detected: whether prompt injection was detected in the request
-- - semantic_search_count: number of chunks returned from vector search
-- - response_modified: whether the response was modified (e.g., disclaimer appended)

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS correlation_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS chunk_ids UUID[],
  ADD COLUMN IF NOT EXISTS similarity_scores DOUBLE PRECISION[],
  ADD COLUMN IF NOT EXISTS system_prompt_hash TEXT,
  ADD COLUMN IF NOT EXISTS retrieval_quality_score INTEGER,
  ADD COLUMN IF NOT EXISTS token_count_prompt INTEGER,
  ADD COLUMN IF NOT EXISTS token_count_response INTEGER,
  ADD COLUMN IF NOT EXISTS human_review_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_review_reasons TEXT[],
  ADD COLUMN IF NOT EXISTS human_review_status TEXT,
  ADD COLUMN IF NOT EXISTS injection_detected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS semantic_search_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_modified BOOLEAN DEFAULT false;

-- Index for human review queue (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_human_review
  ON public.ai_audit_logs(human_review_required, human_review_status)
  WHERE human_review_required = true;

-- Index for correlation lookups (feedback → audit log → conversation)
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_correlation
  ON public.ai_audit_logs(correlation_id);

-- Index for injection tracking dashboard
CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_injection
  ON public.ai_audit_logs(injection_detected)
  WHERE injection_detected = true;
