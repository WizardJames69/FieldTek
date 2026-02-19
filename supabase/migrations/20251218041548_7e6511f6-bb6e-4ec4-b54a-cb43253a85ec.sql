-- Fix tenants INSERT policy to explicitly target authenticated users
DROP POLICY IF EXISTS "Anyone can create a tenant" ON public.tenants;
CREATE POLICY "Authenticated users can create a tenant" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (true);

-- Fix tenant_users INSERT policy
DROP POLICY IF EXISTS "Users can join tenants" ON public.tenant_users;
CREATE POLICY "Users can join tenants" ON public.tenant_users
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Add INSERT policy for tenant_settings (allow owners during onboarding)
CREATE POLICY "Owners can create tenant settings" ON public.tenant_settings
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  );

-- Add INSERT policy for tenant_branding (allow owners during onboarding)
CREATE POLICY "Owners can create tenant branding" ON public.tenant_branding
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  );