-- ============================================================
-- Sentinel AI v2 — Approved Learning Loop, PR-1
-- lesson_candidates: human-approved, tenant-scoped knowledge spine
-- ============================================================
-- Stores candidate "lessons" sourced from AI interactions, technician
-- notes, or manual entry, for human review (approve / reject / archive).
--
-- IMPORTANT: This PR stores and reviews candidates ONLY. Approved
-- candidates are NOT yet citable: nothing here is embedded, retrieved,
-- or fed into field-assistant. Retrieval, citation, and abstain behavior
-- are completely unaffected by this table.
--
-- Migration safety: fresh timestamp AFTER 20260513000000 (the latest
-- deferred workflow migration) and after the current applied HEAD
-- (20260615000000). Additive only. Does NOT touch any existing table,
-- policy, or the 7 deferred workflow migrations. Apply only via the
-- documented single-file method (never `supabase db push`).

CREATE TABLE IF NOT EXISTS public.lesson_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('ai_interaction', 'technician_note', 'manual')),
  correlation_id uuid NULL,
  audit_log_id uuid NULL REFERENCES public.ai_audit_logs(id) ON DELETE SET NULL,
  question text NOT NULL,
  proposed_answer text NOT NULL,
  equipment_type text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  created_by uuid NOT NULL,
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  review_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Review-queue ordering and correlation lookups
CREATE INDEX IF NOT EXISTS idx_lesson_candidates_tenant_status_created
  ON public.lesson_candidates (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_candidates_correlation
  ON public.lesson_candidates (correlation_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Reuses existing helpers (same ones used by ai_audit_logs policies):
--   get_user_tenant_id() -> the caller's active tenant
--   is_tenant_admin()    -> caller is owner/admin of their active tenant
--   is_platform_admin()  -> caller is a platform admin
ALTER TABLE public.lesson_candidates ENABLE ROW LEVEL SECURITY;

-- Explicit anonymous deny (parity with ai_audit_logs house style).
CREATE POLICY "Deny anonymous access to lesson_candidates"
ON public.lesson_candidates
FOR SELECT
USING (false);

-- Tenant staff can read their own tenant's candidates.
CREATE POLICY "Tenant members can view tenant lesson candidates"
ON public.lesson_candidates
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- Platform admins can read all candidates (powers the /admin console).
CREATE POLICY "Platform admins can view all lesson candidates"
ON public.lesson_candidates
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

-- Tenant staff can create candidates for their own tenant as themselves.
CREATE POLICY "Tenant members can insert lesson candidates"
ON public.lesson_candidates
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND created_by = auth.uid()
);

-- Tenant admins can review (approve / reject / archive) their tenant's candidates.
CREATE POLICY "Tenant admins can review lesson candidates"
ON public.lesson_candidates
FOR UPDATE
TO authenticated
USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin())
WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin());

-- Platform admins can review candidates from the /admin console.
-- Required because the admin console is platform-admin-only; without this a
-- platform admin could view but not approve. Additive, highest-privilege only.
CREATE POLICY "Platform admins can review lesson candidates"
ON public.lesson_candidates
FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- No DELETE policy: candidates are retired via status = 'archived' to
-- preserve the review audit trail.

COMMENT ON TABLE public.lesson_candidates IS
  'Sentinel learning loop PR-1: human-reviewed candidate lessons. Not citable; not embedded; does not affect retrieval/citation/abstain.';
