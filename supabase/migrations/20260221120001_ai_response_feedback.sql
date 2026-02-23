-- ============================================================
-- User feedback mechanism for AI assistant responses
-- ============================================================
-- Allows users to rate AI responses (positive/negative) with
-- optional category and free-text feedback. Connected to
-- ai_audit_logs via audit_log_id for full traceability.

CREATE TABLE public.ai_response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID REFERENCES public.ai_audit_logs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  feedback_text TEXT,
  feedback_category TEXT CHECK (
    feedback_category IS NULL OR feedback_category IN (
      'incorrect_info', 'missing_citation', 'helpful',
      'outdated', 'irrelevant', 'other'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_response_feedback ENABLE ROW LEVEL SECURITY;

-- Users can submit feedback on their own interactions
CREATE POLICY "Users can insert own feedback"
ON public.ai_response_feedback FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND tenant_id = (
  SELECT tu.tenant_id FROM public.tenant_users tu
  WHERE tu.user_id = auth.uid() AND tu.is_active = true
  LIMIT 1
));

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.ai_response_feedback FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Tenant admins can view all feedback in their tenant
CREATE POLICY "Admins can view tenant feedback"
ON public.ai_response_feedback FOR SELECT TO authenticated
USING (
  tenant_id = (
    SELECT tu.tenant_id FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.is_active = true
    LIMIT 1
  )
  AND (
    SELECT tu.role FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.is_active = true
    LIMIT 1
  ) IN ('owner', 'admin')
);

-- Indexes for common queries
CREATE INDEX idx_ai_feedback_audit_log ON public.ai_response_feedback(audit_log_id);
CREATE INDEX idx_ai_feedback_tenant ON public.ai_response_feedback(tenant_id, created_at DESC);
CREATE INDEX idx_ai_feedback_negative ON public.ai_response_feedback(rating)
  WHERE rating = 'negative';
