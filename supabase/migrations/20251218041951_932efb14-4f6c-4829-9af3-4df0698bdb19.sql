-- Recreate the tenants INSERT policy to ensure it's properly applied
DROP POLICY IF EXISTS "Authenticated users can create a tenant" ON public.tenants;
CREATE POLICY "Authenticated users can create a tenant" ON public.tenants
  AS PERMISSIVE
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Also update SELECT policy to allow authenticated users to see their newly created tenant
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant" ON public.tenants
  AS PERMISSIVE
  FOR SELECT 
  TO authenticated 
  USING (owner_id = auth.uid() OR id = get_user_tenant_id());