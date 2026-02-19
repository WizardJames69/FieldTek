-- Create system_health_metrics table for storing health check results
CREATE TABLE public.system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  metric_value numeric,
  status text NOT NULL DEFAULT 'healthy',
  metadata jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient time-based queries
CREATE INDEX idx_health_metrics_recorded_at ON public.system_health_metrics(recorded_at DESC);
CREATE INDEX idx_health_metrics_type ON public.system_health_metrics(metric_type);

-- Enable RLS
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view health metrics
CREATE POLICY "Platform admins can view health metrics"
  ON public.system_health_metrics
  FOR SELECT
  USING (is_platform_admin());

-- Service role can insert metrics (from edge functions)
CREATE POLICY "Service role can insert health metrics"
  ON public.system_health_metrics
  FOR INSERT
  WITH CHECK (true);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to health_metrics"
  ON public.system_health_metrics
  FOR SELECT
  USING (false);

-- Create system_alerts table for storing alerts
CREATE TABLE public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message text NOT NULL,
  source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for alerts
CREATE INDEX idx_system_alerts_created_at ON public.system_alerts(created_at DESC);
CREATE INDEX idx_system_alerts_severity ON public.system_alerts(severity);
CREATE INDEX idx_system_alerts_unresolved ON public.system_alerts(resolved_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all alerts
CREATE POLICY "Platform admins can view alerts"
  ON public.system_alerts
  FOR SELECT
  USING (is_platform_admin());

-- Platform admins can update alerts (acknowledge/resolve)
CREATE POLICY "Platform admins can update alerts"
  ON public.system_alerts
  FOR UPDATE
  USING (is_platform_admin());

-- Service role can insert alerts
CREATE POLICY "Service role can insert alerts"
  ON public.system_alerts
  FOR INSERT
  WITH CHECK (true);

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to alerts"
  ON public.system_alerts
  FOR SELECT
  USING (false);

-- Add cleanup function for old metrics (keep 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_health_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.system_health_metrics 
  WHERE recorded_at < now() - INTERVAL '7 days';
END;
$$;