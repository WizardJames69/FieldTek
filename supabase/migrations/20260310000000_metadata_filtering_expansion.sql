-- ============================================================
-- Phase 2.1: Metadata Filtering Expansion
-- ============================================================
-- Adds brand, model, and document_category to document_chunks
-- for fine-grained retrieval filtering. Updates search RPC
-- with new filter parameters and return columns.
--
-- brand/model are propagated from equipment_registry during
-- embedding generation. document_category comes from the
-- parent documents.category column.
-- ============================================================


-- ── 1. New metadata columns on document_chunks ───────────────

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS document_category TEXT;

-- Partial indexes for common filter patterns (sparse = small)
CREATE INDEX IF NOT EXISTS idx_document_chunks_brand
  ON public.document_chunks(brand)
  WHERE brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_chunks_model
  ON public.document_chunks(model)
  WHERE model IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_category
  ON public.document_chunks(document_category)
  WHERE document_category IS NOT NULL;


-- ── 2. Updated search RPC with new filters + return columns ──

CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_tenant_id uuid,
  p_query_embedding vector,
  p_match_count integer DEFAULT 10,
  p_match_threshold double precision DEFAULT 0.5,
  p_keyword_query text DEFAULT NULL,
  p_equipment_type text DEFAULT NULL,
  p_chunk_types text[] DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_document_category text DEFAULT NULL,
  p_embedding_model text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_text text,
  document_name text,
  document_category text,
  similarity double precision,
  keyword_rank double precision,
  chunk_type text,
  brand text,
  model text,
  embedding_model text
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
    dc.chunk_type,
    dc.brand,
    dc.model,
    dc.embedding_model
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
    -- New metadata filters
    AND (p_brand IS NULL OR dc.brand = p_brand)
    AND (p_model IS NULL OR dc.model = p_model)
    AND (p_document_category IS NULL OR dc.document_category = p_document_category)
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
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
