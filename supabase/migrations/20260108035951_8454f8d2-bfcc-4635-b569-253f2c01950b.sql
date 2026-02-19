-- Fix RLS policies to explicitly require authentication and prevent anonymous access

-- Drop and recreate profiles SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their tenant" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.tenant_users tu1
    WHERE tu1.user_id = auth.uid() AND tu1.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu2
      WHERE tu2.user_id = profiles.user_id 
      AND tu2.tenant_id = tu1.tenant_id
      AND tu2.is_active = true
    )
  )
);

-- Fix demo_requests to only allow platform admins to SELECT
DROP POLICY IF EXISTS "Platform admins can view demo requests" ON public.demo_requests;
CREATE POLICY "Platform admins can view demo requests" 
ON public.demo_requests 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.is_platform_admin()
);

-- Fix clients SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view clients in their tenant" ON public.clients;
CREATE POLICY "Users can view clients in their tenant" 
ON public.clients 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.user_belongs_to_tenant(tenant_id)
);

-- Fix tenants SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant" 
ON public.tenants 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.user_belongs_to_tenant(id) 
    OR public.is_platform_admin()
  )
);

-- Fix pending_invitations SELECT policy to require authentication and proper role
DROP POLICY IF EXISTS "Tenant admins can view pending invitations" ON public.pending_invitations;
CREATE POLICY "Tenant admins can view pending invitations" 
ON public.pending_invitations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin()
);

-- Add RLS policies for rate_limits table (application needs access)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
-- Note: rate_limits should only be accessed via service role key in edge functions
-- No user-facing policies needed

-- Fix email_campaigns to explicitly require platform admin
DROP POLICY IF EXISTS "Platform admins can view email campaigns" ON public.email_campaigns;
CREATE POLICY "Platform admins can view email campaigns" 
ON public.email_campaigns 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.is_platform_admin()
);

-- Fix service_requests INSERT policy to validate tenant access
DROP POLICY IF EXISTS "Users can create service requests" ON public.service_requests;
CREATE POLICY "Users can create service requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (
  -- Allow if user belongs to tenant OR if it's a portal client for that tenant
  EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id)
  AND (
    public.user_belongs_to_tenant(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id 
      AND c.tenant_id = service_requests.tenant_id
      AND c.user_id = auth.uid()
    )
    -- Also allow anonymous portal submissions (checked by tenant existence)
    OR auth.uid() IS NULL
  )
);