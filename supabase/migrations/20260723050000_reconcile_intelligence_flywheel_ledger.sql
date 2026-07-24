-- ============================================================
-- Week 0 ledger reconciliation (founder-directed 2026-07-23)
-- Promote the live 20260513 section-A/C1 objects into the applied ledger
-- ============================================================
-- Production carries three objects that exist in NO applied migration —
-- they were applied out-of-band from the parked guided-procedures stream
-- (supabase/migrations-parked/guided-procedures/20260513000000..., sections
-- A and C1) and verified live by read-only query on 2026-07-23
-- (pg_trigger row, pg_proc row, tenant_id is_nullable = YES):
--
--   1. function public.notify_collect_workflow_intelligence()
--   2. trigger  trg_collect_workflow_intelligence on public.scheduled_jobs
--   3. workflow_diagnostic_statistics.tenant_id nullability + the
--      replacement SELECT policy that admits global (tenant_id IS NULL) rows
--
-- Without this migration, any rebuild-from-migrations (db reset, disaster
-- recovery, the db-replay CI shadow) produces a schema with NO trigger and
-- NO function — silently severing the workflow-discovery telemetry
-- flywheel — and a NOT NULL tenant_id. Nothing tested for them, so CI
-- stayed green on a schema that diverged from production
-- (docs/week0-drift-report.md, "replay-from-zero divergence").
--
-- Every statement below is idempotent, so applying this to production —
-- where the objects already exist — is a no-op in effect. Before the
-- push, the live definitions were diffed against this text via
-- pg_get_functiondef / pg_get_triggerdef / pg_get_expr (founder-run,
-- 2026-07-23): trigger and policy match exactly modulo deparser
-- normalization; the function's executable statements match
-- token-for-token, with the live body merely missing two comment lines
-- present here — so the CREATE OR REPLACE restores those comments and
-- changes no behavior. SQL is copied verbatim from the parked file; the
-- parked stream itself is untouched (its hard rules stand), and its
-- README notes that sections A/C1 are now ledgered here, leaving only
-- sections B/C2 unapplied.
-- ============================================================

-- ── 1+2. The learning-flywheel trigger (20260513 section A, verbatim) ──

CREATE OR REPLACE FUNCTION public.notify_collect_workflow_intelligence()
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
  -- Read secrets from vault (one-time setup per environment)
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key' LIMIT 1;

  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url' LIMIT 1;

  IF v_service_key IS NULL OR v_project_url IS NULL THEN
    RAISE WARNING '[notify_collect_workflow_intelligence] Missing vault secrets (service_role_key or supabase_project_url)';
    RETURN NEW;
  END IF;

  -- Async HTTP POST via pg_net (non-blocking)
  SELECT net.http_post(
    url     := v_project_url || '/functions/v1/collect-workflow-intelligence',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object('job_id', NEW.id::text)
  ) INTO v_request_id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_collect_workflow_intelligence] Trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Restrict execution to service_role / postgres only
REVOKE EXECUTE ON FUNCTION public.notify_collect_workflow_intelligence() FROM PUBLIC, authenticated, anon;

-- Attach trigger: fires ONLY on status transition TO 'completed'
DROP TRIGGER IF EXISTS trg_collect_workflow_intelligence ON public.scheduled_jobs;

CREATE TRIGGER trg_collect_workflow_intelligence
  AFTER UPDATE OF status ON public.scheduled_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.notify_collect_workflow_intelligence();

-- ── 3. Global-intelligence schema prep (20260513 section C1, verbatim) ──

ALTER TABLE public.workflow_diagnostic_statistics
  ALTER COLUMN tenant_id DROP NOT NULL;

DROP POLICY IF EXISTS "Tenant users can view diagnostic statistics" ON public.workflow_diagnostic_statistics;
CREATE POLICY "Tenant users can view diagnostic statistics"
  ON public.workflow_diagnostic_statistics
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );
