-- Fix function search paths for security

-- Update get_user_tenant_id function
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.tenant_users 
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
    AND role = _role 
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update has_tenant_role function
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
    AND tenant_id = _tenant_id
    AND role = _role 
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update is_tenant_admin function
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;