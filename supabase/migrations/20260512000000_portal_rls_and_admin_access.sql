-- ============================================================
-- Portal Client RLS + Platform Admin Workflow Access
-- ============================================================
-- Fixes discovered during role-based interface audit (2026-03-11).
-- All issues are pre-existing (not caused by security_advisor_fixes).
--
-- CRITICAL-1: Portal clients cannot view invoices
-- CRITICAL-2: Portal clients cannot view service request history
-- WARNING-1:  Platform admin sees empty workflow intelligence data
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A. Portal Client SELECT Policies
-- ────────────────────────────────────────────────────────────
-- Pattern: client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
-- Matches existing portal policies on scheduled_jobs + equipment_registry.

-- A1. Invoices — portal clients can view their own invoices
CREATE POLICY "Portal clients can view their own invoices"
  ON public.invoices
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- A2. Service requests — portal clients can view their own requests
CREATE POLICY "Portal clients can view their own service requests"
  ON public.service_requests
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- B. Platform Admin SELECT Policies for Workflow Tables
-- ────────────────────────────────────────────────────────────
-- AdminRAGQuality and AdminWorkflowDiscovery query these tables
-- without tenant_id filters. Platform admins are NOT in tenant_users,
-- so the existing tenant-scoped policies return 0 rows.
-- Pattern: is_platform_admin() — matches ai_audit_logs policy.

CREATE POLICY "Platform admins can view workflow symptoms"
  ON public.workflow_symptoms
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow failures"
  ON public.workflow_failures
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow outcomes"
  ON public.workflow_outcomes
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow diagnostics"
  ON public.workflow_diagnostics
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow repairs"
  ON public.workflow_repairs
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view workflow edges"
  ON public.workflow_intelligence_edges
  FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can view diagnostic statistics"
  ON public.workflow_diagnostic_statistics
  FOR SELECT
  USING (public.is_platform_admin());
