-- ============================================================
-- Phase 8B: Graph Expansion Audit Columns
-- ============================================================

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS graph_expansion_terms TEXT[],
  ADD COLUMN IF NOT EXISTS graph_expansion_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.ai_audit_logs.graph_expansion_terms
  IS 'Keywords added to the retrieval query by the equipment knowledge graph';
COMMENT ON COLUMN public.ai_audit_logs.graph_expansion_count
  IS 'Number of graph-derived keywords added to the retrieval query';
