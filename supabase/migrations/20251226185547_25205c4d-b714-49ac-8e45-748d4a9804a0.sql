-- Drop the existing INSERT policy that only allows owners
DROP POLICY IF EXISTS "Owners can create tenant branding" ON public.tenant_branding;

-- Create a new INSERT policy that allows admins (including owners) to create branding
CREATE POLICY "Admins can create tenant branding"
ON public.tenant_branding
FOR INSERT
WITH CHECK (
  (tenant_id = get_user_tenant_id()) AND is_tenant_admin()
);