-- ============================================================
-- Stripe Subscription Audit Fixes
-- ============================================================

-- C1: Fix subscription_status ENUM mismatch
-- The stripe-webhook writes "trialing" and "canceled" but the ENUM
-- only contains ('trial', 'active', 'cancelled', 'past_due').
-- This causes every trialing/canceled subscription update to fail.
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'trialing';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'canceled';


-- C4: Webhook idempotency — prevent duplicate event processing
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Only service_role should access this table (webhook uses service_role)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Cleanup function for old events (> 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stripe_webhook_events
  WHERE processed_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C3: Dead-letter table for failed webhook events
CREATE TABLE IF NOT EXISTS public.webhook_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  error_reason TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.webhook_dead_letters ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_webhook_dead_letters_unresolved
  ON public.webhook_dead_letters (created_at)
  WHERE resolved_at IS NULL;


-- H1: Store stripe_customer_id for reliable customer matching
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id
  ON public.tenants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;


-- M1: Subscription audit log for debugging billing issues
CREATE TABLE IF NOT EXISTS public.subscription_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  previous_tier public.subscription_tier,
  new_tier public.subscription_tier,
  previous_status public.subscription_status,
  new_status public.subscription_status,
  stripe_event_id TEXT,
  stripe_subscription_id TEXT,
  change_source TEXT NOT NULL DEFAULT 'webhook',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Only owners/admins can view audit log
CREATE POLICY "Admins can view subscription audit log"
  ON public.subscription_audit_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    AND public.is_tenant_admin()
  );

CREATE INDEX idx_subscription_audit_log_tenant
  ON public.subscription_audit_log (tenant_id, created_at DESC);


-- H3: Scheduled trial expiry enforcement
-- Sets expired trials to 'cancelled' status so they lose feature access
CREATE OR REPLACE FUNCTION public.expire_stale_trials()
RETURNS integer AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.tenants
    SET subscription_status = 'cancelled'
    WHERE subscription_status = 'trial'
      AND trial_ends_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C2: Server-side tier limit enforcement

-- Reference table for tier limits (single source of truth)
CREATE TABLE IF NOT EXISTS public.tier_limits (
  tier public.subscription_tier PRIMARY KEY,
  max_technicians INTEGER,      -- NULL = unlimited
  max_jobs_per_month INTEGER,   -- NULL = unlimited
  max_storage_bytes BIGINT      -- NULL = unlimited
);

INSERT INTO public.tier_limits (tier, max_technicians, max_jobs_per_month, max_storage_bytes) VALUES
  ('trial',        2,    50,   524288000),       -- 500MB
  ('starter',      2,    100,  1073741824),      -- 1GB
  ('growth',       5,    500,  5368709120),      -- 5GB
  ('professional', 10,   NULL, 26843545600),     -- 25GB, unlimited jobs
  ('enterprise',   NULL, NULL, NULL)             -- unlimited everything
ON CONFLICT (tier) DO UPDATE SET
  max_technicians = EXCLUDED.max_technicians,
  max_jobs_per_month = EXCLUDED.max_jobs_per_month,
  max_storage_bytes = EXCLUDED.max_storage_bytes;

ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

-- Anyone can read tier limits (needed for frontend display)
CREATE POLICY "Anyone can read tier limits"
  ON public.tier_limits FOR SELECT
  TO authenticated
  USING (true);


-- Enforce job creation limits
CREATE OR REPLACE FUNCTION public.enforce_job_limit()
RETURNS trigger AS $$
DECLARE
  v_tier public.subscription_tier;
  v_trial_ends_at TIMESTAMPTZ;
  v_subscription_status public.subscription_status;
  v_max_jobs INTEGER;
  v_current_jobs INTEGER;
BEGIN
  -- Look up current tier and trial status
  SELECT t.subscription_tier, t.trial_ends_at, t.subscription_status
  INTO v_tier, v_trial_ends_at, v_subscription_status
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  -- If trial has expired, treat as starter limits
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_job_limit
  BEFORE INSERT ON public.scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_limit();


-- Enforce technician limits
CREATE OR REPLACE FUNCTION public.enforce_technician_limit()
RETURNS trigger AS $$
DECLARE
  v_tier public.subscription_tier;
  v_trial_ends_at TIMESTAMPTZ;
  v_subscription_status public.subscription_status;
  v_max_techs INTEGER;
  v_current_techs INTEGER;
BEGIN
  -- Only enforce on technician role
  IF NEW.role != 'technician' THEN
    RETURN NEW;
  END IF;

  -- Look up current tier and trial status
  SELECT t.subscription_tier, t.trial_ends_at, t.subscription_status
  INTO v_tier, v_trial_ends_at, v_subscription_status
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  -- If trial has expired, treat as starter limits
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_technician_limit
  BEFORE INSERT ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_technician_limit();


-- H6: Fix conflicting RLS policies on tenants
-- Policy "Members can read tenant for app functionality" allows ALL members
-- to bypass the admin-only restriction on financial data. Drop it and replace
-- with a policy that only exposes non-sensitive columns via the tenants_public view.
DROP POLICY IF EXISTS "Members can read tenant for app functionality" ON public.tenants;
