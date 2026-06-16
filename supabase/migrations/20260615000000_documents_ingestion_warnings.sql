-- PR-1.1 — Surface partial document ingestion.
--
-- Ingestion silently capped large documents in two places (the 100k-char
-- extraction cap and the 500-chunk cap), yet still marked them as fully
-- "ready". This adds a structured, nullable JSONB column so a capped document
-- carries its truncation reasons and the UI can show it as "Partial" instead
-- of silently presenting it as fully indexed.
--
-- Additive and nullable only:
--   * NULL (the default, and the value for every existing row) means "no
--     truncation" — behaviour is unchanged for already-ingested documents.
--   * A non-empty array means the document was only partially extracted/indexed.
--
-- extraction_status intentionally stays 'completed' for capped documents (the
-- text WAS extracted up to the cap); the partial state is derived from this
-- column, so no status enum/CHECK changes are required.
--
-- Shape: [{ "code": "EXTRACTION_TEXT_TRUNCATED" | "CHUNK_LIMIT_REACHED",
--           "message": "...", "limit": <int> }, ...]

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ingestion_warnings jsonb;

COMMENT ON COLUMN public.documents.ingestion_warnings IS
  'Structured ingestion truncation/capping warnings (array of {code,message,limit}). NULL or empty = fully ingested; non-empty = the document was only partially extracted or indexed.';
