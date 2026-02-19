-- Multi-Tenant Field Service Management SaaS Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'dispatcher', 'technician', 'client');
CREATE TYPE public.subscription_tier AS ENUM ('trial', 'starter', 'professional', 'enterprise');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'cancelled', 'past_due');
CREATE TYPE public.job_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.job_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.industry_type AS ENUM ('hvac', 'plumbing', 'electrical', 'mechanical', 'general');
CREATE TYPE public.request_status AS ENUM ('new', 'reviewed', 'approved', 'rejected', 'converted');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- 1. TENANTS TABLE (Organizations/Companies)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry public.industry_type DEFAULT 'general',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_tier public.subscription_tier DEFAULT 'trial',
  subscription_status public.subscription_status DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TENANT BRANDING TABLE (White-label settings)
CREATE TABLE public.tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e3a5f',
  secondary_color TEXT DEFAULT '#f59e0b',
  company_name TEXT,
  favicon_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TENANT USERS TABLE (User-Tenant relationships with roles)
CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'technician',
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 4. TENANT SETTINGS TABLE (Industry customization)
CREATE TABLE public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  equipment_types JSONB DEFAULT '[]'::jsonb,
  job_types JSONB DEFAULT '[]'::jsonb,
  document_categories JSONB DEFAULT '[]'::jsonb,
  workflow_stages JSONB DEFAULT '[]'::jsonb,
  features_enabled JSONB DEFAULT '{"ai_assistant": true, "invoicing": true, "equipment_tracking": true}'::jsonb,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PROFILES TABLE (User profiles with tenant context)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  email TEXT,
  certifications JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. CLIENTS TABLE (Customer records per tenant)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. EQUIPMENT REGISTRY TABLE
CREATE TABLE public.equipment_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  equipment_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  install_date DATE,
  warranty_expiry DATE,
  location_notes TEXT,
  status TEXT DEFAULT 'active',
  specifications JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. SCHEDULED JOBS TABLE
CREATE TABLE public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  equipment_id UUID REFERENCES public.equipment_registry(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.job_status DEFAULT 'pending',
  priority public.job_priority DEFAULT 'medium',
  job_type TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  estimated_duration INTEGER DEFAULT 60,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  address TEXT,
  current_stage TEXT,
  stage_data JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. SERVICE REQUESTS TABLE (Client-submitted requests)
CREATE TABLE public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  request_type TEXT,
  priority public.job_priority DEFAULT 'medium',
  status public.request_status DEFAULT 'new',
  photos JSONB DEFAULT '[]'::jsonb,
  ai_analysis JSONB,
  converted_job_id UUID REFERENCES public.scheduled_jobs(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. INVOICES TABLE
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.scheduled_jobs(id) ON DELETE SET NULL,
  status public.invoice_status DEFAULT 'draft',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, invoice_number)
);

-- 11. INVOICE LINE ITEMS TABLE
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  item_type TEXT DEFAULT 'service',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. DOCUMENTS TABLE
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  equipment_types JSONB DEFAULT '[]'::jsonb,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. CONVERSATIONS TABLE (AI Chat)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Conversation',
  context_type TEXT,
  context_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. MESSAGES TABLE
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. JOB STAGE TEMPLATES TABLE
CREATE TABLE public.job_stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  job_type TEXT,
  checklist_items JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. JOB CHECKLIST COMPLETIONS TABLE
CREATE TABLE public.job_checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  checklist_item TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX idx_scheduled_jobs_tenant_id ON public.scheduled_jobs(tenant_id);
CREATE INDEX idx_scheduled_jobs_assigned_to ON public.scheduled_jobs(assigned_to);
CREATE INDEX idx_scheduled_jobs_status ON public.scheduled_jobs(status);
CREATE INDEX idx_scheduled_jobs_scheduled_date ON public.scheduled_jobs(scheduled_date);
CREATE INDEX idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX idx_service_requests_tenant_id ON public.service_requests(tenant_id);
CREATE INDEX idx_equipment_registry_tenant_id ON public.equipment_registry(tenant_id);
CREATE INDEX idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX idx_conversations_tenant_id ON public.conversations(tenant_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);

-- Helper function to get current user's tenant ID
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.tenant_users 
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
    AND role = _role 
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user has role in specific tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
    AND tenant_id = _tenant_id
    AND role = _role 
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user is admin or owner of their tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenant_branding_updated_at BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_registry_updated_at BEFORE UPDATE ON public.equipment_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scheduled_jobs_updated_at BEFORE UPDATE ON public.scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_stage_templates_updated_at BEFORE UPDATE ON public.job_stage_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklist_completions ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Tenants: Users can only see their own tenant
CREATE POLICY "Users can view their tenant" ON public.tenants
  FOR SELECT USING (id = public.get_user_tenant_id());

CREATE POLICY "Owners can update their tenant" ON public.tenants
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Anyone can create a tenant" ON public.tenants
  FOR INSERT WITH CHECK (true);

-- Tenant Branding
CREATE POLICY "Users can view their tenant branding" ON public.tenant_branding
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage tenant branding" ON public.tenant_branding
  FOR ALL USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- Tenant Users
CREATE POLICY "Users can view tenant members" ON public.tenant_users
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage tenant users" ON public.tenant_users
  FOR ALL USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

CREATE POLICY "Users can join tenants" ON public.tenant_users
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Tenant Settings
CREATE POLICY "Users can view tenant settings" ON public.tenant_settings
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage tenant settings" ON public.tenant_settings
  FOR ALL USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- Profiles
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
  FOR SELECT USING (
    user_id = auth.uid() OR
    user_id IN (SELECT user_id FROM public.tenant_users WHERE tenant_id = public.get_user_tenant_id())
  );

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Clients
CREATE POLICY "Users can view clients in their tenant" ON public.clients
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can manage clients" ON public.clients
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Equipment Registry
CREATE POLICY "Users can view equipment in their tenant" ON public.equipment_registry
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can manage equipment" ON public.equipment_registry
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Scheduled Jobs
CREATE POLICY "Users can view jobs in their tenant" ON public.scheduled_jobs
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can create jobs" ON public.scheduled_jobs
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Staff can update jobs" ON public.scheduled_jobs
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can delete jobs" ON public.scheduled_jobs
  FOR DELETE USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- Service Requests
CREATE POLICY "Users can view service requests in their tenant" ON public.service_requests
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Anyone can create service requests" ON public.service_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update service requests" ON public.service_requests
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

-- Invoices
CREATE POLICY "Users can view invoices in their tenant" ON public.invoices
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage invoices" ON public.invoices
  FOR ALL USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- Invoice Line Items
CREATE POLICY "Users can view invoice items" ON public.invoice_line_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM public.invoices WHERE tenant_id = public.get_user_tenant_id())
  );

CREATE POLICY "Admins can manage invoice items" ON public.invoice_line_items
  FOR ALL USING (
    invoice_id IN (SELECT id FROM public.invoices WHERE tenant_id = public.get_user_tenant_id())
    AND public.is_tenant_admin()
  );

-- Documents
CREATE POLICY "Users can view documents in their tenant" ON public.documents
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage documents" ON public.documents
  FOR ALL USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- Conversations
CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can update their conversations" ON public.conversations
  FOR UPDATE USING (user_id = auth.uid());

-- Messages
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
  );

-- Job Stage Templates
CREATE POLICY "Users can view stage templates" ON public.job_stage_templates
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can manage stage templates" ON public.job_stage_templates
  FOR ALL USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- Job Checklist Completions
CREATE POLICY "Users can view checklist completions" ON public.job_checklist_completions
  FOR SELECT USING (
    job_id IN (SELECT id FROM public.scheduled_jobs WHERE tenant_id = public.get_user_tenant_id())
  );

CREATE POLICY "Staff can manage checklist completions" ON public.job_checklist_completions
  FOR ALL USING (
    job_id IN (SELECT id FROM public.scheduled_jobs WHERE tenant_id = public.get_user_tenant_id())
  );

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;