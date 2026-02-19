-- Fix tenant_users SELECT policy to allow users to see their own record
DROP POLICY IF EXISTS "Users can view tenant members" ON public.tenant_users;

CREATE POLICY "Users can view tenant members"
ON public.tenant_users
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  OR user_id = auth.uid()
  OR is_platform_admin()
);

-- Fix onboarding_progress UPDATE policy for new tenant owners
DROP POLICY IF EXISTS "Users can update their tenant onboarding progress" ON public.onboarding_progress;

CREATE POLICY "Users can update their tenant onboarding progress"
ON public.onboarding_progress
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
);

-- Also fix the SELECT policy for onboarding_progress
DROP POLICY IF EXISTS "Users can view their tenant onboarding progress" ON public.onboarding_progress;

CREATE POLICY "Users can view their tenant onboarding progress"
ON public.onboarding_progress
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  OR is_platform_admin()
);