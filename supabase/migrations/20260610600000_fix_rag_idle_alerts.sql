-- ============================================================
-- Fix idle false-positive RAG alerts (Phase 1 cleanup)
-- ============================================================
-- Root cause
-- ----------
-- evaluate_rag_alerts() (last defined in 20260610400000) computes the
-- average-based metric avg_rq_score as COALESCE(AVG(retrieval_quality_score), 0).
-- During an idle window with no RAG activity, the underlying query
-- matches zero rows (or zero rows with a non-null retrieval_quality_score),
-- so AVG(...) is NULL and the COALESCE coerces it to 0. The seeded
-- platform rule "Low retrieval quality" is `avg_rq_score lt 40`
-- (20260305200000), so 0 < 40 evaluates TRUE and the rule "breaches"
-- even though nothing was actually measured. That writes a
-- system_health_metrics row and (since 20260610400000) bridges a
-- medium-severity system_alerts row — dashboard noise during quiet
-- windows, with no real degradation behind it.
--
-- avg_rq_score is the only seeded rule with an `lt` operator, so it is
-- the only one that idle-breaches today; the other observation-based
-- rules use `gt` with positive thresholds, where the COALESCE-to-0
-- fallback stays below threshold. This fix hardens all of them anyway
-- so a future `lt`/`lte` rule on any window metric cannot reintroduce
-- the same idle false positive.
--
-- The fix (narrow no-data guard)
-- ------------------------------
-- For every window/observation-based metric, also compute how many rows
-- were actually measured in the window (v_observation_count). When that
-- count is zero, skip the rule entirely — do not breach, do not insert
-- system_health_metrics, do not bridge a system_alerts row, do not queue
-- notifications, do not update last_triggered_at. The COALESCE(...,0)
-- fallbacks are kept so the *value* shape is unchanged for real,
-- evaluated breaches; the guard only changes the no-data outcome.
--
-- Count-based metrics keep evaluating normally. stuck_document_count is
-- a COUNT(*) over public.documents where 0 is a real, healthy
-- measurement (no stuck documents) — its branch leaves
-- v_observation_count NULL so the guard does not apply to it, and the
-- critical "Stuck documents" alert keeps working exactly as before.
--
-- Everything else is preserved verbatim from 20260610400000: the metric
-- value expressions, threshold evaluation, the system_health_metrics
-- insert, the system_alerts bridge + 1-hour dedup, the per-rule
-- cooldown/last_triggered_at gate, the function signature,
-- SECURITY DEFINER, and SET search_path = public. The pg_cron job
-- ('evaluate-rag-alerts', 20260305200000) calls this function by name,
-- so CREATE OR REPLACE picks up the new body with no schedule change.
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
  v_observation_count BIGINT;
  v_alert_type TEXT;
  v_alert_severity TEXT;
BEGIN
  FOR v_rule IN
    SELECT * FROM public.rag_alert_rules
    WHERE is_enabled = true
      AND (last_triggered_at IS NULL
           OR last_triggered_at < now() - (cooldown_minutes || ' minutes')::interval)
  LOOP
    -- Reset the per-iteration observation count. Window/observation-based
    -- metrics set it below; count-based metrics deliberately leave it NULL
    -- so the no-data guard does not apply to them.
    v_observation_count := NULL;

    -- Compute metric value (and, for window metrics, the observation count)
    CASE v_rule.metric
      WHEN 'abstain_rate' THEN
        SELECT
          COUNT(*),
          COALESCE(
            COUNT(*) FILTER (WHERE abstain_flag = true)::float / NULLIF(COUNT(*), 0),
            0
          )
        INTO v_observation_count, v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'validation_failure_rate' THEN
        SELECT
          COUNT(*),
          COALESCE(
            COUNT(*) FILTER (WHERE response_blocked = true)::float / NULLIF(COUNT(*), 0),
            0
          )
        INTO v_observation_count, v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'avg_rq_score' THEN
        -- Observation count is the number of rows carrying an actual
        -- retrieval_quality_score — exactly the inputs AVG() operates on,
        -- so the guard fires precisely when AVG() would have been NULL.
        SELECT
          COUNT(retrieval_quality_score),
          COALESCE(AVG(retrieval_quality_score), 0)
        INTO v_observation_count, v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'stuck_document_count' THEN
        -- Count-based metric: 0 is a real, healthy measurement (no stuck
        -- documents). Leave v_observation_count NULL so the no-data guard
        -- below does NOT apply and this rule keeps evaluating 0 normally.
        SELECT COUNT(*) INTO v_metric_value
        FROM public.documents
        WHERE (extraction_status = 'processing' OR embedding_status = 'processing')
          AND processing_started_at IS NOT NULL
          AND processing_started_at < now() - INTERVAL '15 minutes'
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      WHEN 'p95_response_time_ms' THEN
        SELECT
          COUNT(response_time_ms),
          COALESCE(
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms),
            0
          )
        INTO v_observation_count, v_metric_value
        FROM public.ai_audit_logs
        WHERE created_at > now() - (v_rule.window_minutes || ' minutes')::interval
          AND (v_rule.tenant_id IS NULL OR tenant_id = v_rule.tenant_id);

      ELSE
        CONTINUE;
    END CASE;

    -- ── No-data guard (the fix) ──────────────────────────────────
    -- Window/observation-based metrics set v_observation_count above.
    -- When zero rows were measured in the window, the COALESCE(...,0)
    -- fallback is a placeholder, not a real observation — skip the rule
    -- so idle windows cannot breach (e.g. avg_rq_score < 40 firing on a
    -- quiet hour). Count-based metrics leave v_observation_count NULL and
    -- fall through to evaluate normally.
    IF v_observation_count IS NOT NULL AND v_observation_count = 0 THEN
      CONTINUE;
    END IF;

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

-- Re-assert execution grants (idempotent; matches 20260305200000 /
-- 20260610400000 — only the postgres-owned cron job may run this).
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_rag_alerts() FROM anon;
