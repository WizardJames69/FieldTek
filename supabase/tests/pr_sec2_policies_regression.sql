-- ============================================================
-- Regression: PR-SEC-2 storage documents ACL + service_requests INSERT
-- Migration: 20260706000000_pr_sec2_storage_docs_acl_service_requests_insert.sql
-- ============================================================
--
-- WHY THIS IS A STANDALONE SQL ARTIFACT (documented limitation)
-- ------------------------------------------------------------
-- This repo has NO database test harness: no pgTAP, no supabase/tests runner,
-- and the vitest suite only covers frontend/pure TS (it cannot exercise RLS).
-- This file is therefore a MANUAL regression script, not a CI-wired test.
-- Run it against a LOCAL or SHADOW database (e.g. `supabase db start` then
-- `supabase db query --local -f supabase/tests/pr_sec2_policies_regression.sql`).
-- DO NOT run it against the production/canonical fgem backend: although it is
-- fully transactional and ends in ROLLBACK (it persists nothing), it INSERTs
-- synthetic auth users / tenants / storage objects and should never touch
-- real project data.
--
-- WHAT IT PROVES
-- --------------
-- Fix 1 — documents bucket SELECT mirrors public.documents ACL:
--   1. tenant admin CAN see all three tenant-A document objects
--      (public, admin-only, tech-uploaded — via the admin arm),
--   2. technician (non-admin) CANNOT see the admin-only object,
--   3. technician CAN see the public object (incl. one whose documents row
--      stores a LEGACY full public URL) and their OWN uploaded object,
--   4. cross-tenant user (tenant B) sees ZERO tenant-A objects,
--   5. an orphan object (no documents row) is visible to NOBODY.
-- Fix 2 — service_requests INSERT:
--   6. anon direct INSERT is DENIED (any tenant),
--   7. authenticated member CAN insert into their own tenant,
--   8. authenticated member CANNOT insert into a foreign tenant,
--   9. portal client CAN insert against their own client record,
--  10. portal client CANNOT insert against another tenant.
-- ============================================================

-- Part A — structural assertion (SAFE READ-ONLY; may be run anywhere, incl. remote).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
             AND policyname IN ('Tenant members can view documents', 'Tenant users can read their documents')) THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: legacy folder-wide documents SELECT policy still present';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'Document files follow documents table access' AND cmd = 'SELECT') THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: new documents-ACL storage SELECT policy missing';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_requests'
             AND policyname IN ('Service requests require valid tenant', 'Users can create service requests')) THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: legacy service_requests INSERT policy still present';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_requests'
                 AND policyname = 'Members and own portal clients can create service requests'
                 AND cmd = 'INSERT' AND roles = '{authenticated}') THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: new authenticated-only service_requests INSERT policy missing';
  END IF;

  -- No OTHER INSERT policy may quietly re-open anon inserts.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'service_requests'
             AND cmd = 'INSERT'
             AND policyname <> 'Members and own portal clients can create service requests') THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: unexpected extra INSERT policy on service_requests';
  END IF;

  RAISE NOTICE 'PASS (structural): legacy policies gone, hardened policies in place';
END $$;

-- Part B — behavioral assertion (transactional; ROLLBACK persists nothing).
BEGIN;
DO $$
DECLARE
  v_tenant_a  uuid := gen_random_uuid();
  v_tenant_b  uuid := gen_random_uuid();
  v_admin     uuid := gen_random_uuid();  -- tenant A owner
  v_tech      uuid := gen_random_uuid();  -- tenant A technician
  v_outsider  uuid := gen_random_uuid();  -- tenant B member
  v_portal    uuid := gen_random_uuid();  -- tenant A portal client user
  v_client    uuid := gen_random_uuid();  -- tenant A clients row
  obj_public  text;
  obj_admin   text;
  obj_tech    text;
  obj_orphan  text;
  n int;
BEGIN
  obj_public := v_tenant_a || '/1000-public.pdf';
  obj_admin  := v_tenant_a || '/2000-adminonly.pdf';
  obj_tech   := v_tenant_a || '/3000-techupload.pdf';
  obj_orphan := v_tenant_a || '/4000-orphan.pdf';

  -- ── Seed (as privileged role; RLS not yet in play) ─────────
  INSERT INTO auth.users (id, email)
  VALUES (v_admin,    'reg-admin@example.test'),
         (v_tech,     'reg-tech@example.test'),
         (v_outsider, 'reg-outsider@example.test'),
         (v_portal,   'reg-portal@example.test');

  INSERT INTO public.tenants (id, name, slug)
  VALUES (v_tenant_a, 'REG SEC2 A', 'reg-sec2-a-' || v_tenant_a),
         (v_tenant_b, 'REG SEC2 B', 'reg-sec2-b-' || v_tenant_b);

  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
  VALUES (v_tenant_a, v_admin,    'owner',      true),
         (v_tenant_a, v_tech,     'technician', true),
         (v_tenant_b, v_outsider, 'owner',      true);

  INSERT INTO public.clients (id, tenant_id, name, user_id)
  VALUES (v_client, v_tenant_a, 'REG portal client', v_portal);

  -- Public doc uses the LEGACY full-URL file_url form on purpose.
  INSERT INTO public.documents (tenant_id, name, file_url, is_public, uploaded_by)
  VALUES (v_tenant_a, 'reg public',    'https://example.supabase.co/storage/v1/object/public/documents/' || obj_public, true,  v_admin),
         (v_tenant_a, 'reg adminonly', obj_admin,                                                                       false, v_admin),
         (v_tenant_a, 'reg techdoc',   obj_tech,                                                                        false, v_tech);

  INSERT INTO storage.buckets (id, name)
  VALUES ('documents', 'documents')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('documents', obj_public),
         ('documents', obj_admin),
         ('documents', obj_tech),
         ('documents', obj_orphan);

  -- ── 1+5. Admin sees exactly the 3 ACL'd objects (not the orphan) ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM storage.objects
   WHERE bucket_id = 'documents' AND name LIKE v_tenant_a || '/%';
  RESET ROLE;
  IF n <> 3 THEN
    RAISE EXCEPTION 'FAIL: admin sees % tenant-A objects, expected 3 (orphan must stay hidden)', n;
  END IF;
  RAISE NOTICE 'PASS: admin sees all 3 registered objects, orphan hidden';

  -- ── 2+3. Technician sees public (legacy URL form) + own upload, NOT admin-only ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_tech, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM storage.objects
   WHERE bucket_id = 'documents' AND name IN (obj_public, obj_tech);
  IF n <> 2 THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: technician sees % of (public, own upload), expected 2', n;
  END IF;
  SELECT count(*) INTO n FROM storage.objects
   WHERE bucket_id = 'documents' AND name = obj_admin;
  RESET ROLE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: technician can see the admin-only object';
  END IF;
  RAISE NOTICE 'PASS: technician sees public + own upload only';

  -- ── 4. Cross-tenant user sees zero tenant-A objects ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM storage.objects
   WHERE bucket_id = 'documents' AND name LIKE v_tenant_a || '/%';
  RESET ROLE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: cross-tenant user sees % tenant-A objects', n;
  END IF;
  RAISE NOTICE 'PASS: cross-tenant user sees zero tenant-A objects';

  -- ── 6. Anon direct service_requests INSERT is denied ──
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN
    INSERT INTO public.service_requests (tenant_id, title) VALUES (v_tenant_a, 'reg anon spam');
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: anon could insert a service request';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RESET ROLE;
    RAISE NOTICE 'PASS: anon service_requests insert denied -> %', SQLERRM;
  END;

  -- ── 7+8. Member: own tenant allowed, foreign tenant denied ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_tech, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.service_requests (tenant_id, title) VALUES (v_tenant_a, 'reg member own tenant');
    RAISE NOTICE 'PASS: member CAN insert into own tenant';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: member blocked from own tenant -> %', SQLERRM;
  END;
  BEGIN
    INSERT INTO public.service_requests (tenant_id, title) VALUES (v_tenant_b, 'reg member foreign tenant');
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: member could insert into a FOREIGN tenant';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'PASS: member foreign-tenant insert denied';
  END;
  RESET ROLE;

  -- ── 9+10. Portal client: own client record allowed, foreign tenant denied ──
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_portal, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.service_requests (tenant_id, client_id, title)
    VALUES (v_tenant_a, v_client, 'reg portal own client');
    RAISE NOTICE 'PASS: portal client CAN insert against own client record';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: portal client blocked on own client record -> %', SQLERRM;
  END;
  BEGIN
    INSERT INTO public.service_requests (tenant_id, client_id, title)
    VALUES (v_tenant_b, v_client, 'reg portal foreign tenant');
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: portal client could insert into a FOREIGN tenant';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'PASS: portal client foreign-tenant insert denied';
  END;
  RESET ROLE;

  RAISE NOTICE 'ALL BEHAVIORAL CASES PASSED';
END $$;
ROLLBACK;
