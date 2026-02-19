
-- Fix #1: Replace overly permissive portal_invitations SELECT policy
-- Drop the dangerous "Anyone can validate invitation tokens" policy
DROP POLICY IF EXISTS "Anyone can validate invitation tokens" ON public.portal_invitations;

-- Create a secure function to validate portal invitation tokens
CREATE OR REPLACE FUNCTION public.validate_portal_invitation_token(p_token text)
RETURNS TABLE(id uuid, client_id uuid, tenant_id uuid, email text, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT pi.id, pi.client_id, pi.tenant_id, pi.email, pi.expires_at, pi.accepted_at
  FROM public.portal_invitations pi
  WHERE pi.token = p_token
  LIMIT 1;
END;
$$;

-- Only allow tenant members to SELECT portal invitations for their own tenant
CREATE POLICY "Tenant members can view their own invitations"
ON public.portal_invitations
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));
