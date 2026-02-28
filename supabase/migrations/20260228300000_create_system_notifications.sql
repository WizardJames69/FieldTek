-- ============================================================
-- Create system_notifications table
-- ============================================================
-- system_health_metrics and system_alerts already exist
-- (created in 20260203034440). This migration adds
-- system_notifications for tracking notification delivery
-- (email alerts, future Slack/SMS, etc.).

CREATE TABLE IF NOT EXISTS public.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.system_alerts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'sms', 'webhook')),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_notifications_alert_id
  ON public.system_notifications (alert_id);

CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at
  ON public.system_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_notifications_status
  ON public.system_notifications (status)
  WHERE status = 'failed';

-- Enable RLS
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Platform admins can view notifications
CREATE POLICY "Platform admins can view notifications"
  ON public.system_notifications FOR SELECT
  USING (public.is_platform_admin());

-- Service role can insert/update notifications
CREATE POLICY "Service role full access to system_notifications"
  ON public.system_notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Deny anonymous access
CREATE POLICY "Deny anon access to system_notifications"
  ON public.system_notifications FOR ALL TO anon
  USING (false);
