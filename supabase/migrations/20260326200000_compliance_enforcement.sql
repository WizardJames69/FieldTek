-- ============================================================
-- Phase 3: Compliance Enforcement Configuration
-- ============================================================
-- Adds per-tenant compliance engine controls to tenant_ai_policies.
-- ============================================================

ALTER TABLE public.tenant_ai_policies
  ADD COLUMN IF NOT EXISTS compliance_engine_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_block_on_critical BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- Phase 5: Compliance Audit Columns
-- ============================================================
-- Extends ai_audit_logs with compliance tracking fields.
-- ============================================================

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT,
  ADD COLUMN IF NOT EXISTS compliance_rules_evaluated TEXT[],
  ADD COLUMN IF NOT EXISTS compliance_verdict_ids UUID[],
  ADD COLUMN IF NOT EXISTS workflow_context_injected BOOLEAN DEFAULT false;
