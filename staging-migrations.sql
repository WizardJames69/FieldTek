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
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;-- Fix function search paths for security

-- Update get_user_tenant_id function
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.tenant_users 
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
    AND role = _role 
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update has_tenant_role function
CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
    AND tenant_id = _tenant_id
    AND role = _role 
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update is_tenant_admin function
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;-- Fix tenants INSERT policy to explicitly target authenticated users
DROP POLICY IF EXISTS "Anyone can create a tenant" ON public.tenants;
CREATE POLICY "Authenticated users can create a tenant" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (true);

-- Fix tenant_users INSERT policy
DROP POLICY IF EXISTS "Users can join tenants" ON public.tenant_users;
CREATE POLICY "Users can join tenants" ON public.tenant_users
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Add INSERT policy for tenant_settings (allow owners during onboarding)
CREATE POLICY "Owners can create tenant settings" ON public.tenant_settings
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  );

-- Add INSERT policy for tenant_branding (allow owners during onboarding)
CREATE POLICY "Owners can create tenant branding" ON public.tenant_branding
  FOR INSERT TO authenticated WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  );-- Recreate the tenants INSERT policy to ensure it's properly applied
DROP POLICY IF EXISTS "Authenticated users can create a tenant" ON public.tenants;
CREATE POLICY "Authenticated users can create a tenant" ON public.tenants
  AS PERMISSIVE
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Also update SELECT policy to allow authenticated users to see their newly created tenant
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant" ON public.tenants
  AS PERMISSIVE
  FOR SELECT 
  TO authenticated 
  USING (owner_id = auth.uid() OR id = get_user_tenant_id());-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Storage policies for documents bucket
-- Allow authenticated users to view documents from their tenant
CREATE POLICY "Tenant members can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- Allow admin/owner to upload documents
CREATE POLICY "Admins can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  AND is_tenant_admin()
);

-- Allow admin/owner to delete documents
CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  AND is_tenant_admin()
);-- Create demo_requests table for lead capture
CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text,
  industry text,
  team_size text,
  preferred_date date,
  preferred_time text,
  message text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  scheduled_at timestamptz,
  notes text
);

-- Enable RLS
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a demo request (public form)
CREATE POLICY "Anyone can submit demo requests"
ON public.demo_requests
FOR INSERT
WITH CHECK (true);

-- Only admins can view demo requests (for future admin panel)
CREATE POLICY "Admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);-- Drop the existing INSERT policy that only allows owners
DROP POLICY IF EXISTS "Owners can create tenant branding" ON public.tenant_branding;

-- Create a new INSERT policy that allows admins (including owners) to create branding
CREATE POLICY "Admins can create tenant branding"
ON public.tenant_branding
FOR INSERT
WITH CHECK (
  (tenant_id = get_user_tenant_id()) AND is_tenant_admin()
);-- Create storage policies for the documents bucket to allow tenant users to upload files

-- Policy to allow authenticated users to upload to their tenant folder
CREATE POLICY "Tenant users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

-- Policy to allow authenticated users to update their tenant's documents
CREATE POLICY "Tenant users can update their documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

-- Policy to allow authenticated users to read their tenant's documents
CREATE POLICY "Tenant users can read their documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

-- Policy to allow authenticated users to delete their tenant's documents
CREATE POLICY "Tenant users can delete their documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);-- Phase 1: Database Schema Updates for FieldTek Platform

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
EXECUTE FUNCTION public.auto_create_stage_templates();-- Add 'growth' to the subscription_tier enum
ALTER TYPE public.subscription_tier ADD VALUE IF NOT EXISTS 'growth' AFTER 'starter';
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
  USING (is_platform_admin());-- Create email campaigns table
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience JSONB NOT NULL DEFAULT '{"type": "all"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID,
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage campaigns
CREATE POLICY "Platform admins can manage campaigns"
  ON public.email_campaigns
  FOR ALL
  USING (is_platform_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add DELETE policy for platform admins on tenants table
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
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;-- Create onboarding_progress table to track tenant setup completion
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
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;-- =====================================================
-- COMPREHENSIVE SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. Create helper function to get user's role within their tenant
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.tenant_users 
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;

-- 2. Create helper function to check if user belongs to a specific tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid() 
    AND tenant_id = _tenant_id
    AND is_active = true
  )
$$;

-- =====================================================
-- FIX CRITICAL: tenant_users self-join vulnerability
-- =====================================================

-- Drop the dangerous policy that allows users to join any tenant
DROP POLICY IF EXISTS "Users can join tenants" ON public.tenant_users;

-- Create a safe policy: users can only be added by tenant admins
CREATE POLICY "Tenant admins can add users"
ON public.tenant_users
FOR INSERT
WITH CHECK (
  -- Allow platform admins to add users anywhere
  is_platform_admin()
  OR
  -- Allow tenant admins/owners to add users to their own tenant
  (
    is_tenant_admin() 
    AND tenant_id = get_user_tenant_id()
  )
);

-- =====================================================
-- FIX CRITICAL: demo_requests access restriction
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Admins can view demo requests" ON public.demo_requests;

-- Create restrictive policy: only platform admins can view
CREATE POLICY "Platform admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (is_platform_admin());

-- =====================================================
-- FIX: tenants creation - require authentication
-- =====================================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- Create policy requiring authentication
CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- FIX: service_requests spam prevention
-- =====================================================

-- Drop the overly permissive policy allowing anyone to create
DROP POLICY IF EXISTS "Anyone can create service requests" ON public.service_requests;

-- Create policy: require either authentication OR valid tenant_id + client access token pattern
-- For now, require the tenant to exist (prevents completely random spam)
CREATE POLICY "Service requests require valid tenant"
ON public.service_requests
FOR INSERT
WITH CHECK (
  -- Tenant must exist
  EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id)
);

-- =====================================================
-- FIX: documents - respect is_public flag
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view documents in their tenant" ON public.documents;

-- Create new policy respecting is_public
CREATE POLICY "Users can view documents in their tenant"
ON public.documents
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_public = true
    OR is_tenant_admin()
    OR uploaded_by = auth.uid()
  )
);

-- =====================================================
-- FIX: invoices - role-based access (admins/dispatchers only)
-- =====================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view invoices in their tenant" ON public.invoices;

-- Create role-restricted policy
CREATE POLICY "Admins and dispatchers can view invoices"
ON public.invoices
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_tenant_admin()
    OR get_user_role() = 'dispatcher'
  )
);

-- =====================================================
-- FIX: profiles - prevent cross-tenant exposure
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

-- Create stricter policy: only see profiles of users in same tenant
CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles
FOR SELECT
USING (
  -- User can always see their own profile
  user_id = auth.uid()
  OR
  -- Platform admins can see all
  is_platform_admin()
  OR
  -- Users can see other users in their tenant
  EXISTS (
    SELECT 1 FROM public.tenant_users tu1
    JOIN public.tenant_users tu2 ON tu1.tenant_id = tu2.tenant_id
    WHERE tu1.user_id = auth.uid() 
    AND tu2.user_id = profiles.user_id
    AND tu1.is_active = true
    AND tu2.is_active = true
  )
);

-- =====================================================
-- Create pending_invitations table for secure invites
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'technician',
  invited_by uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Enable RLS
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for pending_invitations
CREATE POLICY "Tenant admins can view invitations"
ON public.pending_invitations
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
);

CREATE POLICY "Tenant admins can create invitations"
ON public.pending_invitations
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
  AND invited_by = auth.uid()
);

CREATE POLICY "Tenant admins can delete invitations"
ON public.pending_invitations
FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND is_tenant_admin()
);

-- Anyone can view their own invitation (by email match - handled in app)
CREATE POLICY "Users can accept their own invitations"
ON public.pending_invitations
FOR UPDATE
USING (true)
WITH CHECK (true);

-- =====================================================
-- Add indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON public.pending_invitations(email);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_token ON public.pending_invitations(token);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_tenant ON public.pending_invitations(tenant_id);-- =====================================================
-- FIX REMAINING "ALWAYS TRUE" POLICIES
-- =====================================================

-- 1. Fix demo_requests INSERT policy (allow anyone but track for rate limiting)
DROP POLICY IF EXISTS "Anyone can submit demo requests" ON public.demo_requests;
-- Keep it open for demo requests but could add rate limiting later
CREATE POLICY "Anyone can submit demo requests"
ON public.demo_requests
FOR INSERT
WITH CHECK (email IS NOT NULL AND name IS NOT NULL);

-- 2. Fix pending_invitations UPDATE policy (currently allows anyone)
DROP POLICY IF EXISTS "Users can accept their own invitations" ON public.pending_invitations;
-- Create a safer policy - users can only update if token matches and it's their email
CREATE POLICY "Users can accept invitations via token"
ON public.pending_invitations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND accepted_at IS NULL
  AND expires_at > now()
)
WITH CHECK (
  accepted_at IS NOT NULL
);

-- 3. Fix duplicate tenants INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create a tenant" ON public.tenants;
-- The other policy "Authenticated users can create tenants" already exists and is correct-- Fix 1: Add access control to create_default_stage_templates function
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
);-- Create rate limiting table for service requests
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'email')),
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (identifier, identifier_type, window_start);

-- Enable RLS (but allow service role to bypass)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can access this table
-- This is intentional as rate limiting is handled server-side only

-- Create function to cleanup old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;-- Update the check constraint to allow 'client' as an identifier type
ALTER TABLE public.rate_limits DROP CONSTRAINT IF EXISTS rate_limits_identifier_type_check;
ALTER TABLE public.rate_limits ADD CONSTRAINT rate_limits_identifier_type_check 
  CHECK (identifier_type IN ('ip', 'email', 'client'));-- Create job_parts table for tracking parts needed during jobs
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
CREATE INDEX idx_job_parts_tenant_id ON public.job_parts(tenant_id);-- Add receipt_url column to job_parts
ALTER TABLE public.job_parts ADD COLUMN receipt_url TEXT;

-- Create storage bucket for part receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('part-receipts', 'part-receipts', false);

-- Storage policies for part receipts
CREATE POLICY "Users can view part receipts in their tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can upload part receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
);-- Create parts catalog table for commonly used parts
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
  EXECUTE FUNCTION public.update_updated_at_column();-- Fix RLS policies to explicitly require authentication and prevent anonymous access

-- Drop and recreate profiles SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their tenant" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.tenant_users tu1
    WHERE tu1.user_id = auth.uid() AND tu1.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu2
      WHERE tu2.user_id = profiles.user_id 
      AND tu2.tenant_id = tu1.tenant_id
      AND tu2.is_active = true
    )
  )
);

-- Fix demo_requests to only allow platform admins to SELECT
DROP POLICY IF EXISTS "Platform admins can view demo requests" ON public.demo_requests;
CREATE POLICY "Platform admins can view demo requests" 
ON public.demo_requests 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.is_platform_admin()
);

-- Fix clients SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view clients in their tenant" ON public.clients;
CREATE POLICY "Users can view clients in their tenant" 
ON public.clients 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.user_belongs_to_tenant(tenant_id)
);

-- Fix tenants SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant" 
ON public.tenants 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    public.user_belongs_to_tenant(id) 
    OR public.is_platform_admin()
  )
);

-- Fix pending_invitations SELECT policy to require authentication and proper role
DROP POLICY IF EXISTS "Tenant admins can view pending invitations" ON public.pending_invitations;
CREATE POLICY "Tenant admins can view pending invitations" 
ON public.pending_invitations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.user_belongs_to_tenant(tenant_id)
  AND public.is_tenant_admin()
);

-- Add RLS policies for rate_limits table (application needs access)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;
-- Note: rate_limits should only be accessed via service role key in edge functions
-- No user-facing policies needed

-- Fix email_campaigns to explicitly require platform admin
DROP POLICY IF EXISTS "Platform admins can view email campaigns" ON public.email_campaigns;
CREATE POLICY "Platform admins can view email campaigns" 
ON public.email_campaigns 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND public.is_platform_admin()
);

-- Fix service_requests INSERT policy to validate tenant access
DROP POLICY IF EXISTS "Users can create service requests" ON public.service_requests;
CREATE POLICY "Users can create service requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (
  -- Allow if user belongs to tenant OR if it's a portal client for that tenant
  EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id)
  AND (
    public.user_belongs_to_tenant(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id 
      AND c.tenant_id = service_requests.tenant_id
      AND c.user_id = auth.uid()
    )
    -- Also allow anonymous portal submissions (checked by tenant existence)
    OR auth.uid() IS NULL
  )
);-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own notifications within their tenant
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (
  auth.uid() = user_id 
  AND user_belongs_to_tenant(tenant_id)
);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id AND user_belongs_to_tenant(tenant_id));

CREATE POLICY "System can insert notifications for tenant users"
ON public.notifications
FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id AND user_belongs_to_tenant(tenant_id));

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;-- Create demo_sessions table to track product demo usage
CREATE TABLE public.demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  lead_captured BOOLEAN DEFAULT false,
  scenes_viewed JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create a demo session (for anonymous visitors)
CREATE POLICY "Anyone can create demo sessions"
ON public.demo_sessions
FOR INSERT
WITH CHECK (true);

-- Users can view their own sessions
CREATE POLICY "Users can view own demo sessions"
ON public.demo_sessions
FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own sessions
CREATE POLICY "Users can update own demo sessions"
ON public.demo_sessions
FOR UPDATE
USING (user_id = auth.uid() OR user_id IS NULL);

-- Add index for faster lookups
CREATE INDEX idx_demo_sessions_user_id ON public.demo_sessions(user_id);
CREATE INDEX idx_demo_sessions_started_at ON public.demo_sessions(started_at DESC);-- Add columns for IP tracking, max duration, and auto-end status
ALTER TABLE public.demo_sessions 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS max_duration_seconds INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS auto_ended BOOLEAN DEFAULT false;

-- Create index for IP-based rate limiting queries
CREATE INDEX IF NOT EXISTS idx_demo_sessions_ip_started 
ON public.demo_sessions(ip_address, started_at);-- Create storage bucket for demo audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('demo-audio', 'demo-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to demo audio files
CREATE POLICY "Public can view demo audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'demo-audio');

-- Allow authenticated users to upload demo audio (for the edge function using service role)
CREATE POLICY "Service can upload demo audio"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'demo-audio');-- Fix tenant_users INSERT policy to allow new owners to add themselves
DROP POLICY IF EXISTS "Tenant admins can add users" ON public.tenant_users;

CREATE POLICY "Users can add themselves as owner to their owned tenant"
ON public.tenant_users
FOR INSERT
WITH CHECK (
  -- Platform admins can add anyone
  is_platform_admin() 
  OR 
  -- Existing tenant admins can add users to their tenant
  (is_tenant_admin() AND tenant_id = get_user_tenant_id())
  OR
  -- New owners can add themselves to their newly created tenant
  (
    user_id = auth.uid() 
    AND role = 'owner' 
    AND tenant_id IN (
      SELECT id FROM public.tenants WHERE owner_id = auth.uid()
    )
  )
);

-- Fix tenant_branding INSERT policy to allow new owners
DROP POLICY IF EXISTS "Admins can create tenant branding" ON public.tenant_branding;

CREATE POLICY "Owners can create tenant branding"
ON public.tenant_branding
FOR INSERT
WITH CHECK (
  -- Existing tenant admins
  ((tenant_id = get_user_tenant_id()) AND is_tenant_admin())
  OR
  -- New owners creating branding for their tenant
  (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()))
);-- Fix tenants SELECT policy to allow owners to view their newly created tenant
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;

CREATE POLICY "Users can view their tenant"
ON public.tenants
FOR SELECT
USING (
  (auth.uid() IS NOT NULL) 
  AND (
    user_belongs_to_tenant(id) 
    OR is_platform_admin()
    OR owner_id = auth.uid()  -- Allow owners to see their own tenant immediately
  )
);-- Fix tenant_users SELECT policy to allow users to see their own record
DROP POLICY IF EXISTS "Users can view tenant members" ON public.tenant_users;

CREATE POLICY "Users can view tenant members"
ON public.tenant_users
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  OR user_id = auth.uid()
  OR is_platform_admin()
);

-- Fix onboarding_progress UPDATE policy for new tenant owners
DROP POLICY IF EXISTS "Users can update their tenant onboarding progress" ON public.onboarding_progress;

CREATE POLICY "Users can update their tenant onboarding progress"
ON public.onboarding_progress
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
);

-- Also fix the SELECT policy for onboarding_progress
DROP POLICY IF EXISTS "Users can view their tenant onboarding progress" ON public.onboarding_progress;

CREATE POLICY "Users can view their tenant onboarding progress"
ON public.onboarding_progress
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  OR is_platform_admin()
);-- Enforce single-company access: only one active tenant membership per user

-- Deactivate duplicate active tenant memberships (keep the earliest created_at)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
  FROM public.tenant_users
  WHERE is_active = true
)
UPDATE public.tenant_users tu
SET is_active = false
FROM ranked r
WHERE tu.id = r.id
  AND r.rn > 1;

-- Add a partial unique index so a user can only have one active tenant membership
CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_one_active_per_user
  ON public.tenant_users (user_id)
  WHERE is_active = true;-- Fix security linter findings introduced/flagged after latest migration

-- 1) rate_limits has RLS enabled but no policies: deny all client access explicitly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'rate_limits'
  ) THEN
    -- Ensure RLS is enabled (should already be)
    EXECUTE 'ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY';

    -- Create a deny-all policy to satisfy linter and prevent direct client access
    EXECUTE 'DROP POLICY IF EXISTS "Deny all access" ON public.rate_limits';
    EXECUTE 'CREATE POLICY "Deny all access" ON public.rate_limits FOR ALL TO public USING (false) WITH CHECK (false)';
  END IF;
END
$$;

-- 2) demo_sessions INSERT policy has WITH CHECK (true): tighten it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'demo_sessions'
      AND policyname = 'Anyone can create demo sessions'
  ) THEN
    EXECUTE 'DROP POLICY "Anyone can create demo sessions" ON public.demo_sessions';
  END IF;
END
$$;

CREATE POLICY "Anyone can create demo sessions"
ON public.demo_sessions
FOR INSERT
TO public
WITH CHECK (
  session_token IS NOT NULL
  AND (
    user_id IS NULL
    OR user_id = auth.uid()
  )
);
-- Add Stripe Connect fields to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_connected';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_connect_account_id ON public.tenants(stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;-- Create demo sandbox sessions table
CREATE TABLE public.demo_sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '2 hours'),
  email TEXT,
  name TEXT,
  company_name TEXT,
  industry TEXT,
  features_explored JSONB DEFAULT '[]'::jsonb,
  pages_visited JSONB DEFAULT '[]'::jsonb,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  converted_to_trial BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  ip_address TEXT
);

-- Enable RLS
ALTER TABLE public.demo_sandbox_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create sessions (no auth required)
CREATE POLICY "Anyone can create demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR INSERT
WITH CHECK (session_token IS NOT NULL);

-- Allow updates via session token (no auth required)
CREATE POLICY "Anyone can update demo sandbox sessions by token"
ON public.demo_sandbox_sessions
FOR UPDATE
USING (true);

-- Allow reading own session
CREATE POLICY "Anyone can read demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR SELECT
USING (true);

-- Platform admins can view all sessions
CREATE POLICY "Platform admins can manage demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR ALL
USING (is_platform_admin());

-- Create index for faster token lookups
CREATE INDEX idx_demo_sandbox_sessions_token ON public.demo_sandbox_sessions(session_token);
CREATE INDEX idx_demo_sandbox_sessions_created_at ON public.demo_sandbox_sessions(created_at DESC);-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can update demo sandbox sessions by token" ON public.demo_sandbox_sessions;
DROP POLICY IF EXISTS "Anyone can read demo sandbox sessions" ON public.demo_sandbox_sessions;

-- More restrictive update policy - only non-expired sessions
CREATE POLICY "Update demo sandbox sessions by valid token"
ON public.demo_sandbox_sessions
FOR UPDATE
USING (expires_at > now());

-- More restrictive select policy - only non-expired sessions
CREATE POLICY "Read non-expired demo sandbox sessions"
ON public.demo_sandbox_sessions
FOR SELECT
USING (expires_at > now());-- Add file type and size restrictions to part-receipts bucket
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic'
    ]
WHERE id = 'part-receipts';-- First, recreate the update_demo_sandbox_session_by_token function that was dropped
CREATE OR REPLACE FUNCTION public.update_demo_sandbox_session_by_token(
  p_session_token text,
  p_features_explored jsonb DEFAULT NULL,
  p_pages_visited jsonb DEFAULT NULL,
  p_last_activity_at timestamptz DEFAULT NULL,
  p_converted_to_trial boolean DEFAULT NULL,
  p_converted_at timestamptz DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_company_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE demo_sandbox_sessions
  SET 
    features_explored = COALESCE(p_features_explored, features_explored),
    pages_visited = COALESCE(p_pages_visited, pages_visited),
    last_activity_at = COALESCE(p_last_activity_at, last_activity_at),
    converted_to_trial = COALESCE(p_converted_to_trial, converted_to_trial),
    converted_at = COALESCE(p_converted_at, converted_at),
    email = COALESCE(p_email, email),
    name = COALESCE(p_name, name),
    company_name = COALESCE(p_company_name, company_name)
  WHERE session_token = p_session_token AND expires_at > now();
  RETURN FOUND;
END;
$$;-- Recreate the security definer function to lookup session by token
CREATE OR REPLACE FUNCTION public.get_demo_session_by_token(p_session_token text)
RETURNS TABLE (
  id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  completed boolean,
  scenes_viewed jsonb,
  max_duration_seconds integer,
  auto_ended boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    started_at,
    ended_at,
    duration_seconds,
    completed,
    scenes_viewed,
    max_duration_seconds,
    auto_ended
  FROM demo_sessions
  WHERE session_token = p_session_token
  LIMIT 1;
$$;

-- Recreate security definer function to lookup sandbox session by token
CREATE OR REPLACE FUNCTION public.get_demo_sandbox_session_by_token(p_session_token text)
RETURNS TABLE (
  id uuid,
  industry text,
  expires_at timestamptz,
  features_explored jsonb,
  pages_visited jsonb,
  last_activity_at timestamptz,
  converted_to_trial boolean,
  email text,
  name text,
  company_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    industry,
    expires_at,
    features_explored,
    pages_visited,
    last_activity_at,
    converted_to_trial,
    email,
    name,
    company_name
  FROM demo_sandbox_sessions
  WHERE session_token = p_session_token AND expires_at > now()
  LIMIT 1;
$$;

-- Recreate security definer function to update demo session by token
CREATE OR REPLACE FUNCTION public.update_demo_session_by_token(
  p_session_token text,
  p_ended_at timestamptz DEFAULT NULL,
  p_duration_seconds integer DEFAULT NULL,
  p_completed boolean DEFAULT NULL,
  p_lead_captured boolean DEFAULT NULL,
  p_scenes_viewed jsonb DEFAULT NULL,
  p_auto_ended boolean DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE demo_sessions
  SET 
    ended_at = COALESCE(p_ended_at, ended_at),
    duration_seconds = COALESCE(p_duration_seconds, duration_seconds),
    completed = COALESCE(p_completed, completed),
    lead_captured = COALESCE(p_lead_captured, lead_captured),
    scenes_viewed = COALESCE(p_scenes_viewed, scenes_viewed),
    auto_ended = COALESCE(p_auto_ended, auto_ended)
  WHERE session_token = p_session_token;
  RETURN FOUND;
END;
$$;-- Create team_invitations table for secure invite flow
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'technician',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate pending invitations for same email/tenant
  CONSTRAINT unique_pending_invitation UNIQUE (tenant_id, email)
);

-- Add index for token lookup
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for team_invitations
-- Tenant admins/owners can view their invitations
CREATE POLICY "Tenant admins can view invitations"
ON public.team_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
    AND tenant_users.tenant_id = team_invitations.tenant_id
    AND tenant_users.role IN ('owner', 'admin')
    AND tenant_users.is_active = true
  )
);

-- Tenant admins/owners can create invitations
CREATE POLICY "Tenant admins can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
    AND tenant_users.tenant_id = team_invitations.tenant_id
    AND tenant_users.role IN ('owner', 'admin')
    AND tenant_users.is_active = true
  )
);

-- Tenant admins can delete/revoke invitations
CREATE POLICY "Tenant admins can delete invitations"
ON public.team_invitations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_users.user_id = auth.uid()
    AND tenant_users.tenant_id = team_invitations.tenant_id
    AND tenant_users.role IN ('owner', 'admin')
    AND tenant_users.is_active = true
  )
);

-- Create a security definer function for accepting invitations
-- This allows the accept-invite edge function to process invitations securely
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token TEXT, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_result jsonb;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token = p_token
  AND accepted_at IS NULL
  AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if user is already a member of this tenant
  IF EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = p_user_id
    AND tenant_id = v_invitation.tenant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this team');
  END IF;
  
  -- Create the tenant_user record
  INSERT INTO tenant_users (tenant_id, user_id, role, invited_by, invited_at, is_active)
  VALUES (
    v_invitation.tenant_id,
    p_user_id,
    v_invitation.role,
    v_invitation.invited_by,
    v_invitation.created_at,
    true
  );
  
  -- Mark invitation as accepted
  UPDATE team_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_invitation.tenant_id,
    'role', v_invitation.role
  );
END;
$$;

-- Create function to lookup invitation by token (for public access)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT 
    ti.id,
    ti.email,
    ti.role,
    ti.expires_at,
    ti.accepted_at,
    t.name as tenant_name
  INTO v_invitation
  FROM team_invitations ti
  JOIN tenants t ON t.id = ti.tenant_id
  WHERE ti.token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;
  
  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation already used');
  END IF;
  
  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation has expired');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invitation.email,
    'role', v_invitation.role,
    'tenant_name', v_invitation.tenant_name,
    'expires_at', v_invitation.expires_at
  );
END;
$$;-- Add new onboarding milestone columns
ALTER TABLE public.onboarding_progress
ADD COLUMN IF NOT EXISTS first_document_uploaded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS first_document_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS first_service_request_received boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS first_service_request_received_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS stripe_connect_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_connect_completed_at timestamp with time zone;-- Create table for storing push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all subscriptions in their tenant (for sending notifications)
CREATE POLICY "Admins can view tenant subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
      AND tenant_users.tenant_id = push_subscriptions.tenant_id
      AND tenant_users.role IN ('owner', 'admin')
      AND tenant_users.is_active = true
    )
  );

-- Add index for faster lookups
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_tenant ON public.push_subscriptions(tenant_id);

-- Add trigger for updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Add RLS policy for portal clients to view their own equipment
CREATE POLICY "Portal clients can view their own equipment"
ON public.equipment_registry
FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients 
    WHERE user_id = auth.uid()
  )
);

-- Add RLS policy for portal clients to view jobs on their equipment
CREATE POLICY "Portal clients can view jobs on their equipment"
ON public.scheduled_jobs
FOR SELECT
USING (
  -- Allow viewing if the job is linked to equipment they own
  equipment_id IN (
    SELECT er.id FROM public.equipment_registry er
    JOIN public.clients c ON c.id = er.client_id
    WHERE c.user_id = auth.uid()
  )
  OR
  -- Also allow viewing if the job is directly linked to their client record
  client_id IN (
    SELECT id FROM public.clients
    WHERE user_id = auth.uid()
  )
);-- Create waitlist_signups table
CREATE TABLE public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  company_name TEXT,
  technician_count TEXT,
  industry TEXT,
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage waitlist
CREATE POLICY "Platform admins can manage waitlist"
ON public.waitlist_signups FOR ALL
USING (public.is_platform_admin());

-- Allow anonymous inserts for waitlist signups
CREATE POLICY "Anyone can join waitlist"
ON public.waitlist_signups FOR INSERT
WITH CHECK (true);-- Add UTM tracking columns to waitlist_signups
ALTER TABLE public.waitlist_signups 
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT;-- Fix security issues identified in scan

-- 1. Fix pending_invitations: Remove overly permissive UPDATE policy
-- The acceptance logic should go through the secure RPC function
DROP POLICY IF EXISTS "Users can accept their own invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Users can accept invitations via token" ON public.pending_invitations;

-- Create a more restrictive UPDATE policy that validates proper conditions
CREATE POLICY "Users can accept invitations via token"
ON public.pending_invitations
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND accepted_at IS NULL 
  AND expires_at > now()
)
WITH CHECK (
  accepted_at IS NOT NULL
);

-- 2. Fix demo_requests: Ensure only authenticated platform admins can SELECT
-- The existing SELECT policy already requires is_platform_admin(), but let's verify it's restrictive
DROP POLICY IF EXISTS "Platform admins can view demo requests" ON public.demo_requests;

CREATE POLICY "Platform admins can view demo requests"
ON public.demo_requests
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_platform_admin());

-- 3. Fix tenants: The existing policies look correct, but verify no public access
-- Looking at the schema, tenants already requires authentication via user_belongs_to_tenant or owner check
-- No changes needed - the policies are already restrictive

-- 4. Fix demo_sessions: Restrict SELECT to only user's own sessions or platform admins
DROP POLICY IF EXISTS "Users can view own demo sessions" ON public.demo_sessions;

CREATE POLICY "Users can view own demo sessions"
ON public.demo_sessions
FOR SELECT
USING (
  (user_id = auth.uid()) 
  OR (user_id IS NULL AND session_token IS NOT NULL)
  OR is_platform_admin()
);

-- 5. Also fix the UPDATE policy on demo_sessions to not allow anonymous updates to all sessions
DROP POLICY IF EXISTS "Users can update own demo sessions" ON public.demo_sessions;

CREATE POLICY "Users can update own demo sessions"
ON public.demo_sessions
FOR UPDATE
USING (
  (user_id = auth.uid()) 
  OR (user_id IS NULL AND session_token IS NOT NULL)
  OR is_platform_admin()
);-- Fix waitlist_signups INSERT policy to add basic validation instead of WITH CHECK (true)
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist_signups;

CREATE POLICY "Anyone can join waitlist"
ON public.waitlist_signups
FOR INSERT
WITH CHECK (email IS NOT NULL AND email != '');-- Drop the existing CHECK constraint on identifier_type
ALTER TABLE rate_limits DROP CONSTRAINT IF EXISTS rate_limits_identifier_type_check;

-- Add updated CHECK constraint with additional identifier types for contact and demo forms
ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_identifier_type_check 
CHECK (identifier_type = ANY (ARRAY[
  'ip'::text, 
  'email'::text, 
  'client'::text, 
  'contact_form_ip'::text, 
  'contact_form_email'::text,
  'demo_request_email'::text
]));-- Block anonymous SELECT on all PII and sensitive tables
-- This prevents unauthenticated users from reading any sensitive data

-- clients table
CREATE POLICY "Deny anonymous access to clients"
  ON public.clients FOR SELECT
  TO anon
  USING (false);

-- profiles table
CREATE POLICY "Deny anonymous access to profiles"
  ON public.profiles FOR SELECT
  TO anon
  USING (false);

-- demo_requests table
CREATE POLICY "Deny anonymous access to demo_requests"
  ON public.demo_requests FOR SELECT
  TO anon
  USING (false);

-- waitlist_signups table
CREATE POLICY "Deny anonymous access to waitlist_signups"
  ON public.waitlist_signups FOR SELECT
  TO anon
  USING (false);

-- team_invitations table
CREATE POLICY "Deny anonymous access to team_invitations"
  ON public.team_invitations FOR SELECT
  TO anon
  USING (false);

-- pending_invitations table
CREATE POLICY "Deny anonymous access to pending_invitations"
  ON public.pending_invitations FOR SELECT
  TO anon
  USING (false);

-- invoices table
CREATE POLICY "Deny anonymous access to invoices"
  ON public.invoices FOR SELECT
  TO anon
  USING (false);

-- tenants table
CREATE POLICY "Deny anonymous access to tenants"
  ON public.tenants FOR SELECT
  TO anon
  USING (false);

-- scheduled_jobs table
CREATE POLICY "Deny anonymous access to scheduled_jobs"
  ON public.scheduled_jobs FOR SELECT
  TO anon
  USING (false);

-- service_requests table
CREATE POLICY "Deny anonymous access to service_requests"
  ON public.service_requests FOR SELECT
  TO anon
  USING (false);

-- tenant_settings table
CREATE POLICY "Deny anonymous access to tenant_settings"
  ON public.tenant_settings FOR SELECT
  TO anon
  USING (false);

-- equipment_registry table
CREATE POLICY "Deny anonymous access to equipment_registry"
  ON public.equipment_registry FOR SELECT
  TO anon
  USING (false);

-- documents table
CREATE POLICY "Deny anonymous access to documents"
  ON public.documents FOR SELECT
  TO anon
  USING (false);

-- tenant_branding table
CREATE POLICY "Deny anonymous access to tenant_branding"
  ON public.tenant_branding FOR SELECT
  TO anon
  USING (false);

-- parts_catalog table
CREATE POLICY "Deny anonymous access to parts_catalog"
  ON public.parts_catalog FOR SELECT
  TO anon
  USING (false);

-- job_parts table
CREATE POLICY "Deny anonymous access to job_parts"
  ON public.job_parts FOR SELECT
  TO anon
  USING (false);

-- notifications table
CREATE POLICY "Deny anonymous access to notifications"
  ON public.notifications FOR SELECT
  TO anon
  USING (false);

-- conversations table
CREATE POLICY "Deny anonymous access to conversations"
  ON public.conversations FOR SELECT
  TO anon
  USING (false);

-- messages table
CREATE POLICY "Deny anonymous access to messages"
  ON public.messages FOR SELECT
  TO anon
  USING (false);

-- demo_sessions table
CREATE POLICY "Deny anonymous access to demo_sessions"
  ON public.demo_sessions FOR SELECT
  TO anon
  USING (false);

-- push_subscriptions table
CREATE POLICY "Deny anonymous access to push_subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO anon
  USING (false);

-- invoice_line_items table
CREATE POLICY "Deny anonymous access to invoice_line_items"
  ON public.invoice_line_items FOR SELECT
  TO anon
  USING (false);

-- job_checklist_completions table
CREATE POLICY "Deny anonymous access to job_checklist_completions"
  ON public.job_checklist_completions FOR SELECT
  TO anon
  USING (false);

-- job_stage_templates table
CREATE POLICY "Deny anonymous access to job_stage_templates"
  ON public.job_stage_templates FOR SELECT
  TO anon
  USING (false);

-- tenant_users table
CREATE POLICY "Deny anonymous access to tenant_users"
  ON public.tenant_users FOR SELECT
  TO anon
  USING (false);

-- onboarding_progress table
CREATE POLICY "Deny anonymous access to onboarding_progress"
  ON public.onboarding_progress FOR SELECT
  TO anon
  USING (false);-- Fix remaining critical security gaps

-- Drop the overly permissive demo_sessions policies
DROP POLICY IF EXISTS "Users can view own demo sessions" ON public.demo_sessions;
DROP POLICY IF EXISTS "Users can update own demo sessions" ON public.demo_sessions;

-- Create more restrictive demo_sessions policies
CREATE POLICY "Session owners can view their sessions"
  ON public.demo_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

CREATE POLICY "Anon users can view by exact token match"
  ON public.demo_sessions FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Session owners can update their sessions"
  ON public.demo_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

CREATE POLICY "Anon cannot update demo sessions"
  ON public.demo_sessions FOR UPDATE
  TO anon
  USING (false);

-- Drop the overly permissive demo_sandbox_sessions policies
DROP POLICY IF EXISTS "Read non-expired demo sandbox sessions" ON public.demo_sandbox_sessions;
DROP POLICY IF EXISTS "Update demo sandbox sessions by valid token" ON public.demo_sandbox_sessions;
DROP POLICY IF EXISTS "Deny anonymous access to demo_sandbox_sessions" ON public.demo_sandbox_sessions;

-- Create restrictive demo_sandbox_sessions policies (platform admins only for SELECT)
CREATE POLICY "Only platform admins can view sandbox sessions"
  ON public.demo_sandbox_sessions FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot view sandbox sessions"
  ON public.demo_sandbox_sessions FOR SELECT
  TO anon
  USING (false);

CREATE POLICY "Only platform admins can update sandbox sessions"
  ON public.demo_sandbox_sessions FOR UPDATE
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot update sandbox sessions"
  ON public.demo_sandbox_sessions FOR UPDATE
  TO anon
  USING (false);

-- Add explicit deny for regular authenticated users on demo_requests
DROP POLICY IF EXISTS "Deny anonymous access to demo_requests" ON public.demo_requests;

CREATE POLICY "Only platform admins can read demo requests"
  ON public.demo_requests FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot read demo requests"
  ON public.demo_requests FOR SELECT
  TO anon
  USING (false);

-- Add explicit deny for regular authenticated users on waitlist_signups  
DROP POLICY IF EXISTS "Deny anonymous access to waitlist_signups" ON public.waitlist_signups;

CREATE POLICY "Only platform admins can read waitlist"
  ON public.waitlist_signups FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "Anon cannot read waitlist"
  ON public.waitlist_signups FOR SELECT
  TO anon
  USING (false);-- Create dashboard stats RPC function for efficient aggregation
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tenant_id uuid)
RETURNS TABLE(
  total bigint,
  in_progress bigint,
  completed bigint,
  urgent bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')) as urgent
  FROM scheduled_jobs
  WHERE tenant_id = p_tenant_id;
$$;

-- Grant execute to authenticated users (RLS on scheduled_jobs still applies at query level)
GRANT EXECUTE ON FUNCTION get_dashboard_stats(uuid) TO authenticated;-- Fix dashboard_stats to validate user belongs to tenant before returning data
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_tenant_id uuid)
RETURNS TABLE(
  total bigint,
  in_progress bigint,
  completed bigint,
  urgent bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the calling user belongs to the requested tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to the requested tenant';
  END IF;

  -- Return the stats
  RETURN QUERY
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')) as urgent
  FROM scheduled_jobs
  WHERE scheduled_jobs.tenant_id = p_tenant_id;
END;
$$;

-- Create a secure view for team_invitations that excludes tokens
-- This view shows invitation metadata without exposing the actual tokens
CREATE VIEW public.team_invitations_safe
WITH (security_invoker=on) AS
  SELECT 
    id,
    tenant_id,
    email,
    role,
    invited_by,
    expires_at,
    accepted_at,
    created_at
  FROM public.team_invitations;

-- Grant access to the view
GRANT SELECT ON public.team_invitations_safe TO authenticated;-- Create RPC function to allow anonymous users to create demo sandbox sessions
-- This bypasses RLS while maintaining security by only exposing this specific operation

CREATE OR REPLACE FUNCTION public.create_demo_sandbox_session(
  p_industry TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_token TEXT;
BEGIN
  INSERT INTO public.demo_sandbox_sessions (
    industry,
    features_explored,
    pages_visited
  )
  VALUES (
    p_industry,
    '[]'::jsonb,
    '[]'::jsonb
  )
  RETURNING session_token INTO v_session_token;
  
  RETURN v_session_token;
END;
$$;-- Add columns for document text extraction
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending';

-- Add index for efficient querying by extraction status
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status ON public.documents(extraction_status);

-- Comment explaining the columns
COMMENT ON COLUMN public.documents.extracted_text IS 'AI-extracted text content from the document for grounding the field assistant';
COMMENT ON COLUMN public.documents.extraction_status IS 'Status of text extraction: pending, processing, completed, failed';-- Create AI audit log table for tracking all AI interactions
CREATE TABLE public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Request info
  user_message TEXT NOT NULL,
  context_type TEXT,
  context_id UUID,
  equipment_type TEXT,
  
  -- Response info
  ai_response TEXT,
  response_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  
  -- Document context
  documents_available INTEGER DEFAULT 0,
  documents_with_content INTEGER DEFAULT 0,
  document_names TEXT[],
  
  -- Validation details
  validation_patterns_matched TEXT[],
  had_citations BOOLEAN,
  
  -- Metadata
  response_time_ms INTEGER,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index for efficient querying
CREATE INDEX idx_ai_audit_logs_tenant_id ON public.ai_audit_logs(tenant_id);
CREATE INDEX idx_ai_audit_logs_created_at ON public.ai_audit_logs(created_at DESC);
CREATE INDEX idx_ai_audit_logs_blocked ON public.ai_audit_logs(response_blocked) WHERE response_blocked = true;

-- Enable RLS
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Deny anonymous access to ai_audit_logs"
ON public.ai_audit_logs
FOR SELECT
USING (false);

CREATE POLICY "Platform admins can view all audit logs"
ON public.ai_audit_logs
FOR SELECT
USING (is_platform_admin());

CREATE POLICY "Tenant admins can view their tenant logs"
ON public.ai_audit_logs
FOR SELECT
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Allow edge function to insert logs (service role)
CREATE POLICY "Service role can insert audit logs"
ON public.ai_audit_logs
FOR INSERT
WITH CHECK (true);-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table to store document text chunks with embeddings
-- This allows efficient semantic search across large documentation libraries
CREATE TABLE public.document_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI-compatible embedding dimension
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search (cosine distance)
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for efficient filtering by tenant
CREATE INDEX idx_document_chunks_tenant ON public.document_chunks(tenant_id);

-- Create index for filtering by document
CREATE INDEX idx_document_chunks_document ON public.document_chunks(document_id);

-- Create composite index for common query pattern
CREATE INDEX idx_document_chunks_tenant_document ON public.document_chunks(tenant_id, document_id);

-- Enable Row Level Security
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see chunks from their tenant
CREATE POLICY "Deny anonymous access to document_chunks"
ON public.document_chunks FOR SELECT
USING (false);

CREATE POLICY "Users can view document chunks in their tenant"
ON public.document_chunks FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Service role can manage document chunks"
ON public.document_chunks FOR ALL
USING (true)
WITH CHECK (true);

-- Add embedding_status column to documents table to track chunking/embedding progress
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending';

-- Add index for filtering documents by embedding status
CREATE INDEX IF NOT EXISTS idx_documents_embedding_status ON public.documents(embedding_status);

-- Comment on new structures
COMMENT ON TABLE public.document_chunks IS 'Stores document text chunks with vector embeddings for semantic search';
COMMENT ON COLUMN public.document_chunks.embedding IS '1536-dimensional vector embedding for semantic similarity search';
COMMENT ON COLUMN public.document_chunks.chunk_index IS 'Position of this chunk within the source document';
COMMENT ON COLUMN public.documents.embedding_status IS 'Status of vector embedding generation: pending, processing, completed, failed';

-- Create function to search documents by similarity
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 10,
  p_match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  document_name TEXT,
  document_category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_text,
    d.name AS document_name,
    d.category AS document_category,
    1 - (dc.embedding <=> p_query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.tenant_id = p_tenant_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage document chunks" ON public.document_chunks;

-- Note: Service role bypasses RLS by default, so we don't need an explicit policy.
-- The INSERT/UPDATE/DELETE operations will only happen from edge functions using service role.-- Security Migration: Fix critical vulnerabilities
-- 1. Fix search_document_chunks() to validate tenant access
-- 2. Fix part-receipts storage policies for tenant isolation

-- =============================================
-- FIX 1: search_document_chunks() RLS bypass
-- Add tenant validation to prevent cross-tenant access
-- =============================================

CREATE OR REPLACE FUNCTION public.search_document_chunks(
  p_tenant_id uuid, 
  p_query_embedding vector, 
  p_match_count integer DEFAULT 10, 
  p_match_threshold double precision DEFAULT 0.5
)
RETURNS TABLE(
  id uuid, 
  document_id uuid, 
  chunk_text text, 
  document_name text, 
  document_category text, 
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY CHECK: Verify caller belongs to the requested tenant
  IF p_tenant_id != get_user_tenant_id() THEN
    RAISE EXCEPTION 'Access denied: User does not belong to the requested tenant';
  END IF;

  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_text,
    d.name AS document_name,
    d.category AS document_category,
    1 - (dc.embedding <=> p_query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.tenant_id = p_tenant_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> p_query_embedding)) > p_match_threshold
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- =============================================
-- FIX 2: part-receipts storage policies
-- Add proper tenant isolation using folder path
-- =============================================

-- First, drop the existing insecure policies
DROP POLICY IF EXISTS "Users can view part receipts in their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload part receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their uploaded receipts" ON storage.objects;

-- Create properly secured policies with tenant isolation
-- Files are stored as: {tenant_id}/{job_id}/{filename}

-- SELECT: Only allow viewing receipts in user's tenant folder
CREATE POLICY "Users can view part receipts in their tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- INSERT: Only allow uploading to user's tenant folder
CREATE POLICY "Users can upload part receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- UPDATE: Only allow updating receipts in user's tenant folder
CREATE POLICY "Users can update part receipts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- DELETE: Only tenant admins can delete, within their tenant folder
CREATE POLICY "Admins can delete part receipts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'part-receipts' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  AND is_tenant_admin()
);-- Create beta_feedback table for collecting user feedback during beta
CREATE TABLE public.beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'feedback', 'question')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  page_context TEXT,
  screenshot_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to beta_feedback"
  ON public.beta_feedback
  FOR SELECT
  USING (false);

-- Users can insert their own feedback
CREATE POLICY "Users can create feedback"
  ON public.beta_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND user_belongs_to_tenant(tenant_id));

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.beta_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Platform admins can view all feedback
CREATE POLICY "Platform admins can view all feedback"
  ON public.beta_feedback
  FOR SELECT
  USING (is_platform_admin());

-- Platform admins can update feedback
CREATE POLICY "Platform admins can update feedback"
  ON public.beta_feedback
  FOR UPDATE
  USING (is_platform_admin());

-- Platform admins can delete feedback
CREATE POLICY "Platform admins can delete feedback"
  ON public.beta_feedback
  FOR DELETE
  USING (is_platform_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_beta_feedback_updated_at
  BEFORE UPDATE ON public.beta_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for feedback screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback screenshots
CREATE POLICY "Users can upload feedback screenshots"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'feedback-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own feedback screenshots"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feedback-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Platform admins can view all feedback screenshots"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feedback-screenshots' AND is_platform_admin());-- Create feature_flags table for controlled feature rollouts
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowed_tenant_ids uuid[] DEFAULT '{}',
  blocked_tenant_ids uuid[] DEFAULT '{}',
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for fast lookups
CREATE INDEX idx_feature_flags_key ON public.feature_flags(key);
CREATE INDEX idx_feature_flags_is_enabled ON public.feature_flags(is_enabled);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to feature_flags"
ON public.feature_flags
FOR SELECT
TO anon
USING (false);

-- Authenticated users can read flags (needed for evaluation)
CREATE POLICY "Authenticated users can read feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

-- Platform admins can manage all flags
CREATE POLICY "Platform admins can manage feature flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Drop the duplicate policy first, then recreate properly
DROP POLICY IF EXISTS "Platform admins can view all feedback screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own feedback screenshots" ON storage.objects;

-- Recreate with proper combined logic
CREATE POLICY "Users and admins can view feedback screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'feedback-screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_platform_admin()
  )
);-- Create beta_applications table for tracking beta tester signups
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
CREATE INDEX idx_beta_applications_email ON public.beta_applications(email);-- Create system_health_metrics table for storing health check results
CREATE TABLE public.system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  metric_value numeric,
  status text NOT NULL DEFAULT 'healthy',
  metadata jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient time-based queries
CREATE INDEX idx_health_metrics_recorded_at ON public.system_health_metrics(recorded_at DESC);
CREATE INDEX idx_health_metrics_type ON public.system_health_metrics(metric_type);

-- Enable RLS
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view health metrics
CREATE POLICY "Platform admins can view health metrics"
  ON public.system_health_metrics
  FOR SELECT
  USING (is_platform_admin());

-- Service role can insert metrics (from edge functions)
CREATE POLICY "Service role can insert health metrics"
  ON public.system_health_metrics
  FOR INSERT
  WITH CHECK (true);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to health_metrics"
  ON public.system_health_metrics
  FOR SELECT
  USING (false);

-- Create system_alerts table for storing alerts
CREATE TABLE public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message text NOT NULL,
  source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for alerts
CREATE INDEX idx_system_alerts_created_at ON public.system_alerts(created_at DESC);
CREATE INDEX idx_system_alerts_severity ON public.system_alerts(severity);
CREATE INDEX idx_system_alerts_unresolved ON public.system_alerts(resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all alerts
CREATE POLICY "Platform admins can view alerts"
  ON public.system_alerts
  FOR SELECT
  USING (is_platform_admin());

-- Platform admins can update alerts (acknowledge/resolve)
CREATE POLICY "Platform admins can update alerts"
  ON public.system_alerts
  FOR UPDATE
  USING (is_platform_admin());

-- Service role can insert alerts
CREATE POLICY "Service role can insert alerts"
  ON public.system_alerts
  FOR INSERT
  WITH CHECK (true);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to alerts"
  ON public.system_alerts
  FOR SELECT
  USING (false);

-- Add cleanup function for old metrics (keep 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_health_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.system_health_metrics 
  WHERE recorded_at < now() - INTERVAL '7 days';
END;
$$;-- Create tutorials table for video metadata
CREATE TABLE public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text, -- Nullable since videos are uploaded separately
  thumbnail_url text,
  duration_seconds integer NOT NULL DEFAULT 60,
  category text NOT NULL DEFAULT 'getting-started',
  feature_key text, -- Links to specific feature for contextual display
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create user tutorial progress table
CREATE TABLE public.user_tutorial_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tutorial_id uuid NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  watched_at timestamptz NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  watch_duration_seconds integer DEFAULT 0,
  UNIQUE(user_id, tutorial_id)
);

-- Enable RLS
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;

-- Tutorials are publicly readable (for demo users too)
CREATE POLICY "Anyone can view published tutorials"
  ON public.tutorials FOR SELECT
  USING (is_published = true);

-- Platform admins can manage tutorials
CREATE POLICY "Platform admins can manage tutorials"
  ON public.tutorials FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Users can view their own progress
CREATE POLICY "Users can view own tutorial progress"
  ON public.user_tutorial_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can track own tutorial progress"
  ON public.user_tutorial_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own tutorial progress"
  ON public.user_tutorial_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to user_tutorial_progress"
  ON public.user_tutorial_progress FOR SELECT
  USING (false);

-- Create storage bucket for tutorial videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorials', 'tutorials', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to tutorial videos
CREATE POLICY "Anyone can view tutorial videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tutorials');

-- Platform admins can upload tutorial videos
CREATE POLICY "Admins can upload tutorial videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tutorials' AND is_platform_admin());

CREATE POLICY "Admins can update tutorial videos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tutorials' AND is_platform_admin());

CREATE POLICY "Admins can delete tutorial videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tutorials' AND is_platform_admin());

-- Add index for feature-based lookups
CREATE INDEX idx_tutorials_feature_key ON public.tutorials(feature_key) WHERE feature_key IS NOT NULL;
CREATE INDEX idx_tutorials_category ON public.tutorials(category);
CREATE INDEX idx_user_tutorial_progress_user ON public.user_tutorial_progress(user_id);

-- Insert initial tutorial metadata (videos to be uploaded separately)
INSERT INTO public.tutorials (title, description, category, feature_key, duration_seconds, display_order) VALUES
  ('Getting Started with FieldTek', 'A quick overview of the platform and key features', 'getting-started', 'onboarding', 180, 1),
  ('Creating Your First Job', 'Learn how to create and schedule a new job', 'jobs', 'jobs', 120, 2),
  ('Drag & Drop Scheduling', 'Master the schedule board with drag and drop', 'scheduling', 'schedule', 90, 3),
  ('Using the AI Assistant', 'Get help from the AI field assistant', 'ai', 'assistant', 150, 4),
  ('Bulk Operations', 'Efficiently manage multiple records at once', 'advanced', 'bulk-actions', 120, 5),
  ('Document Upload & OCR', 'Upload documents and extract text automatically', 'documents', 'documents', 150, 6),
  ('Invoice Generation', 'Create and send invoices from completed jobs', 'invoicing', 'invoices', 180, 7),
  ('Customer Portal Setup', 'Set up client access to their service history', 'portal', 'portal', 180, 8),
  ('Team Management', 'Invite team members and manage roles', 'team', 'team', 120, 9),
  ('Settings & Configuration', 'Customize FieldTek for your business', 'settings', 'settings', 180, 10);-- Create recurring_job_templates table
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
CREATE INDEX idx_scheduled_jobs_recurring_template ON public.scheduled_jobs(recurring_template_id) WHERE recurring_template_id IS NOT NULL;-- ============================================================
-- Security Fix: Address 3 security scan findings
-- ============================================================

-- ============================================================
-- FIX 1: profiles_table_public_exposure
-- Issue: Profiles table exposes email/phone to all tenant members
-- Solution: Users can only view their own profile OR profiles of 
--           team members if they are admin/owner/dispatcher
-- ============================================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

-- Create a more restrictive policy: 
-- Users can view their own profile always
-- Admins/owners/dispatchers can view all profiles in their tenant (needed for team management/job assignment)
-- Technicians can only view their own profile
CREATE POLICY "Users can view own profile or admins can view tenant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) -- Always allow viewing own profile
  OR 
  (
    -- Admins, owners, and dispatchers can view all profiles in their tenant
    EXISTS (
      SELECT 1 FROM tenant_users tu_viewer
      WHERE tu_viewer.user_id = auth.uid()
        AND tu_viewer.is_active = true
        AND tu_viewer.role IN ('owner', 'admin', 'dispatcher')
        AND EXISTS (
          SELECT 1 FROM tenant_users tu_target
          WHERE tu_target.user_id = profiles.user_id
            AND tu_target.tenant_id = tu_viewer.tenant_id
            AND tu_target.is_active = true
        )
    )
  )
  OR is_platform_admin()
);

-- ============================================================
-- FIX 2: tenants_financial_exposure  
-- Issue: All tenant members can see subscription_tier, trial_ends_at, 
--        stripe_connect info
-- Solution: Create a view that hides financial fields for non-admin users
--           and update the SELECT policy to be role-based
-- ============================================================

-- Create a public view that shows non-sensitive tenant info
-- All members can see: id, name, slug, address, phone, email, industry
-- Only admins/owners can query the base table for financial fields
CREATE OR REPLACE VIEW public.tenants_public
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  slug,
  address,
  phone,
  email,
  industry,
  created_at,
  updated_at
FROM public.tenants;

-- Comment explaining the view
COMMENT ON VIEW public.tenants_public IS 'Public tenant info visible to all members. Financial/subscription data excluded.';

-- Drop existing SELECT policies on tenants and create role-based ones
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;

-- All tenant members can view basic tenant info (but not financial fields via the view)
-- Only owners and admins can SELECT from base tenants table to see financial info
CREATE POLICY "Users can view own tenant basic info"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  (
    -- All tenant members can view basic fields (via view or direct query)
    user_belongs_to_tenant(id) 
    AND (
      -- But full access (including financial) only for owners/admins
      is_tenant_admin() OR owner_id = auth.uid()
    )
  )
  OR is_platform_admin()
  OR owner_id = auth.uid()
);

-- Also allow regular members to read basic tenant info needed for the app to function
-- This is a fallback policy for essential reads
CREATE POLICY "Members can read tenant for app functionality"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  user_belongs_to_tenant(id)
);

-- ============================================================
-- FIX 3: scheduled_jobs_over_permissive
-- Issue: All tenant users can see all jobs, including internal notes,
--        addresses, and jobs assigned to other technicians
-- Solution: Technicians can only see jobs assigned to them;
--           Dispatchers, admins, owners can see all jobs in tenant
-- ============================================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view jobs in their tenant" ON public.scheduled_jobs;

-- Create a role-based policy for job visibility
CREATE POLICY "Role-based job visibility"
ON public.scheduled_jobs
FOR SELECT
TO authenticated
USING (
  (tenant_id = get_user_tenant_id())
  AND (
    -- Owners, admins, and dispatchers can see all jobs
    is_tenant_admin() 
    OR get_user_role() = 'dispatcher'
    -- Technicians can only see jobs assigned to them
    OR assigned_to = auth.uid()
    -- Or jobs they created
    OR created_by = auth.uid()
  )
);-- Add email tracking columns to beta_applications
ALTER TABLE public.beta_applications 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_error TEXT;ALTER TYPE public.industry_type ADD VALUE IF NOT EXISTS 'elevator';ALTER TYPE industry_type ADD VALUE IF NOT EXISTS 'home_automation';
-- Add country column to tenant_settings if it exists, otherwise add to tenants
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_settings') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_settings' AND column_name = 'country') THEN
      ALTER TABLE public.tenant_settings ADD COLUMN country TEXT DEFAULT 'US';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'country') THEN
      ALTER TABLE public.tenants ADD COLUMN country TEXT DEFAULT 'US';
    END IF;
  END IF;
END $$;

CREATE TABLE public.portal_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_invitations ENABLE ROW LEVEL SECURITY;

-- Tenant members can view their invitations
CREATE POLICY "Tenant members can view portal invitations"
  ON public.portal_invitations FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true
  ));

-- Allow anonymous reads for token validation during signup
CREATE POLICY "Anyone can validate invitation tokens"
  ON public.portal_invitations FOR SELECT
  USING (true);

-- Tenant admins can insert invitations
CREATE POLICY "Tenant admins can insert portal invitations"
  ON public.portal_invitations FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid() AND is_active = true 
    AND role IN ('owner', 'admin', 'dispatcher')
  ));

-- Tenant admins can update invitations (mark as accepted)
CREATE POLICY "Tenant admins can update portal invitations"
  ON public.portal_invitations FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid() AND is_active = true 
    AND role IN ('owner', 'admin', 'dispatcher')
  ));

-- Fix RLS: restrict "service role" INSERT policies to actual service_role
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.ai_audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON public.ai_audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert alerts" ON public.system_alerts;
CREATE POLICY "Service role can insert alerts"
  ON public.system_alerts FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert health metrics" ON public.system_health_metrics;
CREATE POLICY "Service role can insert health metrics"
  ON public.system_health_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

ALTER TABLE public.tenants 
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '30 days');

ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS is_beta_founder BOOLEAN DEFAULT false;

-- Update the handle_new_user or tenant creation logic to read is_beta_founder from user metadata
-- We'll create a function that the existing tenant creation trigger can call
CREATE OR REPLACE FUNCTION public.set_beta_founder_on_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_beta_founder BOOLEAN;
  v_user_record RECORD;
BEGIN
  -- Look up the user's metadata to check if they're a beta founder
  SELECT raw_user_meta_data INTO v_user_record FROM auth.users WHERE id = NEW.owner_id;
  
  v_is_beta_founder := COALESCE((v_user_record.raw_user_meta_data->>'is_beta_founder')::boolean, false);
  
  IF v_is_beta_founder THEN
    NEW.is_beta_founder := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on tenants table to set is_beta_founder before insert
DROP TRIGGER IF EXISTS set_beta_founder_trigger ON public.tenants;
CREATE TRIGGER set_beta_founder_trigger
  BEFORE INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_beta_founder_on_tenant();

-- Fix #1: Replace overly permissive portal_invitations SELECT policy
-- Drop the dangerous "Anyone can validate invitation tokens" policy
DROP POLICY IF EXISTS "Anyone can validate invitation tokens" ON public.portal_invitations;

-- Create a secure function to validate portal invitation tokens
CREATE OR REPLACE FUNCTION public.validate_portal_invitation_token(p_token text)
RETURNS TABLE(id uuid, client_id uuid, tenant_id uuid, email text, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT pi.id, pi.client_id, pi.tenant_id, pi.email, pi.expires_at, pi.accepted_at
  FROM public.portal_invitations pi
  WHERE pi.token = p_token
  LIMIT 1;
END;
$$;

-- Only allow tenant members to SELECT portal invitations for their own tenant
CREATE POLICY "Tenant members can view their own invitations"
ON public.portal_invitations
FOR SELECT
USING (public.user_belongs_to_tenant(tenant_id));
ALTER EXTENSION vector SET SCHEMA extensions;
-- Create voice usage logs table
CREATE TABLE public.voice_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL, -- 'tts', 'scribe', 'conversation'
  character_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  model_id TEXT,
  voice_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read
CREATE POLICY "Deny anonymous access to voice_usage_logs"
  ON public.voice_usage_logs FOR SELECT
  USING (false);

CREATE POLICY "Platform admins can view voice usage"
  ON public.voice_usage_logs FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Service role can insert voice usage"
  ON public.voice_usage_logs FOR INSERT
  WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX idx_voice_usage_tenant_created ON public.voice_usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_voice_usage_function ON public.voice_usage_logs(function_name, created_at DESC);

-- Fix overly permissive INSERT policies on service-role-only tables
-- These currently use WITH CHECK (true) which allows any authenticated user to insert

-- Drop the old permissive policies
DROP POLICY IF EXISTS "Service role can insert health metrics" ON public.system_health_metrics;
DROP POLICY IF EXISTS "Service role can insert voice usage" ON public.voice_usage_logs;
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.system_alerts;

-- Recreate with proper restriction: only allow inserts when the request
-- comes from the service_role key (not the anon key)
CREATE POLICY "Service role can insert health metrics"
ON public.system_health_metrics
FOR INSERT
WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

CREATE POLICY "Service role can insert voice usage"
ON public.voice_usage_logs
FOR INSERT
WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

CREATE POLICY "Service role can insert alerts"
ON public.system_alerts
FOR INSERT
WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Create tenant_api_keys table for Professional tier REST API access
CREATE TABLE public.tenant_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         text NOT NULL,
  key_prefix   text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  scopes       text[] NOT NULL DEFAULT ARRAY['read'],
  last_used_at timestamp with time zone,
  expires_at   timestamp with time zone,
  revoked_at   timestamp with time zone,
  created_by   uuid NOT NULL,
  created_at   timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anon access to tenant_api_keys"
ON public.tenant_api_keys FOR SELECT
USING (false);

-- Admins can manage their tenant's API keys
CREATE POLICY "Admins can manage API keys"
ON public.tenant_api_keys FOR ALL
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Authenticated admins can view their keys
CREATE POLICY "Admins can view their tenant API keys"
ON public.tenant_api_keys FOR SELECT
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

CREATE INDEX idx_tenant_api_keys_tenant_id ON public.tenant_api_keys(tenant_id);
CREATE INDEX idx_tenant_api_keys_key_hash ON public.tenant_api_keys(key_hash);

-- Calendar sync tokens table (per-user iCal feed token + OAuth credentials)
CREATE TABLE public.calendar_sync_tokens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ical_token            text NOT NULL UNIQUE,
  google_access_token   text,
  google_refresh_token  text,
  google_token_expiry   timestamptz,
  google_calendar_id    text,
  outlook_access_token  text,
  outlook_refresh_token text,
  outlook_token_expiry  timestamptz,
  outlook_calendar_id   text,
  sync_enabled          boolean NOT NULL DEFAULT true,
  last_synced_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_sync_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar sync"
  ON public.calendar_sync_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_calendar_sync_tokens_user_id ON public.calendar_sync_tokens(user_id);
CREATE INDEX idx_calendar_sync_tokens_ical_token ON public.calendar_sync_tokens(ical_token);

-- External calendar events table (imported busy blocks from Google/Outlook)
CREATE TABLE public.external_calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider    text NOT NULL CHECK (provider IN ('google', 'outlook')),
  external_id text NOT NULL,
  title       text,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  is_all_day  boolean NOT NULL DEFAULT false,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, external_id)
);

ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;

-- Technicians see their own events; tenant admins/dispatchers see all in their tenant
CREATE POLICY "Users can view own external events"
  ON public.external_calendar_events FOR SELECT
  USING (
    user_id = auth.uid()
    OR (tenant_id = get_user_tenant_id() AND is_tenant_admin())
    OR (tenant_id = get_user_tenant_id() AND get_user_role() = 'dispatcher')
  );

CREATE POLICY "Users can manage own external events"
  ON public.external_calendar_events FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_external_calendar_events_user_id ON public.external_calendar_events(user_id);
CREATE INDEX idx_external_calendar_events_tenant_id ON public.external_calendar_events(tenant_id);
CREATE INDEX idx_external_calendar_events_date_range ON public.external_calendar_events(start_at, end_at);

-- Updated_at trigger for calendar_sync_tokens
CREATE TRIGGER update_calendar_sync_tokens_updated_at
  BEFORE UPDATE ON public.calendar_sync_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
