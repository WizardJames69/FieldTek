-- ============================================================
-- Phase 9B: Graph Scoring Audit Columns
-- ============================================================
-- Adds columns to track whether graph relationship scoring
-- was applied and the maximum graph score achieved.
-- ============================================================

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS graph_scoring_applied BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_graph_score DOUBLE PRECISION;
