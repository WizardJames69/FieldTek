-- ============================================================
-- Stage 6: AI Diagnostic Learning Loop
-- ============================================================
-- 1. workflow_diagnostic_statistics table (aggregated signals)
-- 2. workflow_repair_effectiveness view (full chain traversal)
-- 3. aggregate_diagnostic_patterns() RPC (compute statistics)
-- 4. Audit log columns for diagnostic tracking
-- 5. Feature flags: diagnostic_learning, diagnostic_probability_ranking
-- ============================================================

-- ── 1. workflow_diagnostic_statistics ────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_diagnostic_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  symptom TEXT NOT NULL,
  failure_component TEXT NOT NULL,
  repair_action TEXT NOT NULL,
  equipment_type TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  success_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, symptom, failure_component, repair_action)
);

CREATE INDEX IF NOT EXISTS idx_wds_tenant
  ON public.workflow_diagnostic_statistics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wds_symptom
  ON public.workflow_diagnostic_statistics(tenant_id, symptom);
CREATE INDEX IF NOT EXISTS idx_wds_equipment
  ON public.workflow_diagnostic_statistics(equipment_type);

ALTER TABLE public.workflow_diagnostic_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view diagnostic statistics"
  ON public.workflow_diagnostic_statistics FOR SELECT
  USING (tenant_id IN (
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
  ));

-- ── 2. workflow_repair_effectiveness view ────────────────────

CREATE OR REPLACE VIEW public.workflow_repair_effectiveness AS
  SELECT
    ws.tenant_id,
    ws.symptom_key,
    ws.symptom_label,
    ws.equipment_type,
    wf.failure_key,
    wf.failure_label,
    wr.repair_key,
    wr.repair_label,
    e_sf.frequency AS symptom_to_failure_freq,
    e_sf.probability AS symptom_to_failure_prob,
    e_fr.frequency AS failure_to_repair_freq,
    e_fr.probability AS failure_to_repair_prob,
    e_ro.frequency AS repair_to_outcome_freq,
    wo.outcome_type,
    wo.outcome_key
  FROM public.workflow_intelligence_edges e_sf
  JOIN public.workflow_symptoms ws
    ON e_sf.source_id = ws.id AND e_sf.source_type = 'symptom'
  JOIN public.workflow_failures wf
    ON e_sf.target_id = wf.id AND e_sf.target_type = 'failure'
  JOIN public.workflow_intelligence_edges e_fr
    ON e_fr.source_id = wf.id AND e_fr.source_type = 'failure'
    AND e_fr.target_type = 'repair' AND e_fr.edge_type = 'repaired_by'
  JOIN public.workflow_repairs wr
    ON e_fr.target_id = wr.id
  LEFT JOIN public.workflow_intelligence_edges e_ro
    ON e_ro.source_id = wr.id AND e_ro.source_type = 'repair'
    AND e_ro.target_type = 'outcome' AND e_ro.edge_type = 'resulted_in'
  LEFT JOIN public.workflow_outcomes wo
    ON e_ro.target_id = wo.id
  WHERE e_sf.edge_type = 'leads_to'
  ORDER BY e_sf.probability DESC, e_fr.probability DESC;

-- ── 3. aggregate_diagnostic_patterns() ──────────────────────

CREATE OR REPLACE FUNCTION public.aggregate_diagnostic_patterns(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  row_count INTEGER := 0;
BEGIN
  INSERT INTO public.workflow_diagnostic_statistics
    (tenant_id, symptom, failure_component, repair_action, equipment_type,
     occurrence_count, success_count, success_rate, confidence_score, last_calculated_at)
  SELECT
    ws.tenant_id,
    ws.symptom_key,
    wf.failure_key,
    wr.repair_key,
    ws.equipment_type,
    SUM(e_sf.frequency),
    COALESCE(SUM(
      CASE WHEN wo.outcome_type = 'resolved' THEN e_ro.frequency ELSE 0 END
    ), 0),
    CASE
      WHEN COALESCE(SUM(e_ro.frequency), 0) > 0
      THEN COALESCE(SUM(
        CASE WHEN wo.outcome_type = 'resolved' THEN e_ro.frequency ELSE 0 END
      ), 0)::float / SUM(e_ro.frequency)
      ELSE 0.0
    END,
    LEAST(1.0 - EXP(-0.1 * SUM(e_sf.frequency)), 0.99),
    now()
  FROM public.workflow_intelligence_edges e_sf
  JOIN public.workflow_symptoms ws
    ON e_sf.source_id = ws.id AND e_sf.source_type = 'symptom'
  JOIN public.workflow_failures wf
    ON e_sf.target_id = wf.id AND e_sf.target_type = 'failure'
  JOIN public.workflow_intelligence_edges e_fr
    ON e_fr.source_id = wf.id AND e_fr.source_type = 'failure'
    AND e_fr.target_type = 'repair' AND e_fr.edge_type = 'repaired_by'
  JOIN public.workflow_repairs wr
    ON e_fr.target_id = wr.id
  LEFT JOIN public.workflow_intelligence_edges e_ro
    ON e_ro.source_id = wr.id AND e_ro.source_type = 'repair'
    AND e_ro.target_type = 'outcome' AND e_ro.edge_type = 'resulted_in'
  LEFT JOIN public.workflow_outcomes wo
    ON e_ro.target_id = wo.id
  WHERE ws.tenant_id = p_tenant_id
    AND e_sf.edge_type = 'leads_to'
  GROUP BY ws.tenant_id, ws.symptom_key, wf.failure_key, wr.repair_key, ws.equipment_type
  ON CONFLICT (tenant_id, symptom, failure_component, repair_action) DO UPDATE SET
    occurrence_count = EXCLUDED.occurrence_count,
    success_count = EXCLUDED.success_count,
    success_rate = EXCLUDED.success_rate,
    confidence_score = EXCLUDED.confidence_score,
    equipment_type = EXCLUDED.equipment_type,
    last_calculated_at = now();

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count;
END;
$$;

-- ── 4. Audit log columns ────────────────────────────────────

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS diagnostic_patterns_used TEXT[],
  ADD COLUMN IF NOT EXISTS diagnostic_signal_strength DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS diagnostic_context_injected BOOLEAN DEFAULT false;

-- ── 5. Feature flags ────────────────────────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES
  ('diagnostic_learning', 'Diagnostic Learning Loop',
   'Enables historical diagnostic pattern lookup and prompt injection for repair probability guidance.',
   false, 0),
  ('diagnostic_probability_ranking', 'Diagnostic Probability Ranking',
   'Enables probability-weighted re-ranking of retrieval results based on diagnostic statistics.',
   false, 0)
ON CONFLICT (key) DO NOTHING;
