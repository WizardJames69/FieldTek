
-- Create voice usage logs table
CREATE TABLE public.voice_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL, -- 'tts', 'scribe', 'conversation'
  character_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  model_id TEXT,
  voice_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read
CREATE POLICY "Deny anonymous access to voice_usage_logs"
  ON public.voice_usage_logs FOR SELECT
  USING (false);

CREATE POLICY "Platform admins can view voice usage"
  ON public.voice_usage_logs FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Service role can insert voice usage"
  ON public.voice_usage_logs FOR INSERT
  WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX idx_voice_usage_tenant_created ON public.voice_usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_voice_usage_function ON public.voice_usage_logs(function_name, created_at DESC);
