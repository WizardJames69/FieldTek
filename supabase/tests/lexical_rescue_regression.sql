-- ============================================================
-- Regression: strict lexical rescue retrieval (P3b guard)
-- Migration: 20260704000000_lexical_rescue_chunks.sql
-- ============================================================
--
-- WHY THIS IS A STANDALONE SQL ARTIFACT (documented limitation)
-- ------------------------------------------------------------
-- Same rationale as hybrid_similarity_blend_regression.sql: this repo has NO
-- database test harness, so this file is a MANUAL regression script. Run it
-- against a LOCAL or SHADOW database only (e.g. `supabase db start` then
-- `supabase db query --local -f
-- supabase/tests/lexical_rescue_regression.sql`) AFTER applying the
-- migration there. DO NOT run against the canonical fgem backend: Part B
-- INSERTs synthetic rows (fully transactional, ends in ROLLBACK, persists
-- nothing) but should never touch real project data.
--
-- WHAT IT PROVES
-- --------------
-- lexical_rescue_chunks is a STRICT, NARROW rescue — not a threshold drop:
--   0. RETURN-TYPE REGRESSION (fixed in 20260705000000): the function actually
--      returns a row without raising ERROR 42804 "Returned type real does not
--      match expected type double precision in column 7 (lexical_rank)". Case 1
--      is the guard — it SELECTs a returned row and reads r_row.lexical_rank,
--      which only executes if RETURN QUERY's exact-type check passed. The
--      original 20260704000000 body threw here (ts_rank returns real, column
--      declared double precision); running this script against a shadow DB
--      would have caught it before deploy.
--   1. A chunk below the semantic floor IS rescued when it AND-matches every
--      content lexeme of the query (and clears the rank/cosine floors).
--   2. A PARTIAL keyword match (some but not all lexemes) is NEVER rescued —
--      OR/rank-only matching does not exist in this path.
--   3. A 1-lexeme query rescues nothing (numnode lexeme gate).
--   4. Cosine <= p_min_cosine (0.35) is never rescued even on a perfect
--      AND-match.
--   5. The rank floor parameter is enforced.
--   6. At most 2 chunks are returned even when more qualify (hard cap).
--   7. Cross-tenant chunks are never returned.
--   8. p_exclude_chunk_ids is respected (no duplicate of a semantic hit).
--   9. A Trane-style bait query (extra absent model lexemes) rescues nothing.
-- ============================================================

BEGIN;
DO $$
DECLARE
  v_tenant  uuid := gen_random_uuid();
  v_tenant2 uuid := gen_random_uuid();
  v_doc     uuid := gen_random_uuid();
  v_doc2    uuid := gen_random_uuid();
  v_query   vector;
  v_chunk_a uuid;
  r_row     record;
  v_count   integer;
BEGIN
  -- Synthetic tenants + documents (minimal required columns).
  INSERT INTO public.tenants (id, name, slug) VALUES
    (v_tenant,  'REGRESSION lexical rescue',    'reg-lexres-'||v_tenant),
    (v_tenant2, 'REGRESSION lexical rescue T2', 'reg-lexres2-'||v_tenant2);
  INSERT INTO public.documents (id, tenant_id, name, category) VALUES
    (v_doc,  v_tenant,  'Lexical Rescue Regression Doc',    'Manual'),
    (v_doc2, v_tenant2, 'Lexical Rescue Regression Doc T2', 'Manual');

  -- Query embedding: e1 (first component 1, rest 0).
  v_query := (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '1' ELSE '0' END, ',') || ']')
              FROM generate_series(1, 1536) i)::vector;

  -- Chunk A: cosine 0.5 vs query — BELOW the 0.6 semantic floor, above the
  -- 0.35 rescue floor. Text AND-matches "airflow specification" and is >200
  -- chars. This is the canonical rescue target.
  -- NOTE: the keyword phrase is repeated 16× (not 8×) so chunk A has the
  -- STRICTLY HIGHEST ts_rank of the three qualifiers (A > D > E). The rescue
  -- path orders by ts_rank DESC and hard-caps at 2, so A must out-rank D/E to
  -- be guaranteed in the returned set for case 1; at 8× A actually ranked
  -- LOWEST (0.4917 vs D 0.4970, E 0.4944) and the cap evicted it. Verified on
  -- a shadow pgvector DB 2026-07-05.
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'The nominal airflow specification for this air handler unit is 1200 CFM at 0.5 in. w.c. external static pressure. '
      || repeat('Additional airflow specification detail. ', 16),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.5' WHEN i = 2 THEN '0.866' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  )
  RETURNING id INTO v_chunk_a;

  -- Chunk B: cosine 0.5, contains 'airflow' but NOT 'specification' →
  -- PARTIAL match, must never be rescued.
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'General airflow notes for the blower assembly. ' || repeat('Unrelated blower narrative content. ', 10),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.5' WHEN i = 3 THEN '0.866' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- Chunk C: PERFECT AND-match but cosine ~0.2 (below the 0.35 rescue floor)
  -- → must never be rescued (lexical evidence alone is not enough).
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'airflow specification ' || repeat('airflow specification ', 12),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.2' WHEN i = 4 THEN '0.9798' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- Chunk D: AND-matches, cosine 0.55 — a second qualifying chunk (for the
  -- cap + ordering assertions).
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'Secondary airflow specification table for high-static installations. ' || repeat('Airflow specification rows. ', 8),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.55' WHEN i = 5 THEN '0.8352' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- Chunk E: AND-matches, cosine 0.45 — a THIRD qualifying chunk. With A and
  -- D this makes 3 qualifiers, proving the hard cap of 2.
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant, v_doc,
    'Historical airflow specification appendix. ' || repeat('Legacy airflow specification data. ', 8),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.45' WHEN i = 6 THEN '0.8930' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- Cross-tenant chunk: perfect AND-match, high cosine, but belongs to
  -- tenant 2 — must never appear in tenant 1 results.
  INSERT INTO public.document_chunks (tenant_id, document_id, chunk_text, embedding)
  VALUES (
    v_tenant2, v_doc2,
    'Tenant-2 airflow specification: 999 CFM. ' || repeat('Tenant-2 airflow specification content. ', 8),
    (SELECT ('[' || string_agg(CASE WHEN i = 1 THEN '0.9' WHEN i = 7 THEN '0.4359' ELSE '0' END, ',') || ']')
     FROM generate_series(1, 1536) i)::vector
  );

  -- 1. Below-semantic-floor chunk A IS rescued on a strict AND-match.
  SELECT * INTO r_row
  FROM public.lexical_rescue_chunks(
    p_tenant_id := v_tenant, p_query_embedding := v_query,
    p_keyword_query := 'airflow specification'
  ) s
  WHERE s.chunk_text LIKE 'The nominal airflow%';
  IF r_row IS NULL THEN
    RAISE EXCEPTION 'FAIL: AND-matching below-floor chunk A was not rescued';
  END IF;
  IF r_row.raw_cosine > 0.51 OR r_row.raw_cosine < 0.49 THEN
    RAISE EXCEPTION 'FAIL: rescued chunk A reports wrong raw cosine % (expected ~0.5, no blend)', r_row.raw_cosine;
  END IF;
  IF r_row.lexical_rank < 0.05 THEN
    RAISE EXCEPTION 'FAIL: rescued chunk A lexical_rank % below the 0.05 floor — floor not meaningful', r_row.lexical_rank;
  END IF;
  RAISE NOTICE 'PASS: strict AND-match rescues below-floor chunk (cos=%, rank=%)', r_row.raw_cosine, r_row.lexical_rank;

  -- 2. PARTIAL match (chunk B: has airflow, lacks specification) never rescued.
  IF EXISTS (
    SELECT 1 FROM public.lexical_rescue_chunks(
      p_tenant_id := v_tenant, p_query_embedding := v_query,
      p_keyword_query := 'airflow specification'
    ) s WHERE s.chunk_text LIKE 'General airflow notes%'
  ) THEN
    RAISE EXCEPTION 'FAIL: partial keyword match was rescued (OR-matching behavior!)';
  END IF;
  RAISE NOTICE 'PASS: partial match excluded (strict AND only)';

  -- 3. 1-lexeme query rescues nothing (numnode gate).
  SELECT count(*) INTO v_count
  FROM public.lexical_rescue_chunks(
    p_tenant_id := v_tenant, p_query_embedding := v_query,
    p_keyword_query := 'airflow'
  );
  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL: 1-lexeme query rescued % chunk(s) — generic terms must never rescue', v_count;
  END IF;
  RAISE NOTICE 'PASS: 1-lexeme query rescues nothing';

  -- 4. Perfect AND-match below the 0.35 cosine floor (chunk C) never rescued.
  IF EXISTS (
    SELECT 1 FROM public.lexical_rescue_chunks(
      p_tenant_id := v_tenant, p_query_embedding := v_query,
      p_keyword_query := 'airflow specification'
    ) s WHERE s.chunk_text LIKE 'airflow specification airflow%'
  ) THEN
    RAISE EXCEPTION 'FAIL: chunk below the 0.35 cosine floor was rescued by keyword match alone';
  END IF;
  RAISE NOTICE 'PASS: cosine floor holds even on a perfect AND-match';

  -- 5. Rank floor parameter is enforced (impossibly high floor → nothing).
  SELECT count(*) INTO v_count
  FROM public.lexical_rescue_chunks(
    p_tenant_id := v_tenant, p_query_embedding := v_query,
    p_keyword_query := 'airflow specification', p_min_rank := 0.99
  );
  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL: rank floor not enforced (% row(s) at p_min_rank=0.99)', v_count;
  END IF;
  RAISE NOTICE 'PASS: rank floor parameter enforced';

  -- 6. Hard cap: 3 chunks qualify (A, D, E) but at most 2 return — even when
  --    the caller asks for more.
  SELECT count(*) INTO v_count
  FROM public.lexical_rescue_chunks(
    p_tenant_id := v_tenant, p_query_embedding := v_query,
    p_keyword_query := 'airflow specification', p_max_results := 10
  );
  IF v_count > 2 THEN
    RAISE EXCEPTION 'FAIL: hard cap of 2 not enforced (% rows returned)', v_count;
  END IF;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 rescued chunks from 3 qualifiers, got %', v_count;
  END IF;
  RAISE NOTICE 'PASS: hard cap of 2 rescued chunks enforced';

  -- 7. Cross-tenant isolation: tenant-2 chunk never appears for tenant 1.
  IF EXISTS (
    SELECT 1 FROM public.lexical_rescue_chunks(
      p_tenant_id := v_tenant, p_query_embedding := v_query,
      p_keyword_query := 'airflow specification'
    ) s WHERE s.chunk_text LIKE 'Tenant-2%'
  ) THEN
    RAISE EXCEPTION 'FAIL: cross-tenant chunk leaked into rescue results';
  END IF;
  RAISE NOTICE 'PASS: cross-tenant isolation holds';

  -- 8. p_exclude_chunk_ids respected: excluding chunk A removes it.
  IF EXISTS (
    SELECT 1 FROM public.lexical_rescue_chunks(
      p_tenant_id := v_tenant, p_query_embedding := v_query,
      p_keyword_query := 'airflow specification',
      p_exclude_chunk_ids := ARRAY[v_chunk_a]
    ) s WHERE s.id = v_chunk_a
  ) THEN
    RAISE EXCEPTION 'FAIL: excluded chunk id was returned (semantic duplicate risk)';
  END IF;
  RAISE NOTICE 'PASS: exclude-chunk-ids respected';

  -- 9. Trane-style bait: extra lexemes absent from every chunk break the
  --    AND-match → nothing rescued.
  SELECT count(*) INTO v_count
  FROM public.lexical_rescue_chunks(
    p_tenant_id := v_tenant, p_query_embedding := v_query,
    p_keyword_query := 'nominal airflow specification Trane XR16'
  );
  IF v_count != 0 THEN
    RAISE EXCEPTION 'FAIL: bait query with absent model lexemes rescued % chunk(s)', v_count;
  END IF;
  RAISE NOTICE 'PASS: bait query (absent model lexemes) rescues nothing';

  RAISE NOTICE 'ALL LEXICAL RESCUE REGRESSION CASES PASSED';
END $$;
ROLLBACK;
