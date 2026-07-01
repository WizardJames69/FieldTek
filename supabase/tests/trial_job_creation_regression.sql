-- ============================================================
-- Regression: trial-tenant job creation (P0 fix guard)
-- Migration: 20260701000000_drop_stray_job_usage_trigger.sql
-- ============================================================
--
-- WHY THIS IS A STANDALONE SQL ARTIFACT (documented limitation)
-- ------------------------------------------------------------
-- This repo has NO database test harness: no pgTAP, no supabase/tests runner,
-- and the vitest suite only covers frontend/pure TS (it cannot exercise
-- Postgres triggers). This file is therefore a MANUAL regression script, not a
-- CI-wired test. Run it against a LOCAL or SHADOW database (e.g. `supabase db
-- start` then `supabase db query --local -f supabase/tests/trial_job_creation_regression.sql`).
-- DO NOT run it against the production/canonical fgem backend: although it is
-- fully transactional and ends in ROLLBACK (it persists nothing), it performs
-- INSERTs and should not touch real project data.
--
-- WHAT IT PROVES
-- --------------
-- With the stray enforce_job_usage / increment_job_usage() gate removed and only
-- the canonical enforce_job_limit() trigger in place:
--   1. an unexpired TRIAL tenant CAN insert a scheduled_jobs row,
--   2. a PAST_DUE tenant is still BLOCKED,
--   3. a CANCELLED tenant is still BLOCKED,
--   4. an ACTIVE tenant CAN insert.
-- If the stray trigger were still present, case (1) would fail with
-- "Subscription inactive. Please update billing." — so this is a true guard.
--
-- Synthetic tenants only (name + slug are the sole required tenants columns;
-- owner_id is nullable with no FK requirement). Everything is rolled back.
-- ============================================================

-- Part A — structural assertion (SAFE READ-ONLY; may be run anywhere, incl. remote).
-- Fails loudly if the stray objects survived or the canonical trigger is missing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.scheduled_jobs'::regclass
      AND tgname = 'enforce_job_usage' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: stray trigger enforce_job_usage still present';
  END IF;

  IF to_regprocedure('public.increment_job_usage()') IS NOT NULL THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: increment_job_usage() still exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.scheduled_jobs'::regclass
      AND tgname = 'check_job_limit' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STRUCTURAL FAIL: canonical trigger check_job_limit missing';
  END IF;

  RAISE NOTICE 'PASS (structural): stray gate gone, canonical enforce_job_limit intact';
END $$;

-- Part B — behavioral assertion (transactional; ROLLBACK persists nothing).
BEGIN;
DO $$
DECLARE
  v_trial   uuid := gen_random_uuid();
  v_pastdue uuid := gen_random_uuid();
  v_cancel  uuid := gen_random_uuid();
  v_active  uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.tenants (id, name, slug, subscription_tier, subscription_status, trial_ends_at)
  VALUES
    (v_trial,   'REGRESSION trial',   'reg-trial-'||v_trial,     'trial', 'trial',     now() + interval '14 days'),
    (v_pastdue, 'REGRESSION pastdue', 'reg-pastdue-'||v_pastdue, 'trial', 'past_due',  now() + interval '14 days'),
    (v_cancel,  'REGRESSION cancel',  'reg-cancel-'||v_cancel,   'trial', 'cancelled', now() + interval '14 days'),
    (v_active,  'REGRESSION active',  'reg-active-'||v_active,   'trial', 'active',    now() + interval '14 days');

  -- 1. TRIAL must be allowed.
  BEGIN
    INSERT INTO public.scheduled_jobs (tenant_id, title, status) VALUES (v_trial, 'reg trial job', 'pending');
    RAISE NOTICE 'PASS: trial tenant CAN create a job';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: trial tenant was blocked -> %', SQLERRM;
  END;

  -- 2. PAST_DUE must be blocked.
  BEGIN
    INSERT INTO public.scheduled_jobs (tenant_id, title, status) VALUES (v_pastdue, 'reg pastdue job', 'pending');
    RAISE EXCEPTION 'FAIL: past_due tenant was NOT blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: past_due tenant blocked -> %', SQLERRM;
  END;

  -- 3. CANCELLED must be blocked.
  BEGIN
    INSERT INTO public.scheduled_jobs (tenant_id, title, status) VALUES (v_cancel, 'reg cancel job', 'pending');
    RAISE EXCEPTION 'FAIL: cancelled tenant was NOT blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: cancelled tenant blocked -> %', SQLERRM;
  END;

  -- 4. ACTIVE must be allowed.
  BEGIN
    INSERT INTO public.scheduled_jobs (tenant_id, title, status) VALUES (v_active, 'reg active job', 'pending');
    RAISE NOTICE 'PASS: active tenant CAN create a job';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL: active tenant was blocked -> %', SQLERRM;
  END;

  RAISE NOTICE 'ALL BEHAVIORAL CASES PASSED';
END $$;
ROLLBACK;
