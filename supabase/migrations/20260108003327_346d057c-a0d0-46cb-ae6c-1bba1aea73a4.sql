-- Create parts catalog table for commonly used parts
CREATE TABLE public.parts_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  part_number TEXT,
  default_unit_cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  category TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parts_catalog ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_parts_catalog_tenant ON public.parts_catalog(tenant_id);
CREATE INDEX idx_parts_catalog_name ON public.parts_catalog(part_name);

-- RLS Policies
CREATE POLICY "Users can view parts catalog in their tenant"
  ON public.parts_catalog FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Staff can create catalog parts"
  ON public.parts_catalog FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Staff can update catalog parts"
  ON public.parts_catalog FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can delete catalog parts"
  ON public.parts_catalog FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Trigger for updated_at
CREATE TRIGGER update_parts_catalog_updated_at
  BEFORE UPDATE ON public.parts_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();