-- ============================================================
-- Ingestion Retry Queue
-- ============================================================
-- Adds retry tracking to the document processing pipeline and
-- a pg_cron worker that detects stuck documents and re-triggers
-- the embedding generation edge function.
--
-- Problem:
--   extract-document-text fire-and-forgets to generate-embeddings.
--   If either crashes, the document stays in 'processing' forever.
--   No retry, no alert, no admin visibility.
--
-- Solution:
--   1. Add tracking columns: processing_started_at, retry_count, last_error
--   2. pg_cron job every 5 minutes: find stuck documents, re-trigger or fail
--
-- Prerequisites:
--   - pg_net enabled (done in 20260228200000)
--   - pg_cron enabled (done in 20260228200000)
--   - vault secrets: supabase_project_url, service_role_key
-- ============================================================


-- ── 1. Add retry tracking columns ────────────────────────────

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

COMMENT ON COLUMN public.documents.processing_started_at
  IS 'Timestamp when extraction or embedding processing last started. Used by retry worker to detect stuck documents.';
COMMENT ON COLUMN public.documents.retry_count
  IS 'Number of times the retry worker has re-triggered processing for this document. Max 3.';
COMMENT ON COLUMN public.documents.last_error
  IS 'Last error message from a failed processing attempt. Visible in admin UI.';


-- ── 2. Partial index for the retry worker query ──────────────

CREATE INDEX IF NOT EXISTS idx_documents_stuck_processing
  ON public.documents(processing_started_at)
  WHERE extraction_status = 'processing' OR embedding_status = 'processing';


-- ── 3. Retry worker function ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.retry_stuck_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url  TEXT;
  v_service_key  TEXT;
  v_doc          RECORD;
  v_request_id   BIGINT;
  v_max_retries  CONSTANT INTEGER := 3;
  v_stuck_threshold CONSTANT INTERVAL := '10 minutes';
BEGIN
  -- Read secrets from vault
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING '[retry_stuck_documents] Missing vault secrets — skipping';
    RETURN;
  END IF;

  -- ── Re-trigger stuck embedding jobs ────────────────────────
  -- Documents where extraction completed but embedding is stuck
  FOR v_doc IN
    SELECT id, retry_count
    FROM public.documents
    WHERE extraction_status = 'completed'
      AND embedding_status = 'processing'
      AND processing_started_at IS NOT NULL
      AND processing_started_at < now() - v_stuck_threshold
      AND retry_count < v_max_retries
    ORDER BY processing_started_at ASC
    LIMIT 5  -- Max 5 per cycle to avoid overloading the embedding API
  LOOP
    -- Increment retry count and reset timer
    UPDATE public.documents
    SET retry_count = retry_count + 1,
        processing_started_at = now(),
        last_error = NULL
    WHERE id = v_doc.id;

    -- Re-trigger generate-embeddings via pg_net
    SELECT net.http_post(
      url     := v_project_url || '/functions/v1/generate-embeddings',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object('documentId', v_doc.id::text)
    ) INTO v_request_id;

    RAISE NOTICE '[retry_stuck_documents] Retrying embeddings for document % (attempt %, pg_net %)',
      v_doc.id, v_doc.retry_count + 1, v_request_id;
  END LOOP;

  -- ── Mark permanently failed: embedding ─────────────────────
  UPDATE public.documents
  SET embedding_status = 'failed',
      last_error = 'Exceeded maximum retry attempts (' || v_max_retries || ') for embedding generation'
  WHERE extraction_status = 'completed'
    AND embedding_status = 'processing'
    AND processing_started_at IS NOT NULL
    AND processing_started_at < now() - v_stuck_threshold
    AND retry_count >= v_max_retries;

  -- ── Mark permanently failed: extraction ────────────────────
  -- extraction_status = 'processing' means the function started but never completed.
  -- We can't auto-retry extraction (requires re-downloading the file from Storage),
  -- so we mark as 'failed' for admin review after the threshold.
  UPDATE public.documents
  SET extraction_status = 'failed',
      last_error = CASE
        WHEN retry_count >= v_max_retries
        THEN 'Exceeded maximum retry attempts (' || v_max_retries || ') for text extraction'
        ELSE 'Text extraction timed out after ' || v_stuck_threshold::text
      END
  WHERE extraction_status = 'processing'
    AND processing_started_at IS NOT NULL
    AND processing_started_at < now() - v_stuck_threshold;

END;
$$;

-- Restrict direct RPC access
REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM anon;


-- ── 4. Schedule the retry worker ─────────────────────────────

DO $$
BEGIN
  PERFORM cron.unschedule('retry-stuck-documents');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job retry-stuck-documents not found, skipping unschedule';
END $$;

SELECT cron.schedule(
  'retry-stuck-documents',
  '*/5 * * * *',
  $$ SELECT public.retry_stuck_documents(); $$
);
