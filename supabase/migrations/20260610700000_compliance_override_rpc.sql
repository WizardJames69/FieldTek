-- ============================================================
-- Workstream D — Tenant-admin compliance-block override
-- ============================================================
-- Lets a tenant owner/admin override a deterministic compliance
-- block on a job, with a required reason and a durable audit
-- trail. Writes go ONLY through the SECURITY DEFINER RPC below
-- (the direct authenticated UPDATE policy is dropped — see RLS
-- hardening note). field-assistant carries the override forward
-- across re-evaluations so the same rule/stage does not re-block,
-- while unrelated rules/stages still block. Fail-closed.
-- ============================================================

-- ── 1. Audit timestamp column ───────────────────────────────
-- overridden / overridden_by / override_reason already exist on
-- compliance_verdicts (20260326100000). Only the timestamp is new.
ALTER TABLE public.compliance_verdicts
  ADD COLUMN IF NOT EXISTS overridden_at TIMESTAMPTZ;

-- ── 2. RLS hardening ────────────────────────────────────────
-- The original "Tenant admins can override" UPDATE policy authorized
-- with is_tenant_admin() + get_user_tenant_id(), neither of which is
-- correctly tenant-scoped (is_tenant_admin() is true for an owner/admin
-- of ANY tenant; get_user_tenant_id() returns the user's oldest-joined
-- tenant, not the row's). That allowed a direct client UPDATE path that
-- could bypass the RPC's reason/audit checks. We DROP it so authenticated
-- clients have NO direct UPDATE on compliance_verdicts at all — every
-- override must flow through public.override_compliance_block(), which is
-- SECURITY DEFINER and enforces tenant-scoped authorization + a required
-- reason + audit stamping. The "Service role full access" (edge function
-- writes) and "Tenant users view own" (SELECT) policies are unchanged, so
-- the engine can still persist verdicts and the UI can still read them.
DROP POLICY IF EXISTS "Tenant admins can override" ON public.compliance_verdicts;

-- ── 3. Override RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.override_compliance_block(
  p_job_id uuid,
  p_reason text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_count     integer;
  v_blocking  integer;
  v_fail      integer;
  v_warn      integer;
  v_status    text;
BEGIN
  -- Resolve the job's tenant from the row itself (NOT get_user_tenant_id()).
  SELECT tenant_id INTO v_tenant_id
  FROM public.scheduled_jobs
  WHERE id = p_job_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Authorize against the JOB's tenant specifically (tenant-scoped,
  -- multi-tenant safe). Role check first so a non-admin learns nothing
  -- about reason validity.
  IF NOT (
       public.has_tenant_role(auth.uid(), v_tenant_id, 'owner'::public.app_role)
    OR public.has_tenant_role(auth.uid(), v_tenant_id, 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only owners or admins of this tenant may override a compliance block'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Override reason must be at least 10 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Override every currently-active blocking verdict for this job:
  --   verdict = 'block', OR verdict = 'fail' with a blocking/critical rule.
  WITH blocking AS (
    SELECT cv.id
    FROM public.compliance_verdicts cv
    JOIN public.compliance_rules cr ON cr.id = cv.rule_id
    WHERE cv.job_id = p_job_id
      AND cv.tenant_id = v_tenant_id            -- defense in depth
      AND cv.overridden = false
      AND (
        cv.verdict = 'block'
        OR (cv.verdict = 'fail' AND cr.severity IN ('blocking', 'critical'))
      )
  )
  UPDATE public.compliance_verdicts cv
  SET overridden      = true,
      overridden_by   = auth.uid(),
      override_reason = btrim(p_reason),
      overridden_at   = now()
  FROM blocking b
  WHERE cv.id = b.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Recompute compliance_status from REMAINING non-overridden verdicts,
  -- mirroring the field-assistant conventions:
  --   any blocking -> blocked, any fail -> violations,
  --   any warn -> warnings, else compliant.
  SELECT
    count(*) FILTER (
      WHERE cv.verdict = 'block'
         OR (cv.verdict = 'fail' AND cr.severity IN ('blocking', 'critical'))),
    count(*) FILTER (WHERE cv.verdict = 'fail'),
    count(*) FILTER (WHERE cv.verdict = 'warn')
  INTO v_blocking, v_fail, v_warn
  FROM public.compliance_verdicts cv
  JOIN public.compliance_rules cr ON cr.id = cv.rule_id
  WHERE cv.job_id = p_job_id
    AND cv.overridden = false;

  v_status := CASE
                WHEN v_blocking > 0 THEN 'blocked'
                WHEN v_fail     > 0 THEN 'violations'
                WHEN v_warn     > 0 THEN 'warnings'
                ELSE 'compliant'
              END;

  UPDATE public.scheduled_jobs
  SET compliance_status = v_status
  WHERE id = p_job_id;

  RETURN v_count;
END;
$$;

-- Only authenticated users may call it (the function itself enforces the
-- owner/admin check). Strip the default PUBLIC grant first.
REVOKE ALL ON FUNCTION public.override_compliance_block(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.override_compliance_block(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.override_compliance_block(uuid, text) IS
  'Tenant owner/admin override of a job''s deterministic compliance block. '
  'Requires a reason (>=10 chars), authorizes via has_tenant_role against the '
  'job''s tenant, stamps overridden_by/override_reason/overridden_at, recomputes '
  'scheduled_jobs.compliance_status, and returns the number of verdicts overridden. '
  'Idempotent: a second call overrides 0 rows and preserves the original stamps.';
