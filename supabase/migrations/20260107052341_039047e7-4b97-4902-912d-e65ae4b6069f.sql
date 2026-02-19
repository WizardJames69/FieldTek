-- Create platform_admins table for platform-level administrators
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform admins can view the admins table
CREATE POLICY "Platform admins can view admins" ON public.platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- Create helper function to check if user is a platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  )
$$;

-- Update demo_requests policies to allow platform admins full access
CREATE POLICY "Platform admins can manage demo requests"
  ON public.demo_requests
  FOR ALL
  USING (is_platform_admin());

-- Allow platform admins to view all tenants
CREATE POLICY "Platform admins can view all tenants"
  ON public.tenants
  FOR SELECT
  USING (is_platform_admin());

-- Allow platform admins to view all tenant_users for analytics
CREATE POLICY "Platform admins can view all tenant users"
  ON public.tenant_users
  FOR SELECT
  USING (is_platform_admin());

-- Allow platform admins to view all scheduled_jobs for analytics
CREATE POLICY "Platform admins can view all jobs"
  ON public.scheduled_jobs
  FOR SELECT
  USING (is_platform_admin());