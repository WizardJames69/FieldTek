-- ============================================================
-- P3b v1.1: fix lexical_rescue_chunks lexical_rank return type
-- Supersedes the body of 20260704000000_lexical_rescue_chunks.sql
-- ============================================================
-- BUG (found 2026-07-05, pilot founder smoke): every rescue call that matched
-- a row raised
--   ERROR 42804: structure of query does not match function result type
--   DETAIL: Returned type real does not match expected type double precision
--           in column 7.
-- Column 7 is lexical_rank. ts_rank(dc.search_vector, v_tsquery, 32) returns
-- `real` (float4), but the RETURNS TABLE declares lexical_rank as
-- `double precision` (float8), and RETURN QUERY requires an exact type match.
-- field-assistant caught the throw as non-fatal, so the rescue path was inert
-- and every query fell back to the abstain-safe insufficient-coverage path —
-- no LEXICAL_RESCUE tag, no recall gain, but also NO unsafe behavior.
--
-- FIX: cast the returned ts_rank to double precision in the SELECT list — the
-- single expression that maps to the lexical_rank output column. This mirrors
-- how search_document_chunks promotes its keyword_rank via a
-- `... ELSE NULL::double precision END` branch. The ts_rank uses in the WHERE
-- and ORDER BY clauses are numeric comparisons (not returned values) and are
-- left byte-for-byte unchanged.
--
-- NOTHING ELSE CHANGES: identical 8-arg signature, identical RETURNS TABLE
-- shape, SECURITY DEFINER, SET search_path = public, the verbatim tenant
-- guard, the strict search_vector @@ plainto_tsquery AND-match, the numnode
-- lexeme gate, the ts_rank(...,32) >= p_min_rank floor, the raw-cosine
-- > p_min_cosine floor, the exclude-ids filter, the lexical-first ordering,
-- and the hard LIMIT cap of 2. search_document_chunks and the 0.6 semantic
-- floor are untouched.
--
-- Rollback: re-apply 20260704000000_lexical_rescue_chunks.sql (restores the
-- prior, throwing body), or DROP FUNCTION public.lexical_rescue_chunks(uuid,
-- vector, text, double precision, double precision, integer, integer, uuid[]).
-- ============================================================

CREATE OR REPLACE FUNCTION public.lexical_rescue_chunks(
  p_tenant_id uuid,
  p_query_embedding vector,
  p_keyword_query text,
  p_min_cosine double precision DEFAULT 0.35,
  p_min_rank double precision DEFAULT 0.05,
  p_min_lexemes integer DEFAULT 2,
  p_max_results integer DEFAULT 2,
  p_exclude_chunk_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  chunk_text text,
  document_name text,
  document_category text,
  raw_cosine double precision,
  lexical_rank double precision,
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

  IF p_keyword_query IS NULL OR length(trim(p_keyword_query)) = 0 THEN
    RETURN;
  END IF;

  v_tsquery := plainto_tsquery('english', p_keyword_query);

  -- Lexeme gate: plainto_tsquery builds a pure AND tree, so for n lexemes
  -- numnode() = 2n - 1 → lexeme count = (numnode + 1) / 2. Fewer than
  -- p_min_lexemes content lexemes (e.g. a one-word or stopword-only query)
  -- returns nothing — generic single terms must never rescue.
  IF v_tsquery IS NULL OR (numnode(v_tsquery) + 1) / 2 < p_min_lexemes THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    d.name AS document_name,
    d.category AS document_category,
    -- Honest raw cosine (no hybrid blend) — the caller and audit trail see
    -- exactly how semantically weak a rescued chunk is.
    (1 - (dc.embedding <=> p_query_embedding)) AS raw_cosine,
    -- ts_rank returns real; the lexical_rank output column is double precision.
    -- Cast so RETURN QUERY's exact-type check passes (fixes ERROR 42804).
    ts_rank(dc.search_vector, v_tsquery, 32)::double precision AS lexical_rank,
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
    -- Strict AND-match: every content lexeme of the query must be present.
    AND dc.search_vector @@ v_tsquery
    -- Loose topical floor — NOT the semantic floor; rescue below 0.6 is the
    -- whole point, but pure lexical coincidence at near-zero cosine is not.
    AND (1 - (dc.embedding <=> p_query_embedding)) > p_min_cosine
    AND ts_rank(dc.search_vector, v_tsquery, 32) >= p_min_rank
    AND (p_exclude_chunk_ids IS NULL OR dc.id != ALL(p_exclude_chunk_ids))
  ORDER BY
    -- Lexical-first ordering: rescue exists because of keyword evidence, so
    -- the strongest keyword match wins; cosine only breaks ties.
    ts_rank(dc.search_vector, v_tsquery, 32) DESC,
    (1 - (dc.embedding <=> p_query_embedding)) DESC
  -- Hard cap: never more than 2 rescued chunks, whatever the caller asks for.
  LIMIT LEAST(GREATEST(COALESCE(p_max_results, 2), 0), 2);
END;
$$;
