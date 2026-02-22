-- ============================================================
-- Phase 3: Additional audit columns for observability
-- ============================================================
-- - refusal_flag: true when response is a canonical refusal or human review redirect
-- - enforcement_rules_triggered: array of rule names that fired during request processing
-- - model_output_hash: SHA-256 of the final response text for determinism verification

ALTER TABLE public.ai_audit_logs
  ADD COLUMN IF NOT EXISTS refusal_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enforcement_rules_triggered TEXT[],
  ADD COLUMN IF NOT EXISTS model_output_hash TEXT;
