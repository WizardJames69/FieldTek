-- ============================================================
-- PR-DB-1 — is_tenant_admin(uuid, uuid) tenant-scoped overload
-- ============================================================
-- Reconstruction repair (forward-only, intentionally backdated).
--
-- 20260510000000_workflow_pattern_discovery.sql:86 creates
--   CREATE POLICY "Tenant admins can manage pattern suggestions"
--     ON public.workflow_pattern_suggestions FOR ALL
--     USING (is_tenant_admin(auth.uid(), tenant_id));
-- Postgres resolves the function reference at CREATE POLICY time, so migration
-- 510 requires a TWO-argument is_tenant_admin(uuid, uuid). That overload was
-- never created by any repository migration — only the zero-argument
-- is_tenant_admin() exists (20251218033702, 20251218033719) — so a clean
-- from-zero replay aborts at 510 with
--   "function is_tenant_admin(uuid, uuid) does not exist".
--
-- Confirmed against the canonical backend (fgem) 2026-07-16: the 2-arg overload
-- is ALSO absent there, and migration 510 never materialized on production at
-- all (its tables workflow_pattern_clusters / workflow_pattern_suggestions, its
-- RPCs, and its feature-flag row are all absent; the version is not in the
-- remote ledger). The call was simply broken everywhere and production silently
-- skipped the flag-off, disconnected pattern-discovery feature. Nothing on
-- production references this overload, so creating it there is inert until 510
-- itself is applied.
--
-- This migration is dated 20260509000000 — one slot before 510; the range
-- 20260501000001..20260509999999 is unused — so a from-zero replay creates the
-- helper BEFORE 510 resolves its policy. A forward-dated migration could not
-- help: 510 aborts before any later migration runs. No historical migration is
-- edited. The fgem migration-ledger reconciliation is handled deliberately at
-- deploy time (see the PR-DB-1 plan), NOT by re-running this against the drifted
-- production ledger.
--
-- Semantics: the tenant-scoped twin of is_tenant_admin() and a set-valued
-- sibling of has_tenant_role(_user_id, _tenant_id, _role) — "is _user_id an
-- active owner/admin OF _tenant_id". Because it binds the row's tenant_id it is
-- STRICTER than the 0-arg helper (which only checks the caller's single active
-- membership); it does not weaken tenant isolation. Attributes mirror the live
-- 0-arg helper (LANGUAGE sql, STABLE, SECURITY DEFINER, search_path=public).
-- Default PUBLIC EXECUTE is retained on purpose: RLS evaluates policy predicates
-- as the querying role, so `authenticated` must be able to execute it or the
-- policy on workflow_pattern_suggestions would raise "permission denied".
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  )
$$;
