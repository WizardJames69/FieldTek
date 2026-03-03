-- ============================================================
-- Phase 1.1: Correlation ID Propagation + Embedding Model Versioning
-- ============================================================
-- Adds correlation_id to documents and document_chunks for
-- end-to-end tracing across ingestion → embedding → retrieval → audit.
-- Adds embedding_model + embedding_dimensions to document_chunks
-- for safe embedding model migrations.
--
-- ai_audit_logs.correlation_id already exists (migration 20260221120000)
-- but is auto-generated. Edge functions will now set it explicitly.
-- ============================================================


-- ── 1. Correlation ID on documents ─────────────────────────────

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS correlation_id UUID;


-- ── 2. Correlation ID on document_chunks ───────────────────────

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

CREATE INDEX IF NOT EXISTS idx_document_chunks_correlation_id
  ON public.document_chunks(correlation_id)
  WHERE correlation_id IS NOT NULL;


-- ── 3. Embedding model versioning on document_chunks ───────────

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER NOT NULL DEFAULT 1536;

COMMENT ON COLUMN public.document_chunks.embedding_model
  IS 'Embedding model name used to generate this chunk vector. Must match query embedding model for valid similarity.';

COMMENT ON COLUMN public.document_chunks.embedding_dimensions
  IS 'Dimensionality of the embedding vector. Used for model migration validation.';
