-- ============================================================
-- Phase 1.2: Retrieval Observability Metrics
-- ============================================================
-- Expands ai_audit_logs with granular retrieval quality metrics.
-- Creates a materialized view (rag_quality_daily) for dashboard.
-- Adds pg_cron hourly refresh for the materialized view.
-- ============================================================


-- ── 1. New audit log columns ───────────────────────────────────

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS max_similarity DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_similarity DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS min_similarity DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS keyword_match_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS citation_density DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS abstain_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS chunk_types_retrieved TEXT[],
  ADD COLUMN IF NOT EXISTS retrieval_backend TEXT DEFAULT 'pgvector',
  ADD COLUMN IF NOT EXISTS gateway_used TEXT DEFAULT 'primary';


-- ── 2. Materialized view for daily quality dashboard ───────────

CREATE MATERIALIZED VIEW IF NOT EXISTS public.rag_quality_daily AS
SELECT
  DATE(created_at) AS day,
  tenant_id,
  COUNT(*) AS total_queries,
  COUNT(*) FILTER (WHERE abstain_flag = true) AS abstain_count,
  COUNT(*) FILTER (WHERE response_blocked = true) AS blocked_count,
  COUNT(*) FILTER (WHERE had_citations = true) AS cited_count,
  COUNT(*) FILTER (WHERE human_review_required = true) AS review_count,
  AVG(retrieval_quality_score) AS avg_rq_score,
  AVG(max_similarity) AS avg_max_similarity,
  AVG(avg_similarity) AS avg_avg_similarity,
  AVG(semantic_search_count) AS avg_chunk_count,
  AVG(citation_density) AS avg_citation_density,
  AVG(response_time_ms) AS avg_response_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_response_time_ms,
  AVG(token_count_prompt) AS avg_prompt_tokens,
  AVG(token_count_response) AS avg_response_tokens
FROM public.ai_audit_logs
WHERE created_at > now() - INTERVAL '90 days'
GROUP BY DATE(created_at), tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_quality_daily_pk
  ON public.rag_quality_daily(day, tenant_id);


-- ── 3. Schedule hourly refresh (CONCURRENTLY = no read lock) ───

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-rag-quality-daily');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job refresh-rag-quality-daily not found, skipping unschedule';
END $$;

SELECT cron.schedule(
  'refresh-rag-quality-daily',
  '0 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.rag_quality_daily; $$
);
