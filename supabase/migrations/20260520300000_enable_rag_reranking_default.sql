-- ============================================================
-- Enable rag_reranking by default
-- ============================================================
-- Cross-encoder reranking via Cohere rerank-v3.5 is already
-- integrated in supabase/functions/field-assistant/rerank.ts
-- with a graceful fallback path if the API call fails. The flag
-- was seeded OFF for a gradual rollout in
-- 20260325000000_rerank_and_content_aware_chunking.sql. Flipping
-- it ON materially improves retrieval quality for technical
-- queries (model numbers, fault codes, part numbers) which raw
-- cosine similarity ranks poorly.
--
-- Blocked/allowed tenant overrides are untouched — tenants that
-- have intentionally been placed on blocked_tenant_ids remain
-- blocked; tenants in allowed_tenant_ids already get the feature
-- regardless of rollout_percentage.
-- ============================================================

UPDATE public.feature_flags
SET
  is_enabled = true,
  rollout_percentage = 100
WHERE key = 'rag_reranking'
  AND is_enabled = false;  -- no-op if the flag is already on (an already-enabled
                           -- partial rollout keeps its current percentage);
                           -- per-tenant blocked_tenant_ids remain the way to
                           -- explicitly disable for individual tenants
