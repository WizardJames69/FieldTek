-- Add DELETE policy for platform admins on tenants table
CREATE POLICY "Platform admins can delete tenants"
ON public.tenants
FOR DELETE
USING (is_platform_admin());

-- Drop existing foreign key constraints and recreate with ON DELETE CASCADE
-- tenant_users
ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_tenant_id_fkey;
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- tenant_settings
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_tenant_id_fkey;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- tenant_branding
ALTER TABLE public.tenant_branding DROP CONSTRAINT IF EXISTS tenant_branding_tenant_id_fkey;
ALTER TABLE public.tenant_branding ADD CONSTRAINT tenant_branding_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- conversations
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_tenant_id_fkey;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- service_requests
ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_tenant_id_fkey;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- documents
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_tenant_id_fkey;
ALTER TABLE public.documents ADD CONSTRAINT documents_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- scheduled_jobs
ALTER TABLE public.scheduled_jobs DROP CONSTRAINT IF EXISTS scheduled_jobs_tenant_id_fkey;
ALTER TABLE public.scheduled_jobs ADD CONSTRAINT scheduled_jobs_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- clients
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_tenant_id_fkey;
ALTER TABLE public.clients ADD CONSTRAINT clients_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- equipment_registry
ALTER TABLE public.equipment_registry DROP CONSTRAINT IF EXISTS equipment_registry_tenant_id_fkey;
ALTER TABLE public.equipment_registry ADD CONSTRAINT equipment_registry_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- invoices
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_tenant_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- job_stage_templates
ALTER TABLE public.job_stage_templates DROP CONSTRAINT IF EXISTS job_stage_templates_tenant_id_fkey;
ALTER TABLE public.job_stage_templates ADD CONSTRAINT job_stage_templates_tenant_id_fkey 
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;