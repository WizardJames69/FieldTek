-- ============================================================
-- Regression: hybrid similarity scoring correction (P3a guard)
-- Migration: 20260703000000_fix_hybrid_similarity_blend.sql
-- ============================================================
--
-- WHY THIS IS A STANDALONE SQL ARTIFACT (documented limitation)
-- ------------------------------------------------------------
-- This repo has NO database test harness (no pgTAP, no supabase/tests runner;
-- vitest only covers frontend/pure TS). This file is a MANUAL regression
-- script. Run it against a LOCAL or SHADOW database only (e.g. `supabase db
-- start` then `supabase db query --local -f
-- supabase/tests/hybrid_similarity_blend_regression.sql`) AFTER applying the
-- migration there. DO NOT run against the canonical fgem backend: Part B
-- INSERTs synthetic rows (fully transactional, ends in ROLLBACK, persists
-- nothing) but should never touch real project data.
--
-- WHAT IT PROVES
-- --------------
-- With the corrected search_document_chunks definition:
--   1. A keyword-matching chunk's reported similarity is NEVER lower than its
--      raw cosine similarity (the old 0.7*cos + 0.3*ts_rank blend depressed
--      keyword matches by up to ~30% because unnormalized ts_rank ~ 0.01-0.1).
--   2. A keyword-matching chunk never ranks BELOW an equal-cosine chunk that
--      does not match the keywords.
--   3. The raw-cosine WHERE floor is unchanged: a chunk below
--      p_match_threshold stays excluded even on a perfect keyword match
--      (scoring correction, NOT a threshold relaxation).
-- ============================================================

BEGIN;
DO $$
DECLARE
  v_tenant uuid := gen_random_uuid();
  v_doc    uuid := gen_random_uuid();
  -- 3-dim logic embedded in a padded vector; the live column is vector(1536),
  -- so build unit-ish vectors with zeros beyond the first components.
  v_query  vector;
  r_match  record;
  v_raw_cosine double precision;
BEGIN
  -- Synthetic tenant + document (minimal required columns).
  INSERT INTO public.tenants (id, name, slug) VALUES (v_tenant, 'REGRESSION blend', 'reg-blend-'||v_tenant);
  INSERT INTO public.documents (id, tenant_id, name, category)
  VALUES (v_doc, v_tenant, 'Blend Regression Doc', 'Manual');

  -- Query embedding: e1 (first component 1, rest 0).
  v_query := (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '1' ELSE '0' END, ',') || ']')
              FROM generate_series(1, 1536) i)::vector;

  -- Chunk A: cosine 0.8 vs query ([0.8, 0.6, 0...]), text LEXICALLY matches
  -- the keyword query "airflow specification".
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'The nominal airflow specification for this air handler unit is 1200 CFM at 0.5 in. w.c. external static pressure. '
      || repeat('Additional airflow specification detail. ', 8),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.8' WHEN i = 2 THEN '0.6' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- Chunk B: cosine 0.8 vs query, does NOT match the keyword query.
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'Compressor electrical ratings and wiring diagram notes. ' || repeat('Unrelated content. ', 10),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.8' WHEN i = 3 THEN '0.6' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- Chunk C: cosine ~0.5 (below the 0.6 floor) but PERFECT keyword match —
  -- must remain excluded (WHERE floor unchanged).
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'airflow specification airflow specification airflow specification ' || repeat('airflow specification ', 10),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.5' WHEN i = 4 THEN '0.866' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- 1 + 2: keyword-matching chunk A reports similarity >= raw cosine (0.8)
  -- and ranks at least as high as equal-cosine non-matching chunk B.
  v_raw_cosine := 0.8;
  SELECT * INTO r_match
  FROM public.search_document_chunks(
    p_tenant_id := v_tenant,
    p_query_embedding := v_query,
    p_match_count := 10,
    p_match_threshold := 0.6,
    p_keyword_query := 'airflow specification'
  ) s
  WHERE s.chunk_text LIKE 'The nominal airflow%';

  IF r_match IS NULL THEN
    RAISE EXCEPTION 'FAIL: keyword-matching chunk A was not retrieved at all';
  END IF;
  IF r_match.similarity < v_raw_cosine - 0.000001 THEN
    RAISE EXCEPTION 'FAIL: keyword match DEPRESSED similarity: reported % < raw cosine % (old blend behavior)',
      r_match.similarity, v_raw_cosine;
  END IF;
  RAISE NOTICE 'PASS: keyword-matching chunk reported similarity % >= raw cosine %', r_match.similarity, v_raw_cosine;

  IF EXISTS (
    SELECT 1
    FROM public.search_document_chunks(
      p_tenant_id := v_tenant, p_query_embedding := v_query,
      p_match_count := 10, p_match_threshold := 0.6,
      p_keyword_query := 'airflow specification'
    ) s
    WHERE s.chunk_text LIKE 'Compressor electrical%'
      AND s.similarity > r_match.similarity + 0.000001
  ) THEN
    RAISE EXCEPTION 'FAIL: non-matching equal-cosine chunk outranks the keyword match';
  END IF;
  RAISE NOTICE 'PASS: keyword match ranks >= equal-cosine non-match';

  -- 3: below-floor chunk stays excluded even on a perfect keyword match.
  IF EXISTS (
    SELECT 1
    FROM public.search_document_chunks(
      p_tenant_id := v_tenant, p_query_embedding := v_query,
      p_match_count := 10, p_match_threshold := 0.6,
      p_keyword_query := 'airflow specification'
    ) s
    WHERE s.chunk_text LIKE 'airflow specification airflow%'
  ) THEN
    RAISE EXCEPTION 'FAIL: below-floor chunk was rescued by keyword match (threshold relaxation!)';
  END IF;
  RAISE NOTICE 'PASS: raw-cosine WHERE floor unchanged (below-floor keyword match still excluded)';

  RAISE NOTICE 'ALL BLEND REGRESSION CASES PASSED';
END $$;
ROLLBACK;
