-- Phase 1: Database Schema Updates for FieldTek Platform

-- 1.1 Add warranty tracking columns to equipment_registry
ALTER TABLE public.equipment_registry 
ADD COLUMN IF NOT EXISTS warranty_start_date date,
ADD COLUMN IF NOT EXISTS warranty_type text DEFAULT 'standard';

-- 1.2 Add AI analysis timestamp to service_requests
ALTER TABLE public.service_requests 
ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamp with time zone;

-- 1.3 Add workflow columns to scheduled_jobs
ALTER TABLE public.scheduled_jobs 
ADD COLUMN IF NOT EXISTS checklist_progress jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS workflow_stage text;

-- 1.4 Insert default job stage templates for each industry/job type combination
-- Clear existing templates first to avoid duplicates
DELETE FROM public.job_stage_templates WHERE tenant_id IN (SELECT id FROM public.tenants);

-- We'll insert templates per-tenant using a function
CREATE OR REPLACE FUNCTION public.create_default_stage_templates(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- STARTUP stage templates
  INSERT INTO public.job_stage_templates (tenant_id, stage_name, job_type, order_index, checklist_items)
  VALUES 
    (p_tenant_id, 'Startup', 'Installation', 1, '[
      {"id": "1", "label": "Verify equipment delivery and condition", "type": "checkbox", "required": true},
      {"id": "2", "label": "Check electrical connections", "type": "pass_fail", "required": true},
      {"id": "3", "label": "Verify refrigerant charge", "type": "pass_fail", "required": true},
      {"id": "4", "label": "Test thermostat communication", "type": "pass_fail", "required": true},
      {"id": "5", "label": "Measure supply voltage", "type": "measurement", "unit": "V", "required": true},
      {"id": "6", "label": "Customer walkthrough completed", "type": "checkbox", "required": true},
      {"id": "7", "label": "Startup notes", "type": "text", "required": false}
    ]'::jsonb),
    
  -- SERVICE stage templates
    (p_tenant_id, 'Service', 'Repair', 1, '[
      {"id": "1", "label": "Diagnose reported issue", "type": "checkbox", "required": true},
      {"id": "2", "label": "Check system pressures", "type": "measurement", "unit": "PSI", "required": true},
      {"id": "3", "label": "Measure amperage draw", "type": "measurement", "unit": "A", "required": true},
      {"id": "4", "label": "Inspect electrical components", "type": "pass_fail", "required": true},
      {"id": "5", "label": "Test safety controls", "type": "pass_fail", "required": true},
      {"id": "6", "label": "Repair completed", "type": "checkbox", "required": true},
      {"id": "7", "label": "System operational test", "type": "pass_fail", "required": true},
      {"id": "8", "label": "Service notes", "type": "text", "required": false}
    ]'::jsonb),
    
  -- MAINTENANCE stage templates
    (p_tenant_id, 'Maintenance', 'Maintenance', 1, '[
      {"id": "1", "label": "Replace/clean air filter", "type": "checkbox", "required": true},
      {"id": "2", "label": "Clean condenser coil", "type": "checkbox", "required": true},
      {"id": "3", "label": "Check refrigerant levels", "type": "pass_fail", "required": true},
      {"id": "4", "label": "Inspect ductwork", "type": "pass_fail", "required": false},
      {"id": "5", "label": "Lubricate moving parts", "type": "checkbox", "required": true},
      {"id": "6", "label": "Test thermostat operation", "type": "pass_fail", "required": true},
      {"id": "7", "label": "Measure temperature differential", "type": "measurement", "unit": "°F", "required": true},
      {"id": "8", "label": "Maintenance notes", "type": "text", "required": false}
    ]'::jsonb),
    
  -- INSPECTION stage templates
    (p_tenant_id, 'Inspection', 'Inspection', 1, '[
      {"id": "1", "label": "Visual inspection of unit", "type": "pass_fail", "required": true},
      {"id": "2", "label": "Check for refrigerant leaks", "type": "pass_fail", "required": true},
      {"id": "3", "label": "Inspect electrical connections", "type": "pass_fail", "required": true},
      {"id": "4", "label": "Check condensate drain", "type": "pass_fail", "required": true},
      {"id": "5", "label": "Measure supply air temperature", "type": "measurement", "unit": "°F", "required": true},
      {"id": "6", "label": "Measure return air temperature", "type": "measurement", "unit": "°F", "required": true},
      {"id": "7", "label": "Overall system rating", "type": "pass_fail", "required": true},
      {"id": "8", "label": "Recommendations", "type": "text", "required": false}
    ]'::jsonb);
END;
$$;

-- Create a trigger to auto-create templates for new tenants
CREATE OR REPLACE FUNCTION public.auto_create_stage_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_default_stage_templates(NEW.id);
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS create_stage_templates_on_tenant ON public.tenants;

-- Create trigger
CREATE TRIGGER create_stage_templates_on_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_stage_templates();