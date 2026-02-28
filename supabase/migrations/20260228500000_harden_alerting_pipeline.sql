-- ============================================================
-- Harden alerting pipeline for production
-- ============================================================
-- Fixes from architecture review:
--   1. Status lifecycle: 'sent' → 'queued' (pg_net is async)
--   2. Remove hardcoded project URL (read from vault)
--   3. pg_cron wrapper to eliminate hardcoded URL in schedule
--
-- Prerequisites:
--   1. pg_net and pg_cron enabled (done in 20260228200000)
--   2. supabase_vault enabled (done in 20260228400000)
--   3. service_role_key in vault (done manually after 20260228400000)
--
-- After applying this migration, run ONCE in SQL Editor:
--
--   SELECT vault.create_secret(
--     'https://dlrhobkrjfegtbdsqdsa.supabase.co',
--     'supabase_project_url',
--     'Supabase project URL for internal edge function calls'
--   );
--
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Expand CHECK constraint on system_notifications.status
-- ────────────────────────────────────────────────────────────
-- Add 'queued' (for pg_net fire-and-forget) and 'delivered'
-- (forward-compatible for future reconciliation).
-- Existing rows with 'sent' remain valid.

DO $$
DECLARE
  v_conname TEXT;
BEGIN
  -- Find the status CHECK constraint by inspecting its definition
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.system_notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.system_notifications DROP CONSTRAINT %I', v_conname);
    RAISE NOTICE 'Dropped constraint: %', v_conname;
  ELSE
    RAISE NOTICE 'No status CHECK constraint found — skipping drop';
  END IF;
END $$;

ALTER TABLE public.system_notifications
  ADD CONSTRAINT system_notifications_status_check
  CHECK (status IN ('pending', 'sent', 'queued', 'delivered', 'failed', 'skipped'));


-- ────────────────────────────────────────────────────────────
-- 2. Rewrite trigger function
-- ────────────────────────────────────────────────────────────
-- Changes from previous version:
--   a. Reads supabase_project_url from vault (no hardcoded URL)
--   b. Fails gracefully if URL missing
--   c. Audit log uses status='queued' (not 'sent')
--   d. No sent_at on audit row (pg_net is async, delivery unconfirmed)
--
-- CREATE OR REPLACE preserves the function OID — the existing
-- trigger (trg_notify_critical_alert) continues to work.

CREATE OR REPLACE FUNCTION public.notify_critical_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_key  TEXT;
  v_project_url  TEXT;
  v_request_id   BIGINT;
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
       'failed', 'service_role_key not found in vault');
    RETURN NEW;
  END IF;

  -- Read project URL from vault (no hardcoded URL)
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  IF v_project_url IS NULL THEN
    INSERT INTO public.system_notifications
      (alert_id, channel, recipient, subject, status, error_message)
    VALUES
      (NEW.id, 'email', 'system', 'CRITICAL: ' || NEW.alert_type,
       'failed', 'supabase_project_url not found in vault — run vault.create_secret()');
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

  -- Audit log: status='queued' (pg_net is async, delivery not confirmed)
  INSERT INTO public.system_notifications
    (alert_id, channel, recipient, subject, status, metadata)
  VALUES
    (NEW.id, 'email', 'system', 'CRITICAL: ' || NEW.alert_type,
     'queued', jsonb_build_object('pg_net_request_id', v_request_id));

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
    RAISE WARNING '[notify_critical_alert] Could not log failure: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 3. pg_cron wrapper function (reads URL from vault)
-- ────────────────────────────────────────────────────────────
-- Replaces the hardcoded URL in the cron schedule.
-- The cron job calls this function; the function reads vault
-- at execution time.

CREATE OR REPLACE FUNCTION public.invoke_health_monitor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url  TEXT;
  v_request_id   BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  IF v_project_url IS NULL THEN
    RAISE WARNING '[invoke_health_monitor] supabase_project_url not found in vault';
    RETURN;
  END IF;

  -- monitor-health has verify_jwt=false, no auth header needed
  SELECT net.http_post(
    url     := v_project_url || '/functions/v1/monitor-health',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  ) INTO v_request_id;
END;
$$;

-- Restrict direct RPC access
REVOKE EXECUTE ON FUNCTION public.invoke_health_monitor() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_health_monitor() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_health_monitor() FROM anon;


-- ────────────────────────────────────────────────────────────
-- 4. Reschedule pg_cron job (no hardcoded URL)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM cron.unschedule('monitor-health-check');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job monitor-health-check not found, skipping unschedule';
END $$;

SELECT cron.schedule(
  'monitor-health-check',
  '*/5 * * * *',
  $$ SELECT public.invoke_health_monitor(); $$
);


-- ────────────────────────────────────────────────────────────
-- 5. Re-apply REVOKE on trigger function (safety)
-- ────────────────────────────────────────────────────────────
-- CREATE OR REPLACE preserves privileges, but re-applying
-- REVOKE is defensive best practice.

REVOKE EXECUTE ON FUNCTION public.notify_critical_alert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_critical_alert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_critical_alert() FROM anon;
