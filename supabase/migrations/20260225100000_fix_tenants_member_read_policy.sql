-- Fix: Allow all tenant members to read their own tenant record.
--
-- Migration 20260220100000_stripe_subscription_fixes.sql dropped the
-- "Members can read tenant for app functionality" policy because it bypassed
-- the admin-only restriction intended to hide financial columns (stripe_*).
-- However, RLS policies operate at ROW level, not column level, and the
-- replacement approach (tenants_public view with security_invoker=on) still
-- requires the caller to pass the underlying RLS check on the tenants table.
--
-- Without a permissive member-read policy, technicians cannot load the
-- tenants table at all. TenantContext.tsx needs subscription_tier and
-- subscription_status from the tenant row for SubscriptionGuard / useFeatureAccess
-- to function. This broke the app for all non-admin/non-owner users.
--
-- Fix: replace the overly restrictive "Users can view own tenant basic info"
-- policy with one that allows any authenticated tenant member to read their
-- own tenant row.  Financial-column protection should be handled at the
-- application layer (UI hides Stripe IDs for non-admin users), not via
-- row-level security which cannot filter columns.

DROP POLICY IF EXISTS "Users can view own tenant basic info" ON public.tenants;

CREATE POLICY "Tenant members can view own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  user_belongs_to_tenant(id)
  OR is_platform_admin()
  OR owner_id = auth.uid()
);
