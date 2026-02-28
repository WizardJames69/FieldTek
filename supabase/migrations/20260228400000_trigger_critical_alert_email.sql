-- ============================================================
-- Trigger-based critical alert email notifications
-- ============================================================
-- Replaces the inline fetch() in monitor-health edge function.
-- Any INSERT into system_alerts with severity='critical' now
-- triggers an async HTTP call to send-health-alert via pg_net.
--
-- Architecture:
--   INSERT system_alerts (severity='critical')
--     -> AFTER INSERT trigger
--       -> net.http_post() to send-health-alert (async, non-blocking)
--       -> INSERT system_notifications (audit log)
--
-- Prerequisites:
--   1. pg_net extension enabled (done in 20260228200000)
--   2. supabase_vault extension enabled (done below)
--   3. Service role key stored in vault (one-time manual step)
--
-- After applying this migration, run ONCE in SQL Editor:
--
--   SELECT vault.create_secret(
--     'YOUR_SERVICE_ROLE_KEY_HERE',
--     'service_role_key',
--     'Service role key for internal edge function auth'
--   );
--
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Enable vault for secure secret storage
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS supabase_vault;


-- ────────────────────────────────────────────────────────────
-- 2. Trigger function
-- ────────────────────────────────────────────────────────────
-- SECURITY DEFINER: runs as owner (postgres), bypasses RLS.
-- SET search_path = public: prevents search_path injection.
-- Uses net.http_post(): async — returns immediately, does NOT
-- block the INSERT transaction.
-- Logs every attempt to system_notifications for audit.

CREATE OR REPLACE FUNCTION public.notify_critical_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_key TEXT;
  v_project_url TEXT := 'https://dlrhobkrjfegtbdsqdsa.supabase.co';
  v_request_id  BIGINT;
BEGIN
  -- Gate: only critical, unresolved alerts
  IF NEW.severity != 'critical' OR NEW.resolved_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Read service role key from vault
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    INSERT INTO public.system_notifications
      (alert_id, channel, recipient, subject, status, error_message)
    VALUES
      (NEW.id, 'email', 'system', 'CRITICAL: ' || NEW.alert_type,
       'failed', 'service_role_key not found in vault — run vault.create_secret()');
    RETURN NEW;
  END IF;

  -- Async HTTP POST via pg_net (non-blocking, queued)
  SELECT net.http_post(
    url     := v_project_url || '/functions/v1/send-health-alert',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'alertType', NEW.alert_type,
      'severity',  NEW.severity,
      'message',   NEW.message,
      'source',    COALESCE(NEW.source, 'database-trigger')
    )
  ) INTO v_request_id;

  -- Audit log
  INSERT INTO public.system_notifications
    (alert_id, channel, recipient, subject, status, metadata, sent_at)
  VALUES
    (NEW.id, 'email', 'system', 'CRITICAL: ' || NEW.alert_type,
     'sent', jsonb_build_object('pg_net_request_id', v_request_id),
     now());

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block the alert INSERT — log failure and continue
  BEGIN
    INSERT INTO public.system_notifications
      (alert_id, channel, recipient, subject, status, error_message)
    VALUES
      (NEW.id, 'email', 'system', 'CRITICAL: ' || NEW.alert_type,
       'failed', SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    -- Even notification logging failed — just emit a warning
    RAISE WARNING '[notify_critical_alert] Could not log failure: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 3. Trigger definition
-- ────────────────────────────────────────────────────────────
-- AFTER INSERT: runs after the row is committed to system_alerts.
-- FOR EACH ROW: fires per-row, not per-statement.
-- No recursion risk: writes to system_notifications, not system_alerts.

DROP TRIGGER IF EXISTS trg_notify_critical_alert ON public.system_alerts;

CREATE TRIGGER trg_notify_critical_alert
  AFTER INSERT ON public.system_alerts
  FOR EACH ROW
  WHEN (NEW.severity = 'critical' AND NEW.resolved_at IS NULL)
  EXECUTE FUNCTION public.notify_critical_alert();


-- ────────────────────────────────────────────────────────────
-- 4. Restrict EXECUTE to prevent direct RPC calls
-- ────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.notify_critical_alert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_critical_alert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_critical_alert() FROM anon;
