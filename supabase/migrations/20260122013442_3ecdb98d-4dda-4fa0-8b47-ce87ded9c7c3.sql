-- Create team_invitations table for secure invite flow
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'technician',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate pending invitations for same email/tenant
  CONSTRAINT unique_pending_invitation UNIQUE (tenant_id, email)
);

-- Add index for token lookup
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for team_invitations
-- Tenant admins/owners can view their invitations
CREATE POLICY "Tenant admins can view invitations"
ON public.team_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
    AND tenant_users.tenant_id = team_invitations.tenant_id
    AND tenant_users.role IN ('owner', 'admin')
    AND tenant_users.is_active = true
  )
);

-- Tenant admins/owners can create invitations
CREATE POLICY "Tenant admins can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
    AND tenant_users.tenant_id = team_invitations.tenant_id
    AND tenant_users.role IN ('owner', 'admin')
    AND tenant_users.is_active = true
  )
);

-- Tenant admins can delete/revoke invitations
CREATE POLICY "Tenant admins can delete invitations"
ON public.team_invitations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
    AND tenant_users.tenant_id = team_invitations.tenant_id
    AND tenant_users.role IN ('owner', 'admin')
    AND tenant_users.is_active = true
  )
);

-- Create a security definer function for accepting invitations
-- This allows the accept-invite edge function to process invitations securely
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token TEXT, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_result jsonb;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = p_token
  AND accepted_at IS NULL
  AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user is already a member of this tenant
  IF EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = p_user_id
    AND tenant_id = v_invitation.tenant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this team');
  END IF;
  
  -- Create the tenant_user record
  INSERT INTO tenant_users (tenant_id, user_id, role, invited_by, invited_at, is_active)
  VALUES (
    v_invitation.tenant_id,
    p_user_id,
    v_invitation.role,
    v_invitation.invited_by,
    v_invitation.created_at,
    true
  );
  
  -- Mark invitation as accepted
  UPDATE team_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_invitation.tenant_id,
    'role', v_invitation.role
  );
END;
$$;

-- Create function to lookup invitation by token (for public access)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT 
    ti.id,
    ti.email,
    ti.role,
    ti.expires_at,
    ti.accepted_at,
    t.name as tenant_name
  INTO v_invitation
  FROM team_invitations ti
  JOIN tenants t ON t.id = ti.tenant_id
  WHERE ti.token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;
  
  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation already used');
  END IF;
  
  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation has expired');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invitation.email,
    'role', v_invitation.role,
    'tenant_name', v_invitation.tenant_name,
    'expires_at', v_invitation.expires_at
  );
END;
$$;