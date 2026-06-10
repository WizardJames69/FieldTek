-- ============================================================
-- Re-issue: Portal Client RLS + Platform Admin Workflow Access (Phase 0)
-- ============================================================
-- Supersedes the never-applied 20260512000000_portal_rls_and_admin_access.sql,
-- which was stranded behind the deferred workflow-template migration
-- stream (20260425000000–20260513000000) and therefore never reached
-- staging or production.
--
-- What this fixes in deployed environments:
--   CRITICAL-1: Portal clients cannot view their invoices
--               (PortalInvoices renders 0 rows)
--   CRITICAL-2: Portal clients cannot view their service request history
--   WARNING-1:  Platform admin pages (AdminRAGQuality,
--               AdminWorkflowDiscovery) see empty workflow intelligence
--               data — platform admins are not in tenant_users, so the
--               tenant-scoped policies return 0 rows.
--
-- All target tables exist in deployed environments:
--   invoices / service_requests        → 20251218033702 (applied)
--   workflow_* intelligence tables     → 20260410200000 / 20260415000000 (applied)
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A. Portal Client SELECT Policies
-- ────────────────────────────────────────────────────────────
-- Pattern: client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
-- Matches existing portal policies on scheduled_jobs + equipment_registry.

-- A1. Invoices — portal clients can view their own invoices
DROP POLICY IF EXISTS "Portal clients can view their own invoices" ON public.invoices;
CREATE POLICY "Portal clients can view their own invoices"
  ON public.invoices
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- A2. Service requests — portal clients can view their own requests
DROP POLICY IF EXISTS "Portal clients can view their own service requests" ON public.service_requests;
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
-- Pattern: is_platform_admin() — matches ai_audit_logs policy.

DROP POLICY IF EXISTS "Platform admins can view workflow symptoms" ON public.workflow_symptoms;
CREATE POLICY "Platform admins can view workflow symptoms"
  ON public.workflow_symptoms
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view workflow failures" ON public.workflow_failures;
CREATE POLICY "Platform admins can view workflow failures"
  ON public.workflow_failures
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view workflow outcomes" ON public.workflow_outcomes;
CREATE POLICY "Platform admins can view workflow outcomes"
  ON public.workflow_outcomes
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view workflow diagnostics" ON public.workflow_diagnostics;
CREATE POLICY "Platform admins can view workflow diagnostics"
  ON public.workflow_diagnostics
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view workflow repairs" ON public.workflow_repairs;
CREATE POLICY "Platform admins can view workflow repairs"
  ON public.workflow_repairs
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view workflow edges" ON public.workflow_intelligence_edges;
CREATE POLICY "Platform admins can view workflow edges"
  ON public.workflow_intelligence_edges
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view diagnostic statistics" ON public.workflow_diagnostic_statistics;
CREATE POLICY "Platform admins can view diagnostic statistics"
  ON public.workflow_diagnostic_statistics
  FOR SELECT
  USING (public.is_platform_admin());
