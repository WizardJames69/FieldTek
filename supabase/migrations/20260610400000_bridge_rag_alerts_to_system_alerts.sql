-- ============================================================
-- Bridge RAG alert breaches into system_alerts (Phase 1)
-- ============================================================
-- evaluate_rag_alerts() (20260305200000, pg_cron every 5 min) wrote
-- breaches only to system_health_metrics — but the email pipeline
-- (trg_notify_critical_alert → send-health-alert, 20260228400000)
-- fires on INSERTs into system_alerts with severity='critical'. So
-- RAG rules, including the seeded critical "Stuck documents" rule,
-- produced dashboard metrics and no emails (the gap documented in
-- docs/RUNBOOK.md §5).
--
-- Fix: on breach, additionally insert a dedup-guarded row into
-- public.system_alerts, following the 20260610300000 ingestion-
-- alerting pattern (no new row while an unresolved alert of the same
-- alert_type exists from the last hour). Rule severity maps:
--   'critical' → system_alerts 'critical'  (triggers email)
--   anything else → 'medium'               (dashboard triage only)
--
-- Everything else is unchanged from the 20260305200000 body: metric
-- computation, threshold evaluation, the system_health_metrics
-- insert, and the per-rule last_triggered_at cooldown. The function
-- is repo-versioned (sole definition in 20260305200000; no later
-- migration touches it), so CREATE OR REPLACE is safe here.
--
-- Note: dedup is keyed on alert_type ('rag_' || metric). The seeded
-- rules are one-per-metric; if per-tenant rules on the same metric
-- are added later, they will share a dedup window — acceptable for
-- platform alerting.
-- ============================================================

CREATE OR REPLACE FUNCTION public.evaluate_rag_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_metric_value DOUBLE PRECISION;
  v_alert_type TEXT;
  v_alert_severity TEXT;
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

      -- Insert into system_health_metrics for the dashboard pipeline
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

      -- Bridge into system_alerts so critical breaches reach the
      -- existing email trigger. Dedup: skip while an unresolved alert
      -- of the same type from the last hour exists (the per-rule
      -- cooldown above still limits how often a rule can breach).
      v_alert_type := 'rag_' || v_rule.metric;
      v_alert_severity := CASE WHEN v_rule.severity = 'critical' THEN 'critical' ELSE 'medium' END;

      IF NOT EXISTS (
        SELECT 1 FROM public.system_alerts
        WHERE alert_type = v_alert_type
          AND resolved_at IS NULL
          AND created_at > now() - INTERVAL '1 hour'
      ) THEN
        INSERT INTO public.system_alerts (alert_type, severity, message, source, metadata)
        VALUES (
          v_alert_type,
          v_alert_severity,
          'RAG alert rule "' || v_rule.rule_name || '" breached: '
            || v_rule.metric || ' = ' || round(v_metric_value::numeric, 4)
            || ' (' || v_rule.operator || ' threshold ' || v_rule.threshold || ')'
            || ' over the last ' || v_rule.window_minutes || ' minutes.',
          'evaluate_rag_alerts',
          jsonb_build_object(
            'rule_id', v_rule.id,
            'rule_name', v_rule.rule_name,
            'metric', v_rule.metric,
            'operator', v_rule.operator,
            'threshold', v_rule.threshold,
            'actual_value', v_metric_value,
            'window_minutes', v_rule.window_minutes,
            'rule_severity', v_rule.severity,
            'tenant_id', v_rule.tenant_id
          )
        );
      END IF;

      RAISE NOTICE '[evaluate_rag_alerts] TRIGGERED: % (% = %, threshold = %)',
        v_rule.rule_name, v_rule.metric, v_metric_value, v_rule.threshold;
    END IF;
  END LOOP;
END;
$$;

-- Re-assert execution grants (idempotent; matches 20260305200000 —
-- only the postgres-owned cron job may run this).
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM anon;
