-- ============================================================
-- Pragmatic RAG Improvements (6 changes)
-- ============================================================
-- 1. Hybrid search: tsvector column + GIN index on document_chunks
-- 2. Equipment type propagation on document_chunks
-- 3. Chunk type classification on document_chunks
-- 4. Resolution notes on scheduled_jobs
-- 5. Diagnostic data JSONB on ai_audit_logs
-- 6. Updated search_document_chunks() RPC with hybrid scoring,
--    equipment type filter, and chunk type filter

-- ── 1. Full-text search vector ─────────────────────────────────
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Auto-populate on insert/update
CREATE OR REPLACE FUNCTION public.document_chunks_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.chunk_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_chunks_search_vector ON public.document_chunks;
CREATE TRIGGER trg_document_chunks_search_vector
  BEFORE INSERT OR UPDATE OF chunk_text ON public.document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.document_chunks_search_vector_trigger();

-- Backfill existing rows
UPDATE public.document_chunks
  SET search_vector = to_tsvector('english', COALESCE(chunk_text, ''))
  WHERE search_vector IS NULL;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_document_chunks_fts
  ON public.document_chunks USING gin(search_vector);

-- ── 2. Equipment type on chunks ────────────────────────────────
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS equipment_type TEXT;

CREATE INDEX IF NOT EXISTS idx_document_chunks_equipment_type
  ON public.document_chunks(equipment_type)
  WHERE equipment_type IS NOT NULL;

-- ── 3. Chunk type classification ───────────────────────────────
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS chunk_type TEXT NOT NULL DEFAULT 'narrative';

COMMENT ON COLUMN public.document_chunks.chunk_type
  IS 'Content type: narrative, table, procedure, specification';

-- ── 4. Resolution notes on jobs ────────────────────────────────
ALTER TABLE public.scheduled_jobs
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

COMMENT ON COLUMN public.scheduled_jobs.resolution_notes
  IS 'Technician-entered resolution summary at job completion. Used for future AI learning loop.';

-- ── 5. Diagnostic data on audit logs ───────────────────────────
ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS diagnostic_data JSONB;

-- ── 6. Updated search RPC with hybrid scoring ──────────────────
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_tenant_id uuid,
  p_query_embedding vector,
  p_match_count integer DEFAULT 10,
  p_match_threshold double precision DEFAULT 0.5,
  p_keyword_query text DEFAULT NULL,
  p_equipment_type text DEFAULT NULL,
  p_chunk_types text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_text text,
  document_name text,
  document_category text,
  similarity double precision,
  keyword_rank double precision,
  chunk_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Reject NULL tenant_id to prevent accidentally returning all tenants' data
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id cannot be NULL';
  END IF;

  -- For non-service-role callers, verify tenant ownership
  IF current_setting('role', true) != 'service_role' THEN
    IF p_tenant_id != get_user_tenant_id() THEN
      RAISE EXCEPTION 'Access denied: User does not belong to the requested tenant';
    END IF;
  END IF;

  -- Build tsquery if keyword search requested
  IF p_keyword_query IS NOT NULL AND length(trim(p_keyword_query)) > 0 THEN
    v_tsquery := plainto_tsquery('english', p_keyword_query);
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    d.name AS document_name,
    d.category AS document_category,
    -- Hybrid similarity: blend vector + keyword when keyword query is active
    CASE
      WHEN v_tsquery IS NOT NULL AND dc.search_vector @@ v_tsquery THEN
        0.7 * (1 - (dc.embedding <=> p_query_embedding)) +
        0.3 * ts_rank(dc.search_vector, v_tsquery)
      ELSE
        1 - (dc.embedding <=> p_query_embedding)
    END AS similarity,
    -- Expose raw keyword rank for diagnostics (NULL when no keyword query)
    CASE
      WHEN v_tsquery IS NOT NULL AND dc.search_vector @@ v_tsquery THEN
        ts_rank(dc.search_vector, v_tsquery)
      ELSE
        NULL::double precision
    END AS keyword_rank,
    dc.chunk_type
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.tenant_id = p_tenant_id
    AND dc.embedding IS NOT NULL
    -- Apply similarity threshold on the raw vector distance (pre-hybrid blend)
    AND (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    -- Optional equipment type filter
    AND (p_equipment_type IS NULL OR dc.equipment_type = p_equipment_type)
    -- Optional chunk type filter
    AND (p_chunk_types IS NULL OR dc.chunk_type = ANY(p_chunk_types))
  ORDER BY
    -- Sort by the hybrid score when keyword query is active, else pure vector
    CASE
      WHEN v_tsquery IS NOT NULL AND dc.search_vector @@ v_tsquery THEN
        0.7 * (1 - (dc.embedding <=> p_query_embedding)) +
        0.3 * ts_rank(dc.search_vector, v_tsquery)
      ELSE
        1 - (dc.embedding <=> p_query_embedding)
    END DESC
  LIMIT p_match_count;
END;
$$;
