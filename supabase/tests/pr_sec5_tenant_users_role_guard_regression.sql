-- ============================================================
-- Regression: PR-SEC-5 / B3 tenant_users role-transition guard
-- Migration: 20260716000000_pr_sec5_tenant_users_role_guard.sql
-- ============================================================
--
-- WHY THIS IS A STANDALONE SQL ARTIFACT (documented limitation)
-- ------------------------------------------------------------
-- This repo has no CI-wired database test harness (no pgTAP; vitest covers only
-- pure/frontend TS and cannot exercise RLS or triggers). This is a MANUAL
-- regression script. Run against a LOCAL or SHADOW database:
--   supabase db start
--   supabase db query --local -f supabase/tests/pr_sec5_tenant_users_role_guard_regression.sql
-- DO NOT run against the production/canonical fgem backend: although fully
-- transactional and ending in ROLLBACK (it persists nothing), it INSERTs
-- synthetic auth users / tenants / memberships and must never touch real data.
-- (PR-TEST-3 wires supabase/tests/*.sql into CI.)
--
-- WHAT IT PROVES (protect_tenant_user_roles trigger; founder-confirmed matrix)
-- ---------------------------------------------------------------------------
--   1. admin CANNOT self-promote to owner (the escalation closed)      [row 8]
--   2. admin CANNOT grant owner to another member via UPDATE           [row 4]
--   3. admin CANNOT INSERT a new owner row for someone else            [row 4]
--   4. owner CAN change a non-owner member's role                      [row 3]
--   5. admin CAN change a non-owner member's role                      [row 6]
--   6. owner CAN demote a co-owner while another owner remains         [row 1]
--   7. admin CANNOT modify an owner's membership row                   [row 7]
--   8. the LAST active owner CANNOT be demoted                         [row 11]
--   9. the LAST active owner CANNOT be deactivated                     [row 11]
--  10. onboarding self-insert of an owner row (caller owns the tenant) [row 12]
--  11. service_role bypasses the guard entirely                        [row 15]
--  12. an OWNER cannot promote a technician straight to owner          [PR-TEST-3]
-- ============================================================

-- Part A — structural assertion (SAFE READ-ONLY; may run anywhere).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'protect_tenant_user_roles'
                 AND pronamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: function public.protect_tenant_user_roles() missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'protect_tenant_user_roles'
      AND c.relname = 'tenant_users'
      AND c.relnamespace = 'public'::regnamespace
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: trigger protect_tenant_user_roles on public.tenant_users missing';
  END IF;

  RAISE NOTICE 'PASS (structural): role-guard function and trigger present';
END $$;

-- Part B — behavioral assertion (transactional; ROLLBACK persists nothing).
BEGIN;
DO $$
DECLARE
  v_tenant_a  uuid := gen_random_uuid();
  v_tenant_c  uuid := gen_random_uuid();  -- owned by v_newowner, no membership yet
  v_owner     uuid := gen_random_uuid();  -- tenant A owner (permanent)
  v_owner2    uuid := gen_random_uuid();  -- tenant A second owner (demoted in case 6)
  v_admin     uuid := gen_random_uuid();  -- tenant A admin
  v_dispatch  uuid := gen_random_uuid();  -- tenant A dispatcher
  v_fresh     uuid := gen_random_uuid();  -- unaffiliated user (grant target)
  v_newowner  uuid := gen_random_uuid();  -- owns tenant C, self-inserts owner
  v_tech      uuid := gen_random_uuid();  -- tenant A technician (owner-promotes-to-owner target, case 12)
BEGIN
  -- ── Seed. auth.uid() is NULL here (no JWT), so the guard's trusted-SQL
  --    bypass applies — exactly how migrations/superuser seeding behaves. ──
  INSERT INTO auth.users (id, email) VALUES
    (v_owner,    'reg5-owner@example.test'),
    (v_owner2,   'reg5-owner2@example.test'),
    (v_admin,    'reg5-admin@example.test'),
    (v_dispatch, 'reg5-dispatch@example.test'),
    (v_fresh,    'reg5-fresh@example.test'),
    (v_newowner, 'reg5-newowner@example.test'),
    (v_tech,     'reg5-tech@example.test');

  INSERT INTO public.tenants (id, name, slug, owner_id) VALUES
    (v_tenant_a, 'REG SEC5 A', 'reg-sec5-a-' || v_tenant_a, v_owner),
    (v_tenant_c, 'REG SEC5 C', 'reg-sec5-c-' || v_tenant_c, v_newowner);

  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active) VALUES
    (v_tenant_a, v_owner,    'owner',      true),
    (v_tenant_a, v_owner2,   'owner',      true),
    (v_tenant_a, v_admin,    'admin',      true),
    (v_tenant_a, v_dispatch, 'dispatcher', true),
    (v_tenant_a, v_tech,     'technician', true);

  -- Helper macro pattern: set the acting authenticated user, then run a case.

  -- ── 1. admin self-promote to owner -> DENIED [row 8] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'owner'
      WHERE tenant_id = v_tenant_a AND user_id = v_admin;
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(1): admin self-promoted to owner';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS(1): admin self-promote to owner denied';
  END;

  -- ── 2. admin grants owner to another member (UPDATE) -> DENIED [row 4] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'owner'
      WHERE tenant_id = v_tenant_a AND user_id = v_dispatch;
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(2): admin granted owner to a dispatcher';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS(2): admin grant-owner via update denied';
  END;

  -- ── 3. admin INSERTs a new owner row for someone else -> DENIED [row 4] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
      VALUES (v_tenant_a, v_fresh, 'owner', true);
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(3): admin inserted an owner row for another user';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS(3): admin insert-owner denied';
  END;

  -- ── 4. owner changes a non-owner member's role -> ALLOWED [row 3] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'technician'
      WHERE tenant_id = v_tenant_a AND user_id = v_dispatch;
    RESET ROLE;
    RAISE NOTICE 'PASS(4): owner changed a dispatcher to technician';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(4): owner blocked from a legit non-owner role change -> %', SQLERRM;
  END;

  -- ── 5. admin changes a non-owner member's role -> ALLOWED [row 6] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'dispatcher'
      WHERE tenant_id = v_tenant_a AND user_id = v_dispatch;
    RESET ROLE;
    RAISE NOTICE 'PASS(5): admin changed a technician to dispatcher';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(5): admin blocked from a legit non-owner role change -> %', SQLERRM;
  END;

  -- ── 6. owner demotes a CO-owner while another owner remains -> ALLOWED [row 1] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'admin'
      WHERE tenant_id = v_tenant_a AND user_id = v_owner2;
    RESET ROLE;
    RAISE NOTICE 'PASS(6): owner demoted a co-owner (two owners existed)';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(6): owner blocked from demoting a co-owner -> %', SQLERRM;
  END;
  -- tenant A now has exactly one active owner: v_owner.

  -- ── 7. admin modifies an OWNER's membership row -> DENIED [row 7] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'admin'
      WHERE tenant_id = v_tenant_a AND user_id = v_owner;
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(7): admin modified an owner row';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS(7): admin modifying an owner row denied';
  END;

  -- ── 12. OWNER promotes a technician directly to owner -> DENIED [PR-TEST-3] ──
  --    The escalation guard blocks ANY member->owner UPDATE regardless of caller.
  --    Every prior promote-to-owner case (1-3) used an ADMIN actor; this closes the
  --    previously untested OWNER-actor path. v_tech is an untouched technician; v_owner
  --    is still the active owner, so this isolates the promotion rule itself.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'owner'
      WHERE tenant_id = v_tenant_a AND user_id = v_tech;
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(12): owner promoted a technician straight to owner';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS(12): owner promoting a technician to owner denied';
  END;

  -- ── 8. LAST active owner demote -> DENIED [row 11] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET role = 'admin'
      WHERE tenant_id = v_tenant_a AND user_id = v_owner;
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(8): last owner self-demoted';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS(8): last-owner demotion denied';
  END;

  -- ── 9. LAST active owner deactivate -> DENIED [row 11] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.tenant_users SET is_active = false
      WHERE tenant_id = v_tenant_a AND user_id = v_owner;
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(9): last owner deactivated';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS(9): last-owner deactivation denied';
  END;

  -- ── 10. onboarding self-insert of an owner row (caller owns tenant C) -> ALLOWED [row 12] ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_newowner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
      VALUES (v_tenant_c, v_newowner, 'owner', true);
    RESET ROLE;
    RAISE NOTICE 'PASS(10): onboarding self-insert of owner allowed';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(10): onboarding self-owner insert blocked -> %', SQLERRM;
  END;

  -- ── 11. service_role bypasses the guard entirely -> ALLOWED [row 15] ──
  SET LOCAL ROLE service_role;
  BEGIN
    UPDATE public.tenant_users SET role = 'owner'
      WHERE tenant_id = v_tenant_a AND user_id = v_admin;
    RESET ROLE;
    RAISE NOTICE 'PASS(11): service_role bypass allowed an owner promotion';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL(11): service_role was blocked by the guard -> %', SQLERRM;
  END;

  RAISE NOTICE 'ALL BEHAVIORAL CASES PASSED';
END $$;
ROLLBACK;
