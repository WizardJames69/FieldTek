-- ============================================================
-- Phase 2: Compliance Rule Engine
-- ============================================================
-- Creates compliance_rules and compliance_verdicts tables.
-- Rules are evaluated deterministically (no AI) against DB state.
-- tenant_id IS NULL = industry default; tenant-specific rows
-- override defaults by matching rule_key.
-- ============================================================

-- ── compliance_rules ────────────────────────────────────────

CREATE TABLE public.compliance_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_key         TEXT NOT NULL,
  rule_name        TEXT NOT NULL,
  description      TEXT,
  industry         TEXT NOT NULL DEFAULT 'general',
  job_types        TEXT[] DEFAULT '{}',
  workflow_stages  TEXT[] DEFAULT '{}',
  equipment_types  TEXT[] DEFAULT '{}',
  rule_type        TEXT NOT NULL CHECK (rule_type IN ('prerequisite', 'measurement_range', 'safety_gate')),
  condition_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity         TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'blocking', 'critical')),
  code_references  TEXT[],
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, rule_key)
);

CREATE INDEX idx_compliance_rules_industry
  ON public.compliance_rules(industry)
  WHERE is_active;

CREATE INDEX idx_compliance_rules_tenant
  ON public.compliance_rules(tenant_id)
  WHERE is_active;

CREATE INDEX idx_compliance_rules_stages
  ON public.compliance_rules USING gin(workflow_stages);

-- RLS
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON public.compliance_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users see defaults and own tenant rules"
  ON public.compliance_rules FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant admins manage own rules"
  ON public.compliance_rules FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- ── compliance_verdicts ─────────────────────────────────────

CREATE TABLE public.compliance_verdicts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_id           UUID NOT NULL REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  rule_id          UUID NOT NULL REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  stage_name       TEXT NOT NULL,
  verdict          TEXT NOT NULL CHECK (verdict IN ('pass', 'fail', 'warn', 'block')),
  explanation      TEXT,
  evidence_json    JSONB DEFAULT '{}'::jsonb,
  evaluated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  overridden       BOOLEAN NOT NULL DEFAULT false,
  overridden_by    UUID REFERENCES auth.users(id),
  override_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_verdicts_job
  ON public.compliance_verdicts(job_id, stage_name);

CREATE INDEX idx_compliance_verdicts_fails
  ON public.compliance_verdicts(verdict)
  WHERE verdict IN ('fail', 'warn', 'block');

-- RLS
ALTER TABLE public.compliance_verdicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON public.compliance_verdicts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Tenant users view own"
  ON public.compliance_verdicts FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant admins can override"
  ON public.compliance_verdicts FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- ── Feature Flag ────────────────────────────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage, metadata)
VALUES (
  'compliance_engine',
  'Compliance Engine',
  'Deterministic compliance rule evaluation engine for workflow stages',
  false,
  10,
  '{"phase": "compliance_engine", "added": "2026-03-26"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
