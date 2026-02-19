-- Create beta_applications table for tracking beta tester signups
CREATE TABLE public.beta_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  company_name text NOT NULL,
  industry text,
  technician_count text,
  interest_reason text,
  status text NOT NULL DEFAULT 'pending',
  promo_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beta_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a beta application (with validation)
CREATE POLICY "Anyone can submit beta applications"
ON public.beta_applications
FOR INSERT
WITH CHECK (email IS NOT NULL AND email <> '' AND company_name IS NOT NULL AND company_name <> '');

-- Anon cannot read beta applications
CREATE POLICY "Anon cannot read beta applications"
ON public.beta_applications
FOR SELECT
USING (false);

-- Only platform admins can read/manage beta applications
CREATE POLICY "Platform admins can manage beta applications"
ON public.beta_applications
FOR ALL
USING (is_platform_admin());

-- Add updated_at trigger
CREATE TRIGGER update_beta_applications_updated_at
BEFORE UPDATE ON public.beta_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for efficient queries
CREATE INDEX idx_beta_applications_status ON public.beta_applications(status);
CREATE INDEX idx_beta_applications_email ON public.beta_applications(email);