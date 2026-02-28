-- ============================================================
-- Fix Critical Launch Blockers (B2 + B5)
-- ============================================================
-- B2: protect_subscription_columns() missing trial_ends_at guard
-- B5: accept_team_invitation() missing caller identity verification


-- ────────────────────────────────────────────────────────────
-- B2: Add trial_ends_at to protect_subscription_columns()
-- ────────────────────────────────────────────────────────────
-- Without this, a tenant owner can do:
--   supabase.from('tenants').update({ trial_ends_at: '2099-12-31' })
-- and stay on a free trial forever.

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

  IF OLD.trial_ends_at IS DISTINCT FROM NEW.trial_ends_at THEN
    RAISE EXCEPTION 'Cannot modify trial_ends_at directly.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────
-- B5: Harden accept_team_invitation() — verify caller identity
-- ────────────────────────────────────────────────────────────
-- Without this, an attacker with a valid token can add a
-- DIFFERENT user to the tenant by passing any p_user_id.
-- Also adds email match: the calling user's email must match
-- the invitation email.

CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token TEXT, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_caller_email TEXT;
BEGIN
  -- Verify the caller is who they claim to be
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'User identity mismatch');
  END IF;

  -- Find the invitation
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = p_token
  AND accepted_at IS NULL
  AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Verify the caller's email matches the invitation
  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_caller_email IS DISTINCT FROM v_invitation.email THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address');
  END IF;

  -- Check if user is already a member of this tenant
  IF EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = p_user_id
    AND tenant_id = v_invitation.tenant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this team');
  END IF;

  -- Create the tenant_user record
  INSERT INTO tenant_users (tenant_id, user_id, role, invited_by, invited_at, is_active)
  VALUES (
    v_invitation.tenant_id,
    p_user_id,
    v_invitation.role,
    v_invitation.invited_by,
    v_invitation.created_at,
    true
  );

  -- Mark invitation as accepted
  UPDATE team_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_invitation.tenant_id,
    'role', v_invitation.role
  );
END;
$$;
