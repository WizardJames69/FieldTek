
-- Create tenant_api_keys table for Professional tier REST API access
CREATE TABLE public.tenant_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  key_prefix   text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  scopes       text[] NOT NULL DEFAULT ARRAY['read'],
  last_used_at timestamp with time zone,
  expires_at   timestamp with time zone,
  revoked_at   timestamp with time zone,
  created_by   uuid NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anon access to tenant_api_keys"
ON public.tenant_api_keys FOR SELECT
USING (false);

-- Admins can manage their tenant's API keys
CREATE POLICY "Admins can manage API keys"
ON public.tenant_api_keys FOR ALL
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Authenticated admins can view their keys
CREATE POLICY "Admins can view their tenant API keys"
ON public.tenant_api_keys FOR SELECT
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

CREATE INDEX idx_tenant_api_keys_tenant_id ON public.tenant_api_keys(tenant_id);
CREATE INDEX idx_tenant_api_keys_key_hash ON public.tenant_api_keys(key_hash);
