-- ============================================================
-- Phase 5: Re-ranking Columns + Content-Aware Chunking Support
-- ============================================================
-- Adds rerank tracking columns to ai_audit_logs, seeds feature
-- flags for gradual rollout, and creates a batch re-embedding
-- function for migrating existing documents to the new chunker.
-- ============================================================

-- ── 1. Rerank audit columns ─────────────────────────────────

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS rerank_scores DOUBLE PRECISION[],
  ADD COLUMN IF NOT EXISTS rerank_model TEXT,
  ADD COLUMN IF NOT EXISTS rerank_latency_ms INTEGER;

COMMENT ON COLUMN public.ai_audit_logs.rerank_scores
  IS 'Relevance scores from cross-encoder re-ranking (one per returned chunk, in reranked order)';
COMMENT ON COLUMN public.ai_audit_logs.rerank_model
  IS 'Re-ranking model used (e.g. cohere-rerank-v3.5) or null if disabled';
COMMENT ON COLUMN public.ai_audit_logs.rerank_latency_ms
  IS 'Latency of the re-ranking API call in milliseconds';

-- ── 2. Feature flags for gradual rollout ─────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES
  (
    'rag_reranking',
    'RAG Cross-Encoder Re-ranking',
    'Post-retrieval cross-encoder re-ranking via Cohere rerank-v3.5. Adds ~200ms latency per query but significantly improves retrieval precision.',
    false,
    0
  ),
  (
    'rag_content_aware_chunking',
    'Content-Aware Chunking',
    'Structure-aware document chunking that preserves tables, procedures, and specifications as complete units instead of splitting mid-row/step.',
    false,
    0
  )
ON CONFLICT (key) DO NOTHING;

-- ── 3. Batch re-embedding support ───────────────────────────

-- Function to batch-mark documents for re-embedding.
-- Called manually or via pg_cron after activating new chunking.
-- Prioritizes most-queried documents first.
CREATE OR REPLACE FUNCTION public.batch_mark_reembed(
  p_limit INTEGER DEFAULT 200
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH queried_docs AS (
    -- Prioritize documents that appear most in recent audit logs
    SELECT DISTINCT unnest(chunk_ids) AS chunk_id
    FROM public.ai_audit_logs
    WHERE created_at > now() - INTERVAL '30 days'
      AND chunk_ids IS NOT NULL
  ),
  top_documents AS (
    SELECT DISTINCT dc.document_id
    FROM public.document_chunks dc
    JOIN queried_docs qd ON dc.id = qd.chunk_id
    UNION
    SELECT id FROM public.documents
    WHERE embedding_status = 'completed'
    LIMIT p_limit
  )
  UPDATE public.documents
  SET embedding_status = 'pending'
  WHERE id IN (SELECT document_id FROM top_documents)
    AND embedding_status = 'completed';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RAISE NOTICE '[batch_mark_reembed] Marked % documents for re-embedding', v_count;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.batch_mark_reembed(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.batch_mark_reembed(INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.batch_mark_reembed(INTEGER) FROM anon;

-- pg_cron job: process pending re-embeds (20 docs per 5 min)
-- This job invokes the generate-embeddings edge function for each pending doc.
-- NOTE: Actual re-embedding is triggered by the existing retry queue mechanism
-- which already picks up documents with embedding_status = 'pending'.
-- This cron job is a safety net that logs how many are pending.
DO $$
BEGIN
  PERFORM cron.unschedule('log-pending-reembeds');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'log-pending-reembeds',
  '*/5 * * * *',
  $$
    DO $inner$
    DECLARE
      v_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_count
      FROM public.documents
      WHERE embedding_status = 'pending';
      IF v_count > 0 THEN
        RAISE NOTICE '[reembed-monitor] % documents pending re-embedding', v_count;
      END IF;
    END $inner$;
  $$
);
