-- ============================================================
-- IVFFlat → HNSW Index Migration
-- ============================================================
-- IVFFlat(lists=100) degrades silently at scale and requires
-- manual REINDEX. HNSW is self-maintaining with ~99% recall
-- vs IVFFlat's ~90-95%.
--
-- Zero-downtime migration:
--   1. Build HNSW CONCURRENTLY (no table lock)
--   2. Drop old IVFFlat (planner switches automatically)
--
-- Parameters:
--   m=16              — bi-directional links per node (good default for 1536-dim)
--   ef_construction=64 — build-time quality (higher = better recall, slower build)
--
-- Build time estimate:
--   ~10 minutes for 10K vectors, ~2 hours for 500K vectors
--
-- Verify after migration:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'document_chunks' AND indexdef LIKE '%hnsw%';
--
--   EXPLAIN ANALYZE
--   SELECT id FROM document_chunks
--   ORDER BY embedding <=> '[0.1,0.2,...]'::vector LIMIT 10;
--   -- Should show: "Index Scan using idx_document_chunks_embedding_hnsw"
-- ============================================================

-- Build HNSW index concurrently (zero table lock)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Drop the old IVFFlat index — planner will switch to HNSW
DROP INDEX IF EXISTS idx_document_chunks_embedding;
