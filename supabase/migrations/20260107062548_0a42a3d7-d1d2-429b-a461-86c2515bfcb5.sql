-- Fix 1: Add access control to create_default_stage_templates function
-- This prevents arbitrary callers from creating templates in other tenants' accounts
CREATE OR REPLACE FUNCTION public.create_default_stage_templates(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has access to this tenant (is owner/admin or new tenant owner)
  -- Allow if user belongs to tenant OR if this is a new tenant being created (trigger context)
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_users 
    WHERE user_id = auth.uid() 
    AND tenant_id = p_tenant_id 
    AND is_active = true
    AND role IN ('owner', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = p_tenant_id
    AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for tenant';
  END IF;

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

-- Fix 2: Create public branding bucket for logos and favicons
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for branding bucket
CREATE POLICY "Anyone can view branding assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'branding');

CREATE POLICY "Admins can upload branding"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND is_tenant_admin()
);

CREATE POLICY "Admins can update branding"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND is_tenant_admin()
);

CREATE POLICY "Admins can delete branding"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND is_tenant_admin()
);