-- ============================================================
-- Ingestion Failure Alerting (Phase 0)
-- ============================================================
-- Until now the document retry worker failed silently in two ways:
--   1. Documents that exhaust their 3 retries are marked 'failed'
--      (visible on the Documents page) but nobody is notified. The
--      existing 'Stuck documents' rag_alert_rule does not catch them:
--      it counts rows still in 'processing', which a failed document
--      no longer is — and rag alert metrics land in
--      system_health_metrics, which has no email trigger anyway.
--   2. When the vault secrets (supabase_project_url / service_role_key)
--      are missing or rotated away, the worker logs a WARNING and skips
--      the cycle — invisible to humans, every 5 minutes, forever.
--
-- Fix: insert dedup-guarded rows into public.system_alerts. Its
-- existing AFTER INSERT trigger (trg_notify_critical_alert,
-- 20260228400000/20260228500000) emails via send-health-alert for
-- severity='critical' rows, and the row itself is visible in the
-- admin dashboard.
--
-- Known limitation (documented in docs/RUNBOOK.md): when vault secrets
-- are missing, the email trigger reads the same vault and will fail to
-- deliver — the alert row still lands in system_alerts for dashboard
-- visibility, and the out-of-band GitHub Actions health-monitor
-- workflow remains the true backstop for full vault outages.
--
-- The function body below is the 20260520200000 version (embedding
-- retries + pending-stranded recovery) plus alerting; behavior is
-- otherwise unchanged.
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
  v_failed_embedding  INTEGER := 0;
  v_failed_extraction INTEGER := 0;
  v_failed_pending    INTEGER := 0;
  v_total_failed      INTEGER := 0;
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

    -- Surface the skip instead of failing silently every 5 minutes.
    -- 6-hour dedup window so the cron cadence cannot flood alerts.
    IF NOT EXISTS (
      SELECT 1 FROM public.system_alerts
      WHERE alert_type = 'ingestion_retry_worker_skipped'
        AND resolved_at IS NULL
        AND created_at > now() - INTERVAL '6 hours'
    ) THEN
      INSERT INTO public.system_alerts (alert_type, severity, message, source, metadata)
      VALUES (
        'ingestion_retry_worker_skipped',
        'critical',
        'Document ingestion retry worker is skipping every cycle: vault secrets '
          || 'supabase_project_url / service_role_key are missing. Stuck documents '
          || 'will not be retried until the secrets are restored.',
        'retry_stuck_documents',
        jsonb_build_object(
          'project_url_present', v_project_url IS NOT NULL,
          'service_key_present', v_service_key IS NOT NULL
        )
      );
    END IF;

    RETURN;
  END IF;

  -- ── Re-trigger stuck embedding jobs ────────────────────────
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

  -- ── Re-trigger pending-stranded extraction jobs ────────────
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

  -- ── Mark permanently failed: embedding ─────────────────────
  UPDATE public.documents
  SET embedding_status = 'failed',
      last_error = 'Exceeded maximum retry attempts (' || v_max_retries || ') for embedding generation'
  WHERE extraction_status = 'completed'
    AND embedding_status = 'processing'
    AND processing_started_at IS NOT NULL
    AND processing_started_at < now() - v_stuck_threshold
    AND retry_count >= v_max_retries;
  GET DIAGNOSTICS v_failed_embedding = ROW_COUNT;

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
  GET DIAGNOSTICS v_failed_extraction = ROW_COUNT;

  -- ── Mark permanently failed: extraction (pending-stranded) ─
  -- The processing_started_at guard keeps this from racing the
  -- final retry queued above in the same run: the retry loop sets
  -- processing_started_at = now(), so a just-retried row is given
  -- a full stuck-threshold window before being declared dead.
  UPDATE public.documents
  SET extraction_status = 'failed',
      last_error = 'Exceeded maximum retry attempts (' || v_max_retries || ') while document was stranded in pending'
  WHERE extraction_status = 'pending'
    AND created_at < now() - v_stuck_threshold
    AND retry_count >= v_max_retries
    AND (processing_started_at IS NULL
         OR processing_started_at < now() - v_stuck_threshold);
  GET DIAGNOSTICS v_failed_pending = ROW_COUNT;

  -- ── Alert on permanent failures ────────────────────────────
  -- 1-hour dedup window per alert type, matching monitor-health's
  -- dedup convention on system_alerts.
  v_total_failed := v_failed_embedding + v_failed_extraction + v_failed_pending;

  IF v_total_failed > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.system_alerts
      WHERE alert_type = 'document_ingestion_failed'
        AND resolved_at IS NULL
        AND created_at > now() - INTERVAL '1 hour'
    ) THEN
      INSERT INTO public.system_alerts (alert_type, severity, message, source, metadata)
      VALUES (
        'document_ingestion_failed',
        'critical',
        v_total_failed || ' document(s) permanently failed ingestion after exhausting retries '
          || '(embedding: ' || v_failed_embedding
          || ', extraction: ' || v_failed_extraction
          || ', stranded-pending: ' || v_failed_pending
          || '). Check documents.last_error and retry from the Documents page.',
        'retry_stuck_documents',
        jsonb_build_object(
          'failed_embedding', v_failed_embedding,
          'failed_extraction', v_failed_extraction,
          'failed_pending', v_failed_pending
        )
      );
    END IF;
  END IF;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_stuck_documents() FROM anon;
