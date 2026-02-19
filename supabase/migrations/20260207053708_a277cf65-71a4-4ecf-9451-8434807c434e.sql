
-- Fix RLS: restrict "service role" INSERT policies to actual service_role
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.ai_audit_logs;
CREATE POLICY "Service role can insert audit logs"
  ON public.ai_audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert alerts" ON public.system_alerts;
CREATE POLICY "Service role can insert alerts"
  ON public.system_alerts FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert health metrics" ON public.system_health_metrics;
CREATE POLICY "Service role can insert health metrics"
  ON public.system_health_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);
