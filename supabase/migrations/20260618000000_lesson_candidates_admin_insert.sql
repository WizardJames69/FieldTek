-- ============================================================
-- Sentinel AI v2 — Approved Learning Loop, PR-2
-- lesson_candidates: platform-admin INSERT policy
-- ============================================================
-- PR-1 only granted INSERT to tenant members
-- (tenant_id = get_user_tenant_id() AND created_by = auth.uid()).
-- The candidate-intake surface lives on the platform-admin AI Audit Logs
-- console, which is cross-tenant: a platform admin viewing tenant X's audit
-- log has get_user_tenant_id() != X, so the tenant-member policy denies the
-- insert. This adds the matching platform-admin INSERT policy so the admin
-- console can create a pending candidate for the audit log's tenant.
--
-- This mirrors PR-1's "Platform admins can review lesson candidates" UPDATE
-- policy exactly: additive, highest-privilege only. created_by is still
-- pinned to auth.uid() so authorship is always truthful; tenant_id is carried
-- from the source audit log.
--
-- Scope guard: nothing here makes a lesson citable. This only allows creating
-- a pending row. Retrieval, citation, embeddings, and abstain behavior are
-- completely unaffected.
--
-- Migration safety: fresh timestamp AFTER 20260617000000 (PR-1). Additive
-- only. Does NOT modify any existing table, column, or policy, and does NOT
-- touch the 7 deferred workflow migrations. Apply only via the documented
-- single-file method (never `supabase db push`).

DROP POLICY IF EXISTS "Platform admins can insert lesson candidates" ON public.lesson_candidates;
CREATE POLICY "Platform admins can insert lesson candidates"
ON public.lesson_candidates
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin() AND created_by = auth.uid());
