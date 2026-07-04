-- ============================================================
-- search_document_chunks: hybrid similarity scoring correction
-- ============================================================
-- SCORING CORRECTION, NOT A THRESHOLD RELAXATION.
--
-- Problem: the previous definition reported, for any chunk whose
-- search_vector matched plainto_tsquery(p_keyword_query):
--
--     similarity = 0.7 * cosine + 0.3 * ts_rank(...)
--
-- ts_rank() is unnormalized and in practice tiny (~0.01–0.1) while cosine
-- similarity for retrieved chunks is 0.6–0.9, so the "hybrid boost" was
-- mathematically a PENALTY: a lexical match cut the reported similarity by
-- up to ~30% (raw cosine 0.87 → reported ~0.61). Because the edge function
-- always passes the raw user query as p_keyword_query, the MOST on-topic
-- chunks were systematically depressed — ranked below purely-semantic
-- matches and pushed under downstream similarity gates (single-chunk 0.8
-- floor, escalation 0.65 floor), producing false over-abstention on
-- grounded questions.
--
-- Fix: reported similarity becomes
--
--     GREATEST(cosine, 0.7 * cosine + 0.3 * ts_rank_normalized)
--
-- with ts_rank normalization flag 32 (rank/(rank+1) → 0..1). A lexical
-- match can now only ever HELP a chunk's score, never hurt it. ORDER BY
-- uses the same expression so ranking matches reporting.
--
-- Unchanged on purpose:
--   * The WHERE floor stays raw cosine > p_match_threshold — inclusion
--     semantics and the 0.6 default floor are identical to before.
--   * Signature is identical (no DROP needed — avoids the historical
--     overload ambiguity); tenant scoping / SECURITY DEFINER unchanged.
--   * keyword_rank column keeps returning raw (unnormalized) ts_rank, as
--     before, for observability continuity.
-- ============================================================

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
  embedding_model text,
  page_number integer,
  section_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id cannot be NULL';
  END IF;

  IF current_setting('role', true) != 'service_role' THEN
    IF p_tenant_id != get_user_tenant_id() THEN
      RAISE EXCEPTION 'Access denied: User does not belong to the requested tenant';
    END IF;
  END IF;

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
    -- Scoring correction: a keyword match may only ever raise the reported
    -- similarity above raw cosine, never lower it (see file header).
    -- ts_rank flag 32 normalizes rank to 0..1 so the 0.3 weight is meaningful.
    CASE
      WHEN v_tsquery IS NOT NULL AND dc.search_vector @@ v_tsquery THEN
        GREATEST(
          1 - (dc.embedding <=> p_query_embedding),
          0.7 * (1 - (dc.embedding <=> p_query_embedding)) +
          0.3 * ts_rank(dc.search_vector, v_tsquery, 32)
        )
      ELSE
        1 - (dc.embedding <=> p_query_embedding)
    END AS similarity,
    CASE
      WHEN v_tsquery IS NOT NULL AND dc.search_vector @@ v_tsquery THEN
        ts_rank(dc.search_vector, v_tsquery)
      ELSE
        NULL::double precision
    END AS keyword_rank,
    dc.chunk_type,
    dc.brand,
    dc.model,
    dc.embedding_model,
    dc.page_number,
    dc.section_name
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.tenant_id = p_tenant_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
    AND (p_equipment_type IS NULL OR dc.equipment_type = p_equipment_type)
    AND (p_chunk_types IS NULL OR dc.chunk_type = ANY(p_chunk_types))
    AND (p_brand IS NULL OR dc.brand = p_brand)
    AND (p_model IS NULL OR dc.model = p_model)
    AND (p_document_category IS NULL OR dc.document_category = p_document_category)
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
  ORDER BY
    CASE
      WHEN v_tsquery IS NOT NULL AND dc.search_vector @@ v_tsquery THEN
        GREATEST(
          1 - (dc.embedding <=> p_query_embedding),
          0.7 * (1 - (dc.embedding <=> p_query_embedding)) +
          0.3 * ts_rank(dc.search_vector, v_tsquery, 32)
        )
      ELSE
        1 - (dc.embedding <=> p_query_embedding)
    END DESC
  LIMIT p_match_count;
END;
$$;
