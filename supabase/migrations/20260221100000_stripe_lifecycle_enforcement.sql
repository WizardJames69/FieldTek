-- ============================================================
-- Stripe Subscription Lifecycle Enforcement (Second Audit)
-- ============================================================

-- 1a. Add cancel_at_period_end tracking columns
-- When a user cancels via Stripe portal, Stripe sets cancel_at_period_end: true
-- with a cancel_at timestamp. We store these so the frontend can display warnings.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;


-- 1b. Replace enforce_job_limit() with status-aware version
-- Previous version only checked for expired trials. Now also blocks
-- past_due, canceled, and cancelled (legacy spelling) statuses.
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

  -- Block creation for past_due subscriptions
  IF v_subscription_status = 'past_due' THEN
    RAISE EXCEPTION 'Your subscription payment is past due. Please update your payment method to continue creating jobs.';
  END IF;

  -- Block creation for canceled/cancelled subscriptions
  IF v_subscription_status IN ('canceled', 'cancelled') THEN
    RAISE EXCEPTION 'Your subscription has been canceled. Please resubscribe to continue creating jobs.';
  END IF;

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


-- 1c. Replace enforce_technician_limit() with status-aware version
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

  SELECT t.subscription_tier, t.trial_ends_at, t.subscription_status
  INTO v_tier, v_trial_ends_at, v_subscription_status
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  -- Block creation for past_due subscriptions
  IF v_subscription_status = 'past_due' THEN
    RAISE EXCEPTION 'Your subscription payment is past due. Please update your payment method to continue adding technicians.';
  END IF;

  -- Block creation for canceled/cancelled subscriptions
  IF v_subscription_status IN ('canceled', 'cancelled') THEN
    RAISE EXCEPTION 'Your subscription has been canceled. Please resubscribe to continue adding technicians.';
  END IF;

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


-- 1d. Protect subscription columns from client-side modification
-- Only service_role (webhooks, edge functions) can modify these columns.
CREATE OR REPLACE FUNCTION public.protect_subscription_columns()
RETURNS trigger AS $$
BEGIN
  -- Allow service_role (webhooks, edge functions) to modify any column
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For authenticated users, prevent modification of subscription-related columns
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_tenant_subscription_columns
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_columns();


-- 1e. Fix expire_stale_trials() to use 'canceled' (standardize on Stripe's American spelling)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1f. Document the ENUM dual spelling for future developers
COMMENT ON TYPE public.subscription_status IS
  'Subscription status ENUM. Both ''canceled'' (Stripe/American) and ''cancelled'' (British/legacy) exist. '
  'All new code MUST use ''canceled''. The ''cancelled'' value is retained for backward compatibility. '
  'Frontend and triggers must check for BOTH values.';
