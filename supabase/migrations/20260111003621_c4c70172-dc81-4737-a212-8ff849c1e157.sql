-- Fix tenant_users INSERT policy to allow new owners to add themselves
DROP POLICY IF EXISTS "Tenant admins can add users" ON public.tenant_users;

CREATE POLICY "Users can add themselves as owner to their owned tenant"
ON public.tenant_users
FOR INSERT
WITH CHECK (
  -- Platform admins can add anyone
  is_platform_admin() 
  OR 
  -- Existing tenant admins can add users to their tenant
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  -- New owners can add themselves to their newly created tenant
  (
    user_id = auth.uid() 
    AND role = 'owner' 
    AND tenant_id IN (
      SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
  )
);

-- Fix tenant_branding INSERT policy to allow new owners
DROP POLICY IF EXISTS "Admins can create tenant branding" ON public.tenant_branding;

CREATE POLICY "Owners can create tenant branding"
ON public.tenant_branding
FOR INSERT
WITH CHECK (
  -- Existing tenant admins
  ((tenant_id = get_user_tenant_id()) AND is_tenant_admin())
  OR
  -- New owners creating branding for their tenant
  (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()))
);