-- ============================================================
-- Schedule automatic health checks via pg_cron
-- ============================================================
-- Requires pg_cron and pg_net extensions to be enabled in
-- Supabase Dashboard > Database > Extensions first.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Health check every 5 minutes
SELECT cron.schedule(
  'monitor-health-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dlrhobkrjfegtbdsqdsa.supabase.co/functions/v1/monitor-health',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Cleanup old metrics daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-old-health-metrics',
  '0 3 * * *',
  $$ SELECT public.cleanup_old_health_metrics(); $$
);
