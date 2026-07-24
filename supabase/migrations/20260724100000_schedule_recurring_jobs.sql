-- ============================================================
-- Week 0 Workstream D1 (founder-cleared 2026-07-23: zero active
-- recurring_job_templates exist, so wiring the cron starts nothing)
-- Schedule generate-recurring-jobs daily
-- ============================================================
-- generate-recurring-jobs has existed since 20260203 with ZERO callers —
-- no cron, no frontend invocation, nothing — so recurring templates
-- created in the UI never materialized into jobs. This wires the daily
-- cron using the hardened alerting pattern (vault-sourced URL + service
-- key; 20260228500000 precedent). The function inherits the platform
-- default verify_jwt=true at the gateway AND (as of this Week 0 pass)
-- gates in-code on isServiceRoleBearer, so the Bearer header below is
-- required and sufficient.
--
-- Timezone honesty: the function does plain UTC date math and does not
-- read tenant_settings.timezone. Because job creation leads the
-- occurrence date by advance_days (default 7), the run HOUR is
-- immaterial; one daily 06:00 UTC run is correct for all tenants.
-- ============================================================

CREATE OR REPLACE FUNCTION public.invoke_generate_recurring_jobs()
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
    RAISE WARNING '[invoke_generate_recurring_jobs] Missing vault secrets (supabase_project_url or service_role_key)';
    RETURN;
  END IF;

  SELECT net.http_post(
    url     := v_project_url || '/functions/v1/generate-recurring-jobs',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_generate_recurring_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_generate_recurring_jobs() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_generate_recurring_jobs() FROM anon;

DO $$
BEGIN
  PERFORM cron.unschedule('generate-recurring-jobs-daily');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job generate-recurring-jobs-daily not found, skipping unschedule';
END $$;

SELECT cron.schedule(
  'generate-recurring-jobs-daily',
  '0 6 * * *',
  $$ SELECT public.invoke_generate_recurring_jobs(); $$
);
