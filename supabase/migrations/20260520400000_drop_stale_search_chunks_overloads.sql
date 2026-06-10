-- ============================================================
-- Drop stale search_document_chunks overloads
-- ============================================================
-- Each time parameters were added to search_document_chunks
-- (20260225000000: +keyword/equipment/chunk_types,
--  20260310000000: +brand/model/category/embedding_model), the new
-- CREATE OR REPLACE had a different signature and therefore created a
-- NEW overload instead of replacing the old one. Three overloads are
-- live: 4-arg, 7-arg, and the current 11-arg.
--
-- No working caller can depend on the stale ones: a call supplying
-- only the 4- or 7-arg named-parameter set is AMBIGUOUS across the
-- overloads (defaults make all candidates match) and fails with
-- PostgREST PGRST203 — so dropping them cannot break anything, and
-- it un-breaks short calls by making them resolve to the 11-arg
-- definition via defaults. The only production caller
-- (field-assistant/retrieval.ts) passes all 11 named arguments.
-- ============================================================

DROP FUNCTION IF EXISTS public.search_document_chunks(
  uuid, vector, integer, double precision
);

DROP FUNCTION IF EXISTS public.search_document_chunks(
  uuid, vector, integer, double precision, text, text, text[]
);
