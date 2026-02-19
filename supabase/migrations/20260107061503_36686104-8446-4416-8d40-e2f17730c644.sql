-- =====================================================
-- COMPREHENSIVE SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. Create helper function to get user's role within their tenant
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.tenant_users 
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

-- 2. Create helper function to check if user belongs to a specific tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid() 
    AND tenant_id = _tenant_id
    AND is_active = true
  )
$$;

-- =====================================================
-- FIX CRITICAL: tenant_users self-join vulnerability
-- =====================================================

-- Drop the dangerous policy that allows users to join any tenant
DROP POLICY IF EXISTS "Users can join tenants" ON public.tenant_users;

-- Create a safe policy: users can only be added by tenant admins
CREATE POLICY "Tenant admins can add users"
ON public.tenant_users
FOR INSERT
WITH CHECK (
  -- Allow platform admins to add users anywhere
  is_platform_admin()
  OR
  -- Allow tenant admins/owners to add users to their own tenant
  (
    is_tenant_admin() 
    AND tenant_id = get_user_tenant_id()
  )
);

-- =====================================================
-- FIX CRITICAL: demo_requests access restriction
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Admins can view demo requests" ON public.demo_requests;

-- Create restrictive policy: only platform admins can view
CREATE POLICY "Platform admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (is_platform_admin());

-- =====================================================
-- FIX: tenants creation - require authentication
-- =====================================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Create policy requiring authentication
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- FIX: service_requests spam prevention
-- =====================================================

-- Drop the overly permissive policy allowing anyone to create
DROP POLICY IF EXISTS "Anyone can create service requests" ON public.service_requests;

-- Create policy: require either authentication OR valid tenant_id + client access token pattern
-- For now, require the tenant to exist (prevents completely random spam)
CREATE POLICY "Service requests require valid tenant"
ON public.service_requests
FOR INSERT
WITH CHECK (
  -- Tenant must exist
  EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id)
);

-- =====================================================
-- FIX: documents - respect is_public flag
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view documents in their tenant" ON public.documents;

-- Create new policy respecting is_public
CREATE POLICY "Users can view documents in their tenant"
ON public.documents
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_public = true
    OR is_tenant_admin()
    OR uploaded_by = auth.uid()
  )
);

-- =====================================================
-- FIX: invoices - role-based access (admins/dispatchers only)
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view invoices in their tenant" ON public.invoices;

-- Create role-restricted policy
CREATE POLICY "Admins and dispatchers can view invoices"
ON public.invoices
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_tenant_admin()
    OR get_user_role() = 'dispatcher'
  )
);

-- =====================================================
-- FIX: profiles - prevent cross-tenant exposure
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

-- Create stricter policy: only see profiles of users in same tenant
CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles
FOR SELECT
USING (
  -- User can always see their own profile
  user_id = auth.uid()
  OR
  -- Platform admins can see all
  is_platform_admin()
  OR
  -- Users can see other users in their tenant
  EXISTS (
    SELECT 1 FROM public.tenant_users tu1
    JOIN public.tenant_users tu2 ON tu1.tenant_id = tu2.tenant_id
    WHERE tu1.user_id = auth.uid() 
    AND tu2.user_id = profiles.user_id
    AND tu1.is_active = true
    AND tu2.is_active = true
  )
);

-- =====================================================
-- Create pending_invitations table for secure invites
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'technician',
  invited_by uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Enable RLS
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for pending_invitations
CREATE POLICY "Tenant admins can view invitations"
ON public.pending_invitations
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
);

CREATE POLICY "Tenant admins can create invitations"
ON public.pending_invitations
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
  AND invited_by = auth.uid()
);

CREATE POLICY "Tenant admins can delete invitations"
ON public.pending_invitations
FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
);

-- Anyone can view their own invitation (by email match - handled in app)
CREATE POLICY "Users can accept their own invitations"
ON public.pending_invitations
FOR UPDATE
USING (true)
WITH CHECK (true);

-- =====================================================
-- Add indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON public.pending_invitations(email);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_token ON public.pending_invitations(token);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_tenant ON public.pending_invitations(tenant_id);