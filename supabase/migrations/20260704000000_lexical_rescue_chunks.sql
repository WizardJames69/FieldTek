-- ============================================================
-- lexical_rescue_chunks: strict lexical rescue for semantic
-- under-retrieval (P3b v1)
-- ============================================================
-- THIS IS NOT A GLOBAL THRESHOLD DROP.
--
-- search_document_chunks keeps its raw-cosine floor (default 0.6) untouched —
-- this migration does not modify that function or its semantics in any way.
--
-- Problem: terse technician phrasings ("what is the Nominal airflow") can
-- embed at a raw cosine at/below the semantic floor against the very chunk
-- that literally contains the answer, producing semantic_count=0 and a false
-- abstain even though the document holds the exact terms. Measured live on
-- the pilot tenant 2026-07-04.
--
-- Rescue rule: a chunk may be retrieved below the semantic floor ONLY when it
-- carries strong, strict lexical evidence for the query:
--   * search_vector @@ plainto_tsquery('english', p_keyword_query) — an
--     AND-match: EVERY content lexeme of the query must appear in the chunk.
--     OR / partial / coverage-ratio matching is deliberately NOT implemented;
--     live calibration showed a plausible-bait query's partial-match rank is
--     indistinguishable from a true full-match rank (both 0.09), so rank
--     alone must never rescue.
--   * at least p_min_lexemes (default 2) content lexemes in the query — a
--     one-word/generic query never rescues anything.
--   * normalized ts_rank (flag 32 → rank/(rank+1), 0..1) >= p_min_rank.
--   * raw cosine > p_min_cosine (default 0.35) — a loose topical-relatedness
--     bound so a lexical coincidence in an unrelated document cannot rescue.
--   * hard cap of 2 returned chunks regardless of p_max_results.
--
-- The caller (field-assistant) invokes this ONLY when the semantic pass
-- returned fewer than MIN_RELEVANT_CHUNKS for a non-escalation query, passes
-- the RAW user query (never the graph-enriched keyword query), and runs the
-- rescued chunks through the same injection/lesson filters and the full
-- post-LLM citation validation as semantically retrieved chunks.
--
-- Tenant scoping and SECURITY DEFINER guard are copied verbatim from
-- search_document_chunks.
--
-- Rollback: DROP FUNCTION public.lexical_rescue_chunks(uuid, vector, text,
--   double precision, double precision, integer, integer, uuid[]);
-- (safe — only the field-assistant edge function calls it, and the paired
-- edge-function rollback is a redeploy of the previous version).
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
    ts_rank(dc.search_vector, v_tsquery, 32) AS lexical_rank,
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
