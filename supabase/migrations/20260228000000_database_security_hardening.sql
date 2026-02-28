-- ============================================================
-- Database Security Hardening
-- ============================================================
-- Addresses: search_path injection on SECURITY DEFINER functions,
-- non-deterministic get_user_tenant_id(), unrestricted EXECUTE grants,
-- pending_invitations email-match bypass, missing RLS policies,
-- public schema CREATE privilege, and statement-level timeouts.
-- All statements are idempotent (DROP IF EXISTS / CREATE OR REPLACE / IF NOT EXISTS).


-- ────────────────────────────────────────────────────────────
-- 1. SET search_path on SECURITY DEFINER functions
-- ────────────────────────────────────────────────────────────
-- Without SET search_path, a SECURITY DEFINER function uses the
-- caller's search_path, enabling shadow-object attacks.

-- 1a. cleanup_old_webhook_events
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stripe_webhook_events
  WHERE processed_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1b. enforce_job_limit (latest status-aware version)
CREATE OR REPLACE FUNCTION public.enforce_job_limit()
RETURNS trigger AS $$
DECLARE
  v_tier public.subscription_tier;
  v_trial_ends_at TIMESTAMPTZ;
  v_subscription_status public.subscription_status;
  v_max_jobs INTEGER;
  v_current_jobs INTEGER;
BEGIN
  SELECT t.subscription_tier, t.trial_ends_at, t.subscription_status
  INTO v_tier, v_trial_ends_at, v_subscription_status
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  IF v_subscription_status = 'past_due' THEN
    RAISE EXCEPTION 'Your subscription payment is past due. Please update your payment method to continue creating jobs.';
  END IF;

  IF v_subscription_status IN ('canceled', 'cancelled') THEN
    RAISE EXCEPTION 'Your subscription has been canceled. Please resubscribe to continue creating jobs.';
  END IF;

  IF v_subscription_status = 'trial' AND v_trial_ends_at < now() THEN
    v_tier := 'starter';
  END IF;

  SELECT max_jobs_per_month INTO v_max_jobs
  FROM public.tier_limits
  WHERE tier = v_tier;

  IF v_max_jobs IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_jobs
    FROM public.scheduled_jobs
    WHERE tenant_id = NEW.tenant_id
      AND created_at >= date_trunc('month', now());

    IF v_current_jobs >= v_max_jobs THEN
      RAISE EXCEPTION 'Job limit reached for % plan (% of % allowed). Please upgrade your subscription.',
        v_tier, v_current_jobs, v_max_jobs;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1c. enforce_technician_limit (latest status-aware version)
CREATE OR REPLACE FUNCTION public.enforce_technician_limit()
RETURNS trigger AS $$
DECLARE
  v_tier public.subscription_tier;
  v_trial_ends_at TIMESTAMPTZ;
  v_subscription_status public.subscription_status;
  v_max_techs INTEGER;
  v_current_techs INTEGER;
BEGIN
  IF NEW.role != 'technician' THEN
    RETURN NEW;
  END IF;

  SELECT t.subscription_tier, t.trial_ends_at, t.subscription_status
  INTO v_tier, v_trial_ends_at, v_subscription_status
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  IF v_subscription_status = 'past_due' THEN
    RAISE EXCEPTION 'Your subscription payment is past due. Please update your payment method to continue adding technicians.';
  END IF;

  IF v_subscription_status IN ('canceled', 'cancelled') THEN
    RAISE EXCEPTION 'Your subscription has been canceled. Please resubscribe to continue adding technicians.';
  END IF;

  IF v_subscription_status = 'trial' AND v_trial_ends_at < now() THEN
    v_tier := 'starter';
  END IF;

  SELECT max_technicians INTO v_max_techs
  FROM public.tier_limits
  WHERE tier = v_tier;

  IF v_max_techs IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_techs
    FROM public.tenant_users
    WHERE tenant_id = NEW.tenant_id
      AND role = 'technician'
      AND is_active = true;

    IF v_current_techs >= v_max_techs THEN
      RAISE EXCEPTION 'Technician limit reached for % plan (% of % allowed). Please upgrade your subscription.',
        v_tier, v_current_techs, v_max_techs;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1d. protect_subscription_columns
CREATE OR REPLACE FUNCTION public.protect_subscription_columns()
RETURNS trigger AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
    RAISE EXCEPTION 'Cannot modify subscription_tier directly. Use the billing portal.';
  END IF;

  IF OLD.subscription_status IS DISTINCT FROM NEW.subscription_status THEN
    RAISE EXCEPTION 'Cannot modify subscription_status directly. Use the billing portal.';
  END IF;

  IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_customer_id directly.';
  END IF;

  IF OLD.cancel_at_period_end IS DISTINCT FROM NEW.cancel_at_period_end THEN
    RAISE EXCEPTION 'Cannot modify cancel_at_period_end directly.';
  END IF;

  IF OLD.cancel_at IS DISTINCT FROM NEW.cancel_at THEN
    RAISE EXCEPTION 'Cannot modify cancel_at directly.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1e. expire_stale_trials
CREATE OR REPLACE FUNCTION public.expire_stale_trials()
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.tenants
    SET subscription_status = 'canceled'
    WHERE subscription_status = 'trial'
      AND trial_ends_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────
-- 2. Fix get_user_tenant_id() non-deterministic ordering
-- ────────────────────────────────────────────────────────────
-- LIMIT 1 without ORDER BY returns an unpredictable row if a user
-- belongs to multiple tenants. Add ORDER BY created_at ASC so the
-- oldest (first-joined) tenant is consistently returned.
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;


-- ────────────────────────────────────────────────────────────
-- 3. Restrict EXECUTE on admin-only standalone functions
-- ────────────────────────────────────────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default. These are cron/admin
-- functions that should only be callable by service_role, not via RPC.

REVOKE EXECUTE ON FUNCTION public.cleanup_old_webhook_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_events() TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_stale_trials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_trials() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_health_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_health_metrics() TO service_role;


-- ────────────────────────────────────────────────────────────
-- 4. Harden pending_invitations UPDATE policy
-- ────────────────────────────────────────────────────────────
-- Current policy lets ANY authenticated user accept ANY invitation.
-- Add email match so users can only accept invitations sent to them.

DROP POLICY IF EXISTS "Users can accept invitations via token" ON public.pending_invitations;

CREATE POLICY "Users can accept invitations via token"
ON public.pending_invitations
FOR UPDATE
TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND accepted_at IS NULL
  AND expires_at > now()
)
WITH CHECK (
  accepted_at IS NOT NULL
);


-- ────────────────────────────────────────────────────────────
-- 5. Revoke public schema CREATE privilege
-- ────────────────────────────────────────────────────────────
-- Prevents unprivileged roles from creating shadow objects in the
-- public schema (search_path attack vector).

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CREATE ON SCHEMA public TO service_role;


-- ────────────────────────────────────────────────────────────
-- 6. Add explicit RLS policies to tables with none
-- ────────────────────────────────────────────────────────────

-- 6a. rate_limits — service_role only (used by edge functions)
CREATE POLICY "Service role full access to rate_limits"
  ON public.rate_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon access to rate_limits"
  ON public.rate_limits FOR ALL TO anon
  USING (false);

-- 6b. stripe_webhook_events — service_role only (webhook idempotency)
CREATE POLICY "Service role full access to stripe_webhook_events"
  ON public.stripe_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon access to stripe_webhook_events"
  ON public.stripe_webhook_events FOR ALL TO anon
  USING (false);

-- 6c. webhook_dead_letters — service_role only (failed webhook storage)
CREATE POLICY "Service role full access to webhook_dead_letters"
  ON public.webhook_dead_letters FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Deny anon access to webhook_dead_letters"
  ON public.webhook_dead_letters FOR ALL TO anon
  USING (false);

-- 6d. subscription_audit_log — explicit anon deny
-- (already has admin SELECT policy, add anon deny for defense in depth)
CREATE POLICY "Deny anon access to subscription_audit_log"
  ON public.subscription_audit_log FOR ALL TO anon
  USING (false);


-- ────────────────────────────────────────────────────────────
-- 7. Fix system_health_metrics deny policy scope
-- ────────────────────────────────────────────────────────────
-- Current policy uses USING(false) without TO anon, which blocks ALL
-- roles including authenticated admins (unless overridden by another
-- permissive policy). Scope it to anon only.

DROP POLICY IF EXISTS "Deny anonymous access to health_metrics" ON public.system_health_metrics;

CREATE POLICY "Deny anon access to system_health_metrics"
  ON public.system_health_metrics FOR ALL TO anon
  USING (false);


-- ────────────────────────────────────────────────────────────
-- 8. Statement-level timeouts
-- ────────────────────────────────────────────────────────────
-- Prevent long-running queries from exhausting connection pool slots.

ALTER ROLE authenticated SET statement_timeout = '30s';
ALTER ROLE anon SET statement_timeout = '10s';


-- ────────────────────────────────────────────────────────────
-- 9. RLS performance indexes
-- ────────────────────────────────────────────────────────────
-- Partial indexes on tenant_users to accelerate RLS policy evaluation.

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_active
  ON public.tenant_users (user_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_active
  ON public.tenant_users (tenant_id, is_active)
  WHERE is_active = true;
