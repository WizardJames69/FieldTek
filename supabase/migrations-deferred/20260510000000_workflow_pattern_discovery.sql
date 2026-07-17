-- ============================================================
-- Workflow Pattern Discovery — AI-Generated Templates
-- ============================================================
-- Detects common repair patterns from historical intelligence
-- graph data and generates suggested workflow templates for
-- admin review. Reads from workflow_diagnostic_statistics.
--
-- Behind the 'workflow_pattern_discovery' feature flag.
-- ============================================================

-- ── Table 1: Pattern Clusters ─────────────────────────────────

CREATE TABLE public.workflow_pattern_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cluster_key TEXT NOT NULL,
  equipment_type TEXT,
  equipment_model TEXT,
  primary_symptom TEXT NOT NULL,
  failure_components TEXT[] NOT NULL,
  repair_actions TEXT[] NOT NULL,
  chain_count INTEGER NOT NULL DEFAULT 0,
  total_occurrences INTEGER NOT NULL DEFAULT 0,
  avg_success_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  avg_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  cluster_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suggested', 'dismissed')),
  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cluster_key)
);

ALTER TABLE public.workflow_pattern_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view pattern clusters"
  ON public.workflow_pattern_clusters FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_pattern_clusters_tenant_score
  ON public.workflow_pattern_clusters (tenant_id, cluster_score DESC);

CREATE INDEX idx_pattern_clusters_equipment
  ON public.workflow_pattern_clusters (equipment_type)
  WHERE equipment_type IS NOT NULL;

-- ── Table 2: Pattern Suggestions ──────────────────────────────

CREATE TABLE public.workflow_pattern_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cluster_id UUID NOT NULL REFERENCES public.workflow_pattern_clusters(id) ON DELETE CASCADE,
  suggested_name TEXT NOT NULL,
  suggested_description TEXT,
  suggested_category TEXT NOT NULL DEFAULT 'repair'
    CHECK (suggested_category IN ('installation', 'repair', 'maintenance', 'inspection', 'diagnostic')),
  equipment_type TEXT,
  equipment_model TEXT,
  suggested_steps JSONB NOT NULL DEFAULT '[]',
  cluster_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  total_supporting_jobs INTEGER NOT NULL DEFAULT 0,
  avg_success_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'edited', 'converted')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  converted_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cluster_id)
);

ALTER TABLE public.workflow_pattern_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view pattern suggestions"
  ON public.workflow_pattern_suggestions FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage pattern suggestions"
  ON public.workflow_pattern_suggestions FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX idx_pattern_suggestions_tenant_status
  ON public.workflow_pattern_suggestions (tenant_id, review_status);

CREATE INDEX idx_pattern_suggestions_cluster
  ON public.workflow_pattern_suggestions (cluster_id);

-- ── RPC 1: Fetch Clusterable Chains ──────────────────────────

CREATE OR REPLACE FUNCTION public.fetch_clusterable_chains(
  p_tenant_id UUID,
  p_min_occurrences INTEGER DEFAULT 5,
  p_min_confidence DOUBLE PRECISION DEFAULT 0.3
) RETURNS TABLE (
  symptom TEXT,
  failure_component TEXT,
  repair_action TEXT,
  equipment_type TEXT,
  occurrence_count INTEGER,
  success_count INTEGER,
  success_rate DOUBLE PRECISION,
  confidence_score DOUBLE PRECISION,
  last_calculated_at TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  SELECT symptom, failure_component, repair_action, equipment_type,
    occurrence_count, success_count, success_rate, confidence_score, last_calculated_at
  FROM public.workflow_diagnostic_statistics
  WHERE tenant_id = p_tenant_id
    AND occurrence_count >= p_min_occurrences
    AND confidence_score >= p_min_confidence
  ORDER BY equipment_type NULLS LAST, symptom, success_rate DESC;
$$;

-- ── RPC 2: Convert Suggestion to Template ────────────────────

CREATE OR REPLACE FUNCTION public.convert_suggestion_to_template(
  p_suggestion_id UUID,
  p_reviewed_by UUID
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_suggestion RECORD;
  v_template_id UUID;
  v_step JSONB;
  v_step_number INTEGER;
BEGIN
  -- Lock and fetch the suggestion
  SELECT * INTO v_suggestion
  FROM public.workflow_pattern_suggestions
  WHERE id = p_suggestion_id
    AND review_status IN ('approved', 'edited')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or not in approved/edited status';
  END IF;

  -- Create the workflow template
  INSERT INTO public.workflow_templates (
    tenant_id, name, description, category,
    equipment_type, equipment_model,
    source, is_active, is_published, created_by
  ) VALUES (
    v_suggestion.tenant_id,
    v_suggestion.suggested_name,
    v_suggestion.suggested_description,
    v_suggestion.suggested_category,
    v_suggestion.equipment_type,
    v_suggestion.equipment_model,
    'ai_suggested',
    true,
    false,
    p_reviewed_by
  ) RETURNING id INTO v_template_id;

  -- Insert template steps from suggested_steps JSONB
  FOR v_step IN SELECT * FROM jsonb_array_elements(v_suggestion.suggested_steps)
  LOOP
    v_step_number := (v_step->>'step_number')::INTEGER;

    INSERT INTO public.workflow_template_steps (
      workflow_id, step_number, stage_name, title, instruction,
      step_type, evidence_requirements, validation_rules,
      estimated_minutes, safety_warning
    ) VALUES (
      v_template_id,
      v_step_number,
      COALESCE(v_step->>'stage_name', 'Service'),
      COALESCE(v_step->>'title', 'Step ' || v_step_number),
      COALESCE(v_step->>'instruction', ''),
      COALESCE(v_step->>'step_type', 'action'),
      COALESCE(v_step->'evidence_requirements', '{}'::JSONB),
      COALESCE(v_step->'validation_rules', '{}'::JSONB),
      (v_step->>'estimated_minutes')::INTEGER,
      v_step->>'safety_warning'
    );
  END LOOP;

  -- Mark suggestion as converted
  UPDATE public.workflow_pattern_suggestions
  SET review_status = 'converted',
      converted_template_id = v_template_id,
      reviewed_by = p_reviewed_by,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_suggestion_id;

  RETURN v_template_id;
END;
$$;

-- ── Feature Flag ──────────────────────────────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES ('workflow_pattern_discovery', 'AI Workflow Pattern Discovery',
  'Enables batch pattern detection and generates suggested workflow templates from historical repair data.', false, 0)
ON CONFLICT (key) DO NOTHING;
