-- ============================================================
-- Citation Groundwork: page_number + section_name on chunks
-- ============================================================
-- Adds two nullable columns to document_chunks so citations can
-- eventually point to a page and a section inside the source
-- document. Existing rows stay NULL; no backfill. The chunker
-- (supabase/functions/_shared/chunking.ts) is updated to emit
-- these fields for new ingestions.
--
-- Vision-fallback PDFs (image-based) will keep page_number NULL
-- in this pass — per-page extraction there requires a separate
-- change to the vision pipeline.
-- ============================================================

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS page_number INTEGER,
  ADD COLUMN IF NOT EXISTS section_name TEXT;

COMMENT ON COLUMN public.document_chunks.page_number
  IS 'Source page number (1-indexed) preserved from per-page PDF extraction. NULL for scanned/vision-extracted PDFs or chunks ingested before this column existed.';
COMMENT ON COLUMN public.document_chunks.section_name
  IS 'Heading of the section this chunk was cut from, if the chunker detected one. NULL otherwise.';
