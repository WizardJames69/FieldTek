-- Create AI audit log table for tracking all AI interactions
CREATE TABLE public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Request info
  user_message TEXT NOT NULL,
  context_type TEXT,
  context_id UUID,
  equipment_type TEXT,
  
  -- Response info
  ai_response TEXT,
  response_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  
  -- Document context
  documents_available INTEGER DEFAULT 0,
  documents_with_content INTEGER DEFAULT 0,
  document_names TEXT[],
  
  -- Validation details
  validation_patterns_matched TEXT[],
  had_citations BOOLEAN,
  
  -- Metadata
  response_time_ms INTEGER,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Index for efficient querying
CREATE INDEX idx_ai_audit_logs_tenant_id ON public.ai_audit_logs(tenant_id);
CREATE INDEX idx_ai_audit_logs_created_at ON public.ai_audit_logs(created_at DESC);
CREATE INDEX idx_ai_audit_logs_blocked ON public.ai_audit_logs(response_blocked) WHERE response_blocked = true;

-- Enable RLS
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Deny anonymous access to ai_audit_logs"
ON public.ai_audit_logs
FOR SELECT
USING (false);

CREATE POLICY "Platform admins can view all audit logs"
ON public.ai_audit_logs
FOR SELECT
USING (is_platform_admin());

CREATE POLICY "Tenant admins can view their tenant logs"
ON public.ai_audit_logs
FOR SELECT
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin());

-- Allow edge function to insert logs (service role)
CREATE POLICY "Service role can insert audit logs"
ON public.ai_audit_logs
FOR INSERT
WITH CHECK (true);