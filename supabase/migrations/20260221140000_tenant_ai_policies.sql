-- ============================================================
-- Phase 4.1: Tenant AI Policies
-- ============================================================
-- Per-tenant configuration for AI assistant behaviour.
-- Allows tenant admins to control:
--   - Whether AI is enabled for their organisation
--   - Maximum monthly request quota
--   - Allowed context types (equipment, jobs, clients, etc.)
--   - Blocked topic keywords that trigger refusal
--   - Whether code-compliance mode is enabled
--   - Custom disclaimer text appended to every AI response
--   - Similarity threshold override for semantic search
--   - Maximum conversation length
--
-- One row per tenant (1:1 with tenants table).
-- Defaults are permissive so existing tenants work unchanged.

CREATE TABLE public.tenant_ai_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Master kill-switch
  ai_enabled              BOOLEAN   NOT NULL DEFAULT true,

  -- Usage limits
  max_monthly_requests    INTEGER            DEFAULT NULL,   -- NULL = unlimited
  max_conversation_turns  INTEGER   NOT NULL DEFAULT 50,

  -- Scope controls
  allowed_context_types   TEXT[]    NOT NULL DEFAULT ARRAY['equipment','jobs','clients','service_history']::TEXT[],
  blocked_topics          TEXT[]    NOT NULL DEFAULT '{}'::TEXT[],

  -- Feature flags
  code_compliance_enabled BOOLEAN   NOT NULL DEFAULT false,
  image_analysis_enabled  BOOLEAN   NOT NULL DEFAULT true,

  -- Response controls
  custom_disclaimer       TEXT               DEFAULT NULL,   -- Appended to every response when set
  similarity_threshold    DOUBLE PRECISION   NOT NULL DEFAULT 0.55,

  -- Metadata
  updated_by              UUID               DEFAULT NULL,   -- user_id of last editor
  created_at              TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ        NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
-- tenant_id already has a UNIQUE index from the constraint

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.tenant_ai_policies ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) can read/write freely
CREATE POLICY "Service role full access to tenant_ai_policies"
  ON public.tenant_ai_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Platform admins can view all policies
CREATE POLICY "Platform admins can view all AI policies"
  ON public.tenant_ai_policies
  FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Tenant admins can view their own policy
CREATE POLICY "Tenant admins can view own AI policy"
  ON public.tenant_ai_policies
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Tenant admins can update their own policy
CREATE POLICY "Tenant admins can update own AI policy"
  ON public.tenant_ai_policies
  FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Only service role can insert (auto-created on tenant creation or first AI call)
-- No authenticated INSERT policy — rows are provisioned server-side.

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_tenant_ai_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenant_ai_policies_updated_at
  BEFORE UPDATE ON public.tenant_ai_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_ai_policies_updated_at();
