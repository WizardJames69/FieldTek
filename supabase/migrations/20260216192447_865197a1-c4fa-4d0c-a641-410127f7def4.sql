
-- Fix overly permissive INSERT policies on service-role-only tables
-- These currently use WITH CHECK (true) which allows any authenticated user to insert

-- Drop the old permissive policies
DROP POLICY IF EXISTS "Service role can insert health metrics" ON public.system_health_metrics;
DROP POLICY IF EXISTS "Service role can insert voice usage" ON public.voice_usage_logs;
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.system_alerts;

-- Recreate with proper restriction: only allow inserts when the request
-- comes from the service_role key (not the anon key)
CREATE POLICY "Service role can insert health metrics"
ON public.system_health_metrics
FOR INSERT
WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

CREATE POLICY "Service role can insert voice usage"
ON public.voice_usage_logs
FOR INSERT
WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

CREATE POLICY "Service role can insert alerts"
ON public.system_alerts
FOR INSERT
WITH CHECK (
  (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);
