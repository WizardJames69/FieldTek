-- ============================================================
-- Retry Stranded-Pending Documents
-- ============================================================
-- Extends retry_stuck_documents() to recover rows where
-- extract-document-text was invoked but crashed/timed-out before
-- it could flip extraction_status from 'pending' to 'processing'.
-- Such rows are invisible to the existing 'processing'-targeted
-- retry logic and would stay pending forever.
--
-- Strategy: 10 minutes after the documents row was created, if
-- still extraction_status = 'pending', re-trigger the
-- extract-document-text edge function via pg_net (up to 3 tries).
-- After max retries, mark extraction_status='failed' so the UI
-- surfaces the stuck state instead of hiding it.
-- ============================================================

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

  -- ── Re-trigger stuck embedding jobs (existing behavior) ────
  FOR v_doc IN
    SELECT id, retry_count
    FROM public.documents
    WHERE extraction_status = 'completed'
      AND embedding_status = 'processing'
      AND processing_started_at IS NOT NULL
      AND processing_started_at < now() - v_stuck_threshold
      AND retry_count < v_max_retries
    ORDER BY processing_started_at ASC
    LIMIT 5
  LOOP
    UPDATE public.documents
    SET retry_count = retry_count + 1,
        processing_started_at = now(),
        last_error = NULL
    WHERE id = v_doc.id;

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

  -- ── Re-trigger pending-stranded extraction jobs (new) ──────
  -- Rows that never made it past the initial 'pending' write-through
  -- (upload dialog inserted 'pending', extract-document-text was
  -- invoked but crashed before flipping to 'processing').
  FOR v_doc IN
    SELECT id, retry_count
    FROM public.documents
    WHERE extraction_status = 'pending'
      AND created_at < now() - v_stuck_threshold
      AND retry_count < v_max_retries
    ORDER BY created_at ASC
    LIMIT 5
  LOOP
    UPDATE public.documents
    SET retry_count = retry_count + 1,
        processing_started_at = now(),
        last_error = NULL
    WHERE id = v_doc.id;

    SELECT net.http_post(
      url     := v_project_url || '/functions/v1/extract-document-text',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := jsonb_build_object('documentId', v_doc.id::text, 'mode', 'document')
    ) INTO v_request_id;

    RAISE NOTICE '[retry_stuck_documents] Retrying extraction for pending-stranded document % (attempt %, pg_net %)',
      v_doc.id, v_doc.retry_count + 1, v_request_id;
  END LOOP;

  -- ── Mark permanently failed: embedding (existing) ──────────
  UPDATE public.documents
  SET embedding_status = 'failed',
      last_error = 'Exceeded maximum retry attempts (' || v_max_retries || ') for embedding generation'
  WHERE extraction_status = 'completed'
    AND embedding_status = 'processing'
    AND processing_started_at IS NOT NULL
    AND processing_started_at < now() - v_stuck_threshold
    AND retry_count >= v_max_retries;

  -- ── Mark permanently failed: extraction (processing-stuck) ─
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

  -- ── Mark permanently failed: extraction (pending-stranded) ─
  -- If even the retries couldn't flip 'pending' to 'processing',
  -- mark failed so the UI and operators see the stuck state.
  -- The processing_started_at guard keeps this from racing the
  -- final retry queued above in the same run: the retry loop sets
  -- processing_started_at = now(), so a just-retried row is given
  -- a full stuck-threshold window before being declared dead
  -- (created_at alone is immutable and would fail it immediately).
  UPDATE public.documents
  SET extraction_status = 'failed',
      last_error = 'Exceeded maximum retry attempts (' || v_max_retries || ') while document was stranded in pending'
  WHERE extraction_status = 'pending'
    AND created_at < now() - v_stuck_threshold
    AND retry_count >= v_max_retries
    AND (processing_started_at IS NULL
         OR processing_started_at < now() - v_stuck_threshold);

END;
$$;

REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM anon;
