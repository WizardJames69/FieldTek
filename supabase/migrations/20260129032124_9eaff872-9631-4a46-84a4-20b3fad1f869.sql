-- Block anonymous SELECT on all PII and sensitive tables
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
  USING (false);