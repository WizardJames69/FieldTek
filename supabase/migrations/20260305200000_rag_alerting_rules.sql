-- ============================================================
-- Phase 1.3: RAG Alerting Rules
-- ============================================================
-- Configurable alert rules for RAG pipeline health.
-- Evaluated every 5 minutes by pg_cron.
-- Fires into existing system_health_metrics → notify_critical_alert
-- → send-health-alert pipeline.
-- ============================================================


-- ── 1. Alert rules table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rag_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL = platform-wide
  rule_name TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  window_minutes INTEGER NOT NULL DEFAULT 60,
  cooldown_minutes INTEGER NOT NULL DEFAULT 360,
  severity TEXT NOT NULL DEFAULT 'warning',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rag_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to rag_alert_rules"
  ON public.rag_alert_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Platform admins can manage alert rules"
  ON public.rag_alert_rules FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());


-- ── 2. Seed default platform-wide rules ────────────────────────

INSERT INTO public.rag_alert_rules (tenant_id, rule_name, metric, operator, threshold, window_minutes, severity)
VALUES
  (NULL, 'High abstain rate',             'abstain_rate',             'gt', 0.30,  60, 'warning'),
  (NULL, 'High validation failure rate',  'validation_failure_rate',  'gt', 0.15,  60, 'warning'),
  (NULL, 'Low retrieval quality',         'avg_rq_score',             'lt', 40,    60, 'warning'),
  (NULL, 'Stuck documents',               'stuck_document_count',     'gt', 3,     30, 'critical'),
  (NULL, 'High response latency',         'p95_response_time_ms',     'gt', 15000, 30, 'warning')
ON CONFLICT DO NOTHING;


-- ── 3. Alert evaluation function ───────────────────────────────

CREATE OR REPLACE FUNCTION public.evaluate_rag_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_metric_value DOUBLE PRECISION;
BEGIN
  FOR v_rule IN
    SELECT * FROM public.rag_alert_rules
    WHERE is_enabled = true
      AND (last_triggered_at IS NULL
           OR last_triggered_at < now() - (cooldown_minutes || ' minutes')::interval)
  LOOP
    -- Compute metric value
    CASE v_rule.metric
      WHEN 'abstain_rate' THEN
        SELECT COALESCE(
          COUNT(*) FILTER (WHERE abstain_flag = true)::float / NULLIF(COUNT(*), 0),
          0
        ) INTO v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'validation_failure_rate' THEN
        SELECT COALESCE(
          COUNT(*) FILTER (WHERE response_blocked = true)::float / NULLIF(COUNT(*), 0),
          0
        ) INTO v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'avg_rq_score' THEN
        SELECT COALESCE(AVG(retrieval_quality_score), 0) INTO v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'stuck_document_count' THEN
        SELECT COUNT(*) INTO v_metric_value
        FROM public.documents
        WHERE (extraction_status = 'processing' OR embedding_status = 'processing')
          AND processing_started_at IS NOT NULL
          AND processing_started_at < now() - INTERVAL '15 minutes'
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'p95_response_time_ms' THEN
        SELECT COALESCE(
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms),
          0
        ) INTO v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      ELSE
        CONTINUE;
    END CASE;

    -- Evaluate threshold
    IF (v_rule.operator = 'gt'  AND v_metric_value > v_rule.threshold) OR
       (v_rule.operator = 'lt'  AND v_metric_value < v_rule.threshold) OR
       (v_rule.operator = 'gte' AND v_metric_value >= v_rule.threshold) OR
       (v_rule.operator = 'lte' AND v_metric_value <= v_rule.threshold) THEN

      -- Update cooldown
      UPDATE public.rag_alert_rules SET last_triggered_at = now() WHERE id = v_rule.id;

      -- Insert into system_health_metrics for existing alerting pipeline
      INSERT INTO public.system_health_metrics (metric_type, metric_value, status, metadata)
      VALUES (
        'rag_alert',
        v_metric_value,
        CASE WHEN v_rule.severity = 'critical' THEN 'critical' ELSE 'warning' END,
        jsonb_build_object(
          'rule_name', v_rule.rule_name,
          'metric', v_rule.metric,
          'threshold', v_rule.threshold,
          'actual_value', v_metric_value,
          'tenant_id', v_rule.tenant_id
        )
      );

      RAISE NOTICE '[evaluate_rag_alerts] TRIGGERED: % (% = %, threshold = %)',
        v_rule.rule_name, v_rule.metric, v_metric_value, v_rule.threshold;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM anon;


-- ── 4. Schedule alert evaluation every 5 minutes ───────────────

DO $$
BEGIN
  PERFORM cron.unschedule('evaluate-rag-alerts');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron job evaluate-rag-alerts not found, skipping unschedule';
END $$;

SELECT cron.schedule(
  'evaluate-rag-alerts',
  '*/5 * * * *',
  $$ SELECT public.evaluate_rag_alerts(); $$
);
