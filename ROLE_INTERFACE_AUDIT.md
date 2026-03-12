# Role-Based Interface Audit — FieldTek Platform

**Date**: 2026-03-11
**Trigger**: Post security-advisor migration (`20260511000000_security_advisor_fixes.sql`)
**Scope**: 5 roles, 76 page components, ~246 edge function DB operations

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 2 | Portal clients blocked from viewing invoices and service requests |
| WARNING | 1 | Platform admin sees empty workflow intelligence data |
| INFO | 0 | — |

All issues are **pre-existing** — none were caused by the security advisor migration.

---

## Security Migration Impact Matrix

| Changed Object | Type | Client Queries | Roles Affected | Impact |
|---|---|---|---|---|
| `tenant_usage` (RLS added) | table | 0 | none | **SAFE** |
| `workflow_failure_paths` (security_invoker) | view | 1 (AdminRAGQuality) | platform_admin | **WARNING** |
| `workflow_diagnostic_success` (security_invoker) | view | 0 | none | **SAFE** |
| `workflow_repair_effectiveness` (security_invoker) | view | 0 | none | **SAFE** |
| `is_platform_admin` (search_path) | function | 7 (client RPC) | platform_admin | **SAFE** |
| `convert_suggestion_to_template` (search_path) | function | 1 (client RPC) | owner/admin | **SAFE** |
| 11 other functions (search_path) | functions | 0 (edge-fn only) | none | **SAFE** |

---

## Per-Role Page Audit

### Role 1: Platform Admin (`/admin/*`)

Guard: `AdminLayout` checks `is_platform_admin()` RPC.

| Page | Route | Data Sources | RLS Status | Verdict |
|------|-------|-------------|------------|---------|
| AdminDashboard | `/admin` | `tenants`, `demo_requests`, `platform_admins` | `is_platform_admin()` policies | OK |
| AdminTenants | `/admin/tenants` | `tenants` | has `is_platform_admin()` policy | OK |
| AdminFeatureFlags | `/admin/feature-flags` | `feature_flags` | has `is_platform_admin()` policy | OK |
| AdminAIAuditLogs | `/admin/ai-audit` | `ai_audit_logs` | has `is_platform_admin()` policy | OK |
| AdminSystemHealth | `/admin/system-health` | RPC calls | RPCs check `is_platform_admin()` | OK |
| AdminRAGQuality | `/admin/rag-quality` | `workflow_symptoms`, `workflow_failure_paths`, `workflow_outcomes` | tenant_users only — **no** `is_platform_admin()` | **WARNING-1** |
| AdminWorkflowDiscovery | `/admin/workflow-discovery` | workflow tables | same gap as AdminRAGQuality | **WARNING-1** |
| AdminAnalytics | `/admin/analytics` | `tenants`, RPC | `is_platform_admin()` | OK |
| AdminRevenue | `/admin/revenue` | `tenants`, `subscriptions` | `is_platform_admin()` | OK |
| AdminCommunications | `/admin/communications` | `communications` | `is_platform_admin()` | OK |
| AdminWaitlist | `/admin/waitlist` | `waitlist_entries` | `is_platform_admin()` | OK |
| AdminFeedback | `/admin/feedback` | `feedback` | `is_platform_admin()` | OK |
| AdminUsageAnalytics | `/admin/usage-analytics` | `tenant_usage` | `is_platform_admin()` | OK |
| AdminVoiceUsage | `/admin/voice-usage` | `voice_usage_logs` | `is_platform_admin()` | OK |
| AdminBetaApplications | `/admin/beta-applications` | `beta_applications` | `is_platform_admin()` | OK |

### Role 2: Owner / Admin (tenant)

Guard: `RoleGuard allowedRoles={['owner', 'admin']}` or `['owner', 'admin', 'dispatcher']`

| Page | Route | Guard | Data Sources | RLS Status | Verdict |
|------|-------|-------|-------------|------------|---------|
| Dashboard | `/dashboard` | owner/admin/dispatcher | `scheduled_jobs`, `service_requests`, RPC | `get_user_tenant_id()` | OK |
| Jobs | `/jobs` | owner/admin/dispatcher | `scheduled_jobs` CRUD | tenant_id match | OK |
| Clients | `/clients` | owner/admin/dispatcher | `clients` CRUD | tenant_id match | OK |
| Schedule | `/schedule` | owner/admin/dispatcher | `scheduled_jobs`, `tenant_users` | tenant_id match | OK |
| Invoices | `/invoices` | owner/admin/dispatcher | `invoices` CRUD | `is_tenant_admin() OR dispatcher` | OK |
| Team | `/team` | owner/admin | `tenant_users`, invitations | tenant_id match | OK |
| Settings | `/settings` | owner/admin | `tenant_settings`, `tenant_branding` | tenant_id match | OK |
| ServiceRequests | `/requests` | owner/admin/dispatcher | `service_requests` | tenant_id match | OK |
| Reports | `/reports` | owner/admin | aggregation queries | tenant_id match | OK |
| Equipment | `/equipment` | FeatureGate only | `equipment_registry` | tenant_id match | OK |
| Documents | `/documents` | none (all roles) | `documents` | tenant_id match | OK |
| Assistant | `/assistant` | FeatureGate only | edge function | auth check | OK |

### Role 3: Dispatcher

Same access as Owner/Admin for operational pages (Jobs, Schedule, Clients, Invoices, Requests).
Cannot access: Team, Settings, Reports. Guard redirects to `/my-jobs` or blocks.

| Page | Route | Guard | Verdict |
|------|-------|-------|---------|
| Dashboard | `/dashboard` | owner/admin/dispatcher | OK |
| Jobs | `/jobs` | owner/admin/dispatcher | OK |
| Schedule | `/schedule` | owner/admin/dispatcher | OK |
| Clients | `/clients` | owner/admin/dispatcher | OK |
| Invoices | `/invoices` | owner/admin/dispatcher | OK |
| ServiceRequests | `/requests` | owner/admin/dispatcher | OK |
| Equipment | `/equipment` | all (FeatureGate) | OK |
| Documents | `/documents` | all | OK |
| Assistant | `/assistant` | all (FeatureGate) | OK |

### Role 4: Technician

Guard: `RoleGuard allowedRoles={['technician']}`

| Page | Route | Guard | Data Sources | RLS Status | Verdict |
|------|-------|-------|-------------|------------|---------|
| MyJobs | `/my-jobs` | technician | `scheduled_jobs` filtered by `assigned_to` | tenant_id match | OK |
| MyCalendar | `/my-calendar` | technician | `scheduled_jobs` | tenant_id match | OK |
| Equipment | `/equipment` | all (FeatureGate) | `equipment_registry` | tenant_id match | OK |
| Documents | `/documents` | all | `documents` | tenant_id match | OK |
| Assistant | `/assistant` | all (FeatureGate) | edge function | auth check | OK |

Blocked from: Dashboard, Jobs, Clients, Schedule, Invoices, Team, Settings, Reports, ServiceRequests (redirected to `/my-jobs`).

### Role 5: Portal Client (`/portal/*`)

Guard: `PortalAuthGuard` checks `usePortalAuth()`. Separate `PortalAuthContext`.

| Page | Route | Data Sources | RLS Status | Verdict |
|------|-------|-------------|------------|---------|
| PortalDashboard | `/portal` | `scheduled_jobs`, `invoices`, `equipment_registry`, `service_requests` | jobs/equipment have portal policies; **invoices/requests do NOT** | **CRITICAL-1, CRITICAL-2** |
| PortalJobs | `/portal/jobs` | `scheduled_jobs` | has `Portal clients can view jobs` policy | OK |
| PortalInvoices | `/portal/invoices` | `invoices` | **NO portal policy** — SELECT requires `is_tenant_admin() OR dispatcher` | **CRITICAL-1** |
| PortalEquipment | `/portal/equipment` | `equipment_registry` | has `Portal clients can view their own equipment` policy | OK |
| PortalRequest | `/portal/request` | `service_requests` (SELECT + INSERT via edge fn) | SELECT: **NO portal policy**; INSERT: edge fn uses service_role | **CRITICAL-2** |
| PortalProfile | `/portal/profile` | `clients` | has `Portal clients can view their own record` policy | OK |

---

## Issues Detail

### CRITICAL-1: Portal clients cannot view invoices

**Files**: `src/pages/portal/PortalInvoices.tsx:32-49`, `src/pages/portal/PortalDashboard.tsx:41-44`
**Query**: `.from('invoices').select(...).eq('client_id', client.id).eq('tenant_id', client.tenant_id)`
**RLS Policy** (migration `20260107061503`):
```sql
"Admins and dispatchers can view invoices"
USING (tenant_id = get_user_tenant_id() AND (is_tenant_admin() OR get_user_role() = 'dispatcher'))
```
**Problem**: `get_user_tenant_id()` queries `tenant_users` — portal clients are NOT in `tenant_users`, so it returns NULL. Even if it didn't, `is_tenant_admin()` and `get_user_role() = 'dispatcher'` would fail.
**Result**: Portal users always see empty invoice list and $0.00 outstanding.
**Fix**: Add portal-specific SELECT policy using the established pattern.

### CRITICAL-2: Portal clients cannot view service request history

**Files**: `src/pages/portal/PortalRequest.tsx:113-119`, `src/pages/portal/PortalDashboard.tsx:50-54`
**Query**: `.from('service_requests').select(...).eq('client_id', client.id).eq('tenant_id', client.tenant_id)`
**RLS Policy** (migration `20251218033702`):
```sql
"Users can view service requests in their tenant"
USING (tenant_id = get_user_tenant_id())
```
**Problem**: Same as CRITICAL-1 — `get_user_tenant_id()` returns NULL for portal clients.
**Result**: Portal users can submit requests (via edge function) but cannot see their request history.
**Note**: INSERT works because `verify-turnstile-portal` edge function uses service_role key. The existing INSERT policy (migration `20260108035951`) also includes a portal client path, but the edge function bypasses RLS anyway.
**Fix**: Add portal-specific SELECT policy.

### WARNING-1: AdminRAGQuality shows empty workflow data

**Files**: `src/pages/admin/AdminRAGQuality.tsx:274-310`
**Queries**: `workflow_symptoms`, `workflow_failure_paths` (view), `workflow_outcomes` — no tenant_id filter
**RLS Policies** (migration `20260410200000`):
```sql
USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
```
**Problem**: Platform admins are NOT in `tenant_users`. Unlike `ai_audit_logs` which has a dedicated `is_platform_admin()` policy, workflow tables lack this.
**Result**: Platform admin sees 0 symptoms, 0 failure paths, 0 outcomes on the RAG Quality dashboard.
**Fix**: Add `is_platform_admin()` SELECT policies to 7 workflow tables.

---

## Fix Plan

Migration: `20260512000000_portal_rls_and_admin_access.sql`

### CRITICAL-1 Fix
```sql
CREATE POLICY "Portal clients can view their own invoices"
  ON public.invoices FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
```

### CRITICAL-2 Fix
```sql
CREATE POLICY "Portal clients can view their own service requests"
  ON public.service_requests FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
```

### WARNING-1 Fix (7 policies)
```sql
CREATE POLICY "Platform admins can view workflow symptoms"
  ON public.workflow_symptoms FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can view workflow failures"
  ON public.workflow_failures FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can view workflow outcomes"
  ON public.workflow_outcomes FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can view workflow diagnostics"
  ON public.workflow_diagnostics FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can view workflow repairs"
  ON public.workflow_repairs FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can view workflow edges"
  ON public.workflow_intelligence_edges FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform admins can view diagnostic statistics"
  ON public.workflow_diagnostic_statistics FOR SELECT USING (is_platform_admin());
```

---

## Recommendations

1. **Systematic portal policy audit**: Every table accessed by portal pages should have a `client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())` policy. Currently only `scheduled_jobs`, `equipment_registry`, and `clients` have this.

2. **Platform admin policy pattern**: Every tenant-scoped table queried from `/admin/*` pages needs an `is_platform_admin()` bypass. Consider a helper view or function to avoid duplicating this pattern.

3. **PortalDashboard aggregation**: Once the RLS fixes are applied, PortalDashboard will correctly show invoice totals and service request counts that are currently always 0.
