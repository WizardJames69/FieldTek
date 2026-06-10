-- ============================================================
-- search_document_chunks: return page_number + section_name
-- ============================================================
-- Extends the RPC return table so the retrieval adapter can
-- carry page + section through to the field-assistant response
-- metadata. No filter parameters change — callers keep working
-- without code modification until they opt into the new fields.
-- ============================================================

-- PostgreSQL rejects CREATE OR REPLACE when the result type changes
-- (42P13), and adding columns to RETURNS TABLE changes the result
-- type. Drop the existing 11-arg definition first; this file runs in
-- a single transaction, so there is no window where the RPC is gone.
DROP FUNCTION IF EXISTS public.search_document_chunks(
  uuid, vector, integer, double precision, text, text, text[], text, text, text, text
);

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
    CASE
      WHEN v_tsquery IS NOT NULL AND dc.search_vector @@ v_tsquery THEN
        0.7 * (1 - (dc.embedding <=> p_query_embedding)) +
        0.3 * ts_rank(dc.search_vector, v_tsquery)
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
        0.7 * (1 - (dc.embedding <=> p_query_embedding)) +
        0.3 * ts_rank(dc.search_vector, v_tsquery)
      ELSE
        1 - (dc.embedding <=> p_query_embedding)
    END DESC
  LIMIT p_match_count;
END;
$$;
