-- Fix tenants SELECT policy to allow owners to view their newly created tenant
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;

CREATE POLICY "Users can view their tenant"
ON public.tenants
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    user_belongs_to_tenant(id) 
    OR is_platform_admin()
    OR owner_id = auth.uid()  -- Allow owners to see their own tenant immediately
  )
);