-- ============================================================
-- Phase 9A: Equipment Graph Relationship Types Expansion
-- ============================================================
-- Adds 'depends_on' and 'failure_mode' to the component
-- relationships CHECK constraint, enabling richer graph
-- traversal and graph-based retrieval scoring.
-- ============================================================

-- Drop existing CHECK constraint and replace with expanded set
ALTER TABLE public.component_relationships
  DROP CONSTRAINT component_relationships_relationship_check;

ALTER TABLE public.component_relationships
  ADD CONSTRAINT component_relationships_relationship_check
  CHECK (relationship IN (
    'has_component',
    'connects_to',
    'caused_by',
    'diagnose_with',
    'depends_on',
    'failure_mode'
  ));
