-- Create onboarding_progress table to track tenant setup completion
CREATE TABLE public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Setup steps completion
  company_info_completed BOOLEAN DEFAULT false,
  branding_completed BOOLEAN DEFAULT false,
  first_team_member_invited BOOLEAN DEFAULT false,
  first_client_added BOOLEAN DEFAULT false,
  first_job_created BOOLEAN DEFAULT false,
  first_invoice_created BOOLEAN DEFAULT false,
  payment_method_added BOOLEAN DEFAULT false,
  
  -- Timestamps for each step
  company_info_completed_at TIMESTAMP WITH TIME ZONE,
  branding_completed_at TIMESTAMP WITH TIME ZONE,
  first_team_member_invited_at TIMESTAMP WITH TIME ZONE,
  first_client_added_at TIMESTAMP WITH TIME ZONE,
  first_job_created_at TIMESTAMP WITH TIME ZONE,
  first_invoice_created_at TIMESTAMP WITH TIME ZONE,
  payment_method_added_at TIMESTAMP WITH TIME ZONE,
  
  -- Overall progress
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Platform admins can view all onboarding progress"
ON public.onboarding_progress
FOR SELECT
USING (is_platform_admin());

CREATE POLICY "Platform admins can manage onboarding progress"
ON public.onboarding_progress
FOR ALL
USING (is_platform_admin());

CREATE POLICY "Users can view their tenant onboarding progress"
ON public.onboarding_progress
FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their tenant onboarding progress"
ON public.onboarding_progress
FOR UPDATE
USING (tenant_id = get_user_tenant_id());

-- Auto-create onboarding progress when tenant is created
CREATE OR REPLACE FUNCTION public.auto_create_onboarding_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.onboarding_progress (tenant_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_onboarding_progress_on_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_onboarding_progress();

-- Add trigger for updated_at
CREATE TRIGGER update_onboarding_progress_updated_at
BEFORE UPDATE ON public.onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add pipeline stage to demo_requests for tracking
ALTER TABLE public.demo_requests 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS converted_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS demo_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;