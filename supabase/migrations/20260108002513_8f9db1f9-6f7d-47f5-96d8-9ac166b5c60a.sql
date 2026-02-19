-- Create job_parts table for tracking parts needed during jobs
CREATE TABLE public.job_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  part_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  purchased BOOLEAN DEFAULT false,
  added_by UUID,
  added_to_invoice BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_parts ENABLE ROW LEVEL SECURITY;

-- Users can view parts in their tenant
CREATE POLICY "Users can view job parts in their tenant"
ON public.job_parts
FOR SELECT
USING (tenant_id = get_user_tenant_id());

-- Staff can create parts
CREATE POLICY "Staff can create job parts"
ON public.job_parts
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- Staff can update parts
CREATE POLICY "Staff can update job parts"
ON public.job_parts
FOR UPDATE
USING (tenant_id = get_user_tenant_id());

-- Admins can delete parts
CREATE POLICY "Admins can delete job parts"
ON public.job_parts
FOR DELETE
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_job_parts_updated_at
BEFORE UPDATE ON public.job_parts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for job lookups
CREATE INDEX idx_job_parts_job_id ON public.job_parts(job_id);
CREATE INDEX idx_job_parts_tenant_id ON public.job_parts(tenant_id);