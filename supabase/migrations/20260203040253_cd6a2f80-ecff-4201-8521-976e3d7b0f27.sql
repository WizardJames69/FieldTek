-- Create recurring_job_templates table
CREATE TABLE public.recurring_job_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES public.equipment_registry(id) ON DELETE SET NULL,
  assigned_to uuid,
  job_type text,
  priority job_priority NOT NULL DEFAULT 'medium',
  estimated_duration integer DEFAULT 60,
  address text,
  notes text,
  recurrence_pattern text NOT NULL CHECK (recurrence_pattern IN ('weekly', 'monthly', 'quarterly', 'annually')),
  recurrence_day integer NOT NULL DEFAULT 1,
  recurrence_interval integer NOT NULL DEFAULT 1,
  next_occurrence date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  auto_assign boolean NOT NULL DEFAULT true,
  advance_days integer NOT NULL DEFAULT 7,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add recurring_template_id to scheduled_jobs to track generated jobs
ALTER TABLE public.scheduled_jobs 
ADD COLUMN recurring_template_id uuid REFERENCES public.recurring_job_templates(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.recurring_job_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_job_templates
CREATE POLICY "Deny anonymous access to recurring_job_templates"
ON public.recurring_job_templates
FOR SELECT
USING (false);

CREATE POLICY "Users can view recurring templates in their tenant"
ON public.recurring_job_templates
FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage recurring templates"
ON public.recurring_job_templates
FOR ALL
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

CREATE POLICY "Staff can create recurring templates"
ON public.recurring_job_templates
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- Create updated_at trigger for recurring_job_templates
CREATE TRIGGER update_recurring_job_templates_updated_at
  BEFORE UPDATE ON public.recurring_job_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient querying
CREATE INDEX idx_recurring_templates_tenant_active ON public.recurring_job_templates(tenant_id, is_active);
CREATE INDEX idx_recurring_templates_next_occurrence ON public.recurring_job_templates(next_occurrence) WHERE is_active = true;
CREATE INDEX idx_scheduled_jobs_recurring_template ON public.scheduled_jobs(recurring_template_id) WHERE recurring_template_id IS NOT NULL;