-- ============================================================
-- PR-SEC-5 / B3 — tenant_users role-transition guard
-- ============================================================
-- Closes an admin -> owner self-escalation. The only policy granting
-- UPDATE/DELETE on tenant_users is "Admins can manage tenant users"
-- (20251218033702:421), a FOR ALL policy with no explicit WITH CHECK:
--   FOR ALL USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
-- With no WITH CHECK, Postgres reuses USING as the check. It validates tenant
-- membership + admin status but NEVER inspects `role`, so an admin can
--   UPDATE tenant_users SET role='owner' WHERE user_id = auth.uid()
-- (or grant owner to anyone) via a direct PostgREST/supabase-js call. RLS
-- cannot express the fix: an UPDATE WITH CHECK sees only NEW (cannot assert
-- NEW.role = OLD.role) and cannot count remaining owners. So we mirror the
-- existing protect_subscription_columns() guard (20260228100000:15-48) with a
-- BEFORE INSERT/UPDATE/DELETE trigger. The existing policies are left intact —
-- no DROP/CREATE on the load-bearing membership policy, so there is no window
-- where membership management is unprotected.
--
-- Role-transition rules enforced (founder-confirmed matrix):
--   * No path may promote a member INTO owner (no ownership-transfer flow yet).
--   * Only the onboarding self-insert may mint an owner row (caller already
--     owns the tenant in `tenants`).
--   * An existing owner's row may be changed only by an owner (owners manage
--     co-owners; admins may not touch owner rows).
--   * The last active owner of a tenant may never be demoted, deactivated, or
--     deleted.
--   * Service-role callers (seeding, provisioner, service-role edge functions)
--     bypass. accept_team_invitation runs as the authenticated caller and only
--     ever inserts non-owner roles, so it passes the rules below unchanged.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_tenant_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_caller_is_owner boolean;
  v_active_owner_count int;
BEGIN
  -- Service-role / back-office writers bypass entirely.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Trusted SQL contexts (migrations, superuser data fixes, seeding) run with
  -- no JWT, so auth.uid() is NULL; this bypass lets them manage memberships
  -- freely. It is NOT an untrusted escape hatch, because RLS independently
  -- gates every tenant_users write and is the backstop for any NULL-uid caller:
  --   * anon/unauthenticated UPDATE/DELETE match no row (the manage policy's
  --     USING is_tenant_admin() is false and is evaluated before this trigger),
  --   * an anon INSERT — where a BEFORE trigger does fire before RLS — is still
  --     rejected by the INSERT policy's WITH CHECK.
  -- Verified in supabase/tests (pr_sec5 NULL-uid boundary). The escalation this
  -- guard closes is an *authenticated* admin, who always has a non-NULL uid and
  -- is fully governed below.
  IF v_uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
  v_caller_is_owner := EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = v_tenant
      AND user_id = v_uid
      AND role = 'owner'
      AND is_active = true
  );

  -- ── INSERT ─────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'owner' THEN
      -- Only the onboarding self-insert may create an owner row: the caller
      -- claims ownership of a tenant they already own in `tenants`.
      IF NOT (NEW.user_id = v_uid
              AND EXISTS (SELECT 1 FROM public.tenants
                          WHERE id = NEW.tenant_id AND owner_id = v_uid)) THEN
        RAISE EXCEPTION 'Cannot grant the owner role.'
          USING ERRCODE = 'insufficient_privilege',
                HINT = 'Ownership transfer is not permitted through direct membership writes.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ── DELETE ─────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' THEN
      IF NOT v_caller_is_owner THEN
        RAISE EXCEPTION 'Only an owner may remove an owner membership.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      IF OLD.is_active THEN
        SELECT count(*) INTO v_active_owner_count FROM public.tenant_users
          WHERE tenant_id = OLD.tenant_id AND role = 'owner' AND is_active = true;
        IF v_active_owner_count <= 1 THEN
          RAISE EXCEPTION 'Cannot remove the last active owner of a tenant.'
            USING ERRCODE = 'insufficient_privilege';
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- ── UPDATE ─────────────────────────────────────────────────────
  -- No path may promote a member INTO owner (this is the escalation closed).
  IF NEW.role = 'owner' AND OLD.role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Cannot promote a member to owner.'
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'Ownership transfer is not permitted through direct membership writes.';
  END IF;

  -- An existing owner's row may only be changed by an owner (admins may not
  -- touch owner rows; owners may manage co-owners).
  IF OLD.role = 'owner' AND NOT v_caller_is_owner THEN
    RAISE EXCEPTION 'Only an owner may modify an owner membership.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Never leave a tenant with zero active owners (demotion or deactivation).
  IF OLD.role = 'owner' AND OLD.is_active
     AND (NEW.role IS DISTINCT FROM 'owner' OR NEW.is_active IS DISTINCT FROM true) THEN
    SELECT count(*) INTO v_active_owner_count FROM public.tenant_users
      WHERE tenant_id = OLD.tenant_id AND role = 'owner' AND is_active = true;
    IF v_active_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote or deactivate the last active owner of a tenant.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_tenant_user_roles ON public.tenant_users;
CREATE TRIGGER protect_tenant_user_roles
  BEFORE INSERT OR UPDATE OR DELETE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.protect_tenant_user_roles();
