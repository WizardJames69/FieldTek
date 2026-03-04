-- ============================================================
-- Phase 8A: Equipment Knowledge Graph
-- ============================================================
-- Creates equipment_components and component_relationships
-- tables inside Postgres. Stores industry-default (tenant_id
-- IS NULL) and tenant-specific component data. Used by
-- graph.ts to expand retrieval keywords with domain knowledge.
-- ============================================================

-- ── equipment_components ──────────────────────────────────────

CREATE TABLE public.equipment_components (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  equipment_type       TEXT NOT NULL,
  component_name       TEXT NOT NULL,
  component_category   TEXT NOT NULL,
  failure_modes        TEXT[] DEFAULT '{}',
  diagnostic_keywords  TEXT[] DEFAULT '{}',
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, equipment_type, component_name)
);

-- GIN indexes for array overlap queries (&&)
CREATE INDEX idx_equipment_components_failure_modes
  ON public.equipment_components USING gin(failure_modes)
  WHERE is_active;

CREATE INDEX idx_equipment_components_diagnostic_keywords
  ON public.equipment_components USING gin(diagnostic_keywords)
  WHERE is_active;

-- B-tree index for equipment_type pre-filtering
CREATE INDEX idx_equipment_components_type
  ON public.equipment_components(equipment_type)
  WHERE is_active;

-- RLS
ALTER TABLE public.equipment_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON public.equipment_components FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users see defaults and own tenant components"
  ON public.equipment_components FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant admins manage own components"
  ON public.equipment_components FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin());


-- ── component_relationships ───────────────────────────────────

CREATE TABLE public.component_relationships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID NOT NULL REFERENCES public.equipment_components(id) ON DELETE CASCADE,
  target_id       UUID NOT NULL REFERENCES public.equipment_components(id) ON DELETE CASCADE,
  relationship    TEXT NOT NULL CHECK (relationship IN (
    'has_component', 'connects_to', 'caused_by', 'diagnose_with'
  )),
  weight          DOUBLE PRECISION NOT NULL DEFAULT 1.0
    CHECK (weight >= 0.0 AND weight <= 1.0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, relationship)
);

-- Index for graph traversal (from source, follow relationships)
CREATE INDEX idx_component_relationships_source
  ON public.component_relationships(source_id);

-- RLS
ALTER TABLE public.component_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON public.component_relationships FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view relationships for accessible components"
  ON public.component_relationships FOR SELECT TO authenticated
  USING (
    source_id IN (
      SELECT id FROM public.equipment_components
      WHERE tenant_id IS NULL OR tenant_id = get_user_tenant_id()
    )
  );


-- ── Feature Flag ──────────────────────────────────────────────

INSERT INTO public.feature_flags (key, name, description, is_enabled, rollout_percentage)
VALUES (
  'equipment_graph',
  'Equipment Knowledge Graph',
  'Expands retrieval keywords using equipment component knowledge graph. Adds domain-specific terms based on failure modes and component relationships.',
  false,
  0
)
ON CONFLICT (key) DO NOTHING;
