
CREATE TABLE public.portal_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_invitations ENABLE ROW LEVEL SECURITY;

-- Tenant members can view their invitations
CREATE POLICY "Tenant members can view portal invitations"
  ON public.portal_invitations FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true
  ));

-- Allow anonymous reads for token validation during signup
CREATE POLICY "Anyone can validate invitation tokens"
  ON public.portal_invitations FOR SELECT
  USING (true);

-- Tenant admins can insert invitations
CREATE POLICY "Tenant admins can insert portal invitations"
  ON public.portal_invitations FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid() AND is_active = true 
    AND role IN ('owner', 'admin', 'dispatcher')
  ));

-- Tenant admins can update invitations (mark as accepted)
CREATE POLICY "Tenant admins can update portal invitations"
  ON public.portal_invitations FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid() AND is_active = true 
    AND role IN ('owner', 'admin', 'dispatcher')
  ));
