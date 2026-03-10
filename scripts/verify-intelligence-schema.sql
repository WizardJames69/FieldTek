-- ============================================================
-- Intelligence Schema Verification
-- ============================================================
-- Verifies that all workflow intelligence tables exist.
-- Run with: psql < scripts/verify-intelligence-schema.sql
-- ============================================================

DO $$
DECLARE
  missing_tables TEXT[] := '{}';
  required_tables TEXT[] := ARRAY[
    'workflow_templates',
    'workflow_template_steps',
    'workflow_executions',
    'workflow_step_executions',
    'workflow_step_outcomes',
    'workflow_step_statistics',
    'workflow_pattern_clusters',
    'workflow_pattern_suggestions',
    'workflow_diagnostic_statistics'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY required_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;

  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Missing intelligence tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE 'All 9 intelligence tables verified successfully.';
    FOREACH tbl IN ARRAY required_tables
    LOOP
      RAISE NOTICE '  OK: %', tbl;
    END LOOP;
  END IF;
END;
$$;
