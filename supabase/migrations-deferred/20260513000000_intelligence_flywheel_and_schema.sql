-- ============================================================
-- Intelligence Flywheel: Trigger + Platform Admin RLS + Global Schema
-- ============================================================
-- Addresses findings from Stage 1 architectural audit:
--
-- CRITICAL-B1: collect-workflow-intelligence never called (flywheel disconnected)
-- MEDIUM-B9:   4 intelligence tables missing is_platform_admin() RLS
-- MEDIUM-B8:   Schema not ready for future global intelligence rows
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- A. CONNECT THE LEARNING FLYWHEEL
-- ────────────────────────────────────────────────────────────
-- When scheduled_jobs.status transitions to 'completed', fire
-- an async HTTP POST to collect-workflow-intelligence via pg_net.
-- Non-blocking: failures are logged, never block the transaction.
-- ────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────
-- B. MISSING PLATFORM ADMIN RLS POLICIES
-- ────────────────────────────────────────────────────────────
-- 4 intelligence tables queried from /admin/* pages lack
-- is_platform_admin() policies. Pattern matches ai_audit_logs.
-- ────────────────────────────────────────────────────────────

CREATE POLICY "Platform admins can view workflow step outcomes"
  ON public.workflow_step_outcomes
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow step statistics"
  ON public.workflow_step_statistics
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow pattern clusters"
  ON public.workflow_pattern_clusters
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow pattern suggestions"
  ON public.workflow_pattern_suggestions
  FOR SELECT
  USING (public.is_platform_admin());


-- ────────────────────────────────────────────────────────────
-- C. PREPARE SCHEMA FOR GLOBAL INTELLIGENCE
-- ────────────────────────────────────────────────────────────
-- Make tenant_id nullable on two aggregation tables so future
-- global baseline rows (tenant_id = NULL) can coexist with
-- per-tenant rows. Follows the equipment_components precedent.
--
-- Existing RLS stays intact (tenant-scoped rows still match).
-- New policies allow reading global rows (tenant_id IS NULL).
-- ────────────────────────────────────────────────────────────

-- C1. workflow_diagnostic_statistics: allow nullable tenant_id
ALTER TABLE public.workflow_diagnostic_statistics
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Update existing tenant-scoped RLS to also show global rows
DROP POLICY IF EXISTS "Tenant users can view diagnostic statistics" ON public.workflow_diagnostic_statistics;
CREATE POLICY "Tenant users can view diagnostic statistics"
  ON public.workflow_diagnostic_statistics
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- C2. workflow_pattern_clusters: allow nullable tenant_id
ALTER TABLE public.workflow_pattern_clusters
  ALTER COLUMN tenant_id DROP NOT NULL;

DROP POLICY IF EXISTS "Tenant users can view pattern clusters" ON public.workflow_pattern_clusters;
CREATE POLICY "Tenant users can view pattern clusters"
  ON public.workflow_pattern_clusters
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );
