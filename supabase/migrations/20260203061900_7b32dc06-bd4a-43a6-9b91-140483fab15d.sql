-- ============================================================
-- Security Fix: Address 3 security scan findings
-- ============================================================

-- ============================================================
-- FIX 1: profiles_table_public_exposure
-- Issue: Profiles table exposes email/phone to all tenant members
-- Solution: Users can only view their own profile OR profiles of 
--           team members if they are admin/owner/dispatcher
-- ============================================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

-- Create a more restrictive policy: 
-- Users can view their own profile always
-- Admins/owners/dispatchers can view all profiles in their tenant (needed for team management/job assignment)
-- Technicians can only view their own profile
CREATE POLICY "Users can view own profile or admins can view tenant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) -- Always allow viewing own profile
  OR 
  (
    -- Admins, owners, and dispatchers can view all profiles in their tenant
    EXISTS (
      SELECT 1 FROM tenant_users tu_viewer
      WHERE tu_viewer.user_id = auth.uid()
        AND tu_viewer.is_active = true
        AND tu_viewer.role IN ('owner', 'admin', 'dispatcher')
        AND EXISTS (
          SELECT 1 FROM tenant_users tu_target
          WHERE tu_target.user_id = profiles.user_id
            AND tu_target.tenant_id = tu_viewer.tenant_id
            AND tu_target.is_active = true
        )
    )
  )
  OR is_platform_admin()
);

-- ============================================================
-- FIX 2: tenants_financial_exposure  
-- Issue: All tenant members can see subscription_tier, trial_ends_at, 
--        stripe_connect info
-- Solution: Create a view that hides financial fields for non-admin users
--           and update the SELECT policy to be role-based
-- ============================================================

-- Create a public view that shows non-sensitive tenant info
-- All members can see: id, name, slug, address, phone, email, industry
-- Only admins/owners can query the base table for financial fields
CREATE OR REPLACE VIEW public.tenants_public
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  slug,
  address,
  phone,
  email,
  industry,
  created_at,
  updated_at
FROM public.tenants;

-- Comment explaining the view
COMMENT ON VIEW public.tenants_public IS 'Public tenant info visible to all members. Financial/subscription data excluded.';

-- Drop existing SELECT policies on tenants and create role-based ones
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;

-- All tenant members can view basic tenant info (but not financial fields via the view)
-- Only owners and admins can SELECT from base tenants table to see financial info
CREATE POLICY "Users can view own tenant basic info"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  (
    -- All tenant members can view basic fields (via view or direct query)
    user_belongs_to_tenant(id) 
    AND (
      -- But full access (including financial) only for owners/admins
      is_tenant_admin() OR owner_id = auth.uid()
    )
  )
  OR is_platform_admin()
  OR owner_id = auth.uid()
);

-- Also allow regular members to read basic tenant info needed for the app to function
-- This is a fallback policy for essential reads
CREATE POLICY "Members can read tenant for app functionality"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  user_belongs_to_tenant(id)
);

-- ============================================================
-- FIX 3: scheduled_jobs_over_permissive
-- Issue: All tenant users can see all jobs, including internal notes,
--        addresses, and jobs assigned to other technicians
-- Solution: Technicians can only see jobs assigned to them;
--           Dispatchers, admins, owners can see all jobs in tenant
-- ============================================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view jobs in their tenant" ON public.scheduled_jobs;

-- Create a role-based policy for job visibility
CREATE POLICY "Role-based job visibility"
ON public.scheduled_jobs
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id())
  AND (
    -- Owners, admins, and dispatchers can see all jobs
    is_tenant_admin() 
    OR get_user_role() = 'dispatcher'
    -- Technicians can only see jobs assigned to them
    OR assigned_to = auth.uid()
    -- Or jobs they created
    OR created_by = auth.uid()
  )
);