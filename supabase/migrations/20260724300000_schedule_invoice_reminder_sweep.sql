-- ============================================================
-- Week 0 Workstream D2: schedule the overdue-invoice reminder sweep
-- ============================================================
-- send-invoice-reminder has supported an all-overdue sweep mode since it
-- shipped (empty body + service-role bearer), but nothing ever scheduled
-- it. This wires the daily cron via the vault pattern (20260228500000
-- precedent). The function requires a service-role bearer for sweep mode
-- both at the gateway (default verify_jwt=true) and in-code
-- (isServiceRoleBearer), and — as of this Week 0 pass — skips every
-- tenant whose tenant_settings.invoice_reminders_enabled is not true,
-- so scheduling this is inert until a tenant opts in.
--
-- 14:00 UTC ≈ morning business hours across North America.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invoke_invoice_reminder_sweep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_key  TEXT;
  v_project_url  TEXT;
  v_request_id   BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url' LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key' LIMIT 1;

  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING '[invoke_invoice_reminder_sweep] Missing vault secrets (supabase_project_url or service_role_key)';
    RETURN;
  END IF;

  -- Empty JSON body → all-tenants sweep (per-tenant opt-in enforced
  -- inside the function via tenant_settings.invoice_reminders_enabled).
  SELECT net.http_post(
    url     := v_project_url || '/functions/v1/send-invoice-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_invoice_reminder_sweep() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_invoice_reminder_sweep() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_invoice_reminder_sweep() FROM anon;

DO $$
BEGIN
  PERFORM cron.unschedule('invoice-reminder-sweep-daily');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job invoice-reminder-sweep-daily not found, skipping unschedule';
END $$;

SELECT cron.schedule(
  'invoice-reminder-sweep-daily',
  '0 14 * * *',
  $$ SELECT public.invoke_invoice_reminder_sweep(); $$
);
