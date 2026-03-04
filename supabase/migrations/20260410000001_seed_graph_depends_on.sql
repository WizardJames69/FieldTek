-- ============================================================
-- Phase 9A: Seed depends_on & failure_mode Relationships
-- ============================================================
-- Adds richer relationship types to the equipment knowledge
-- graph, enabling weighted dependency scoring during retrieval.
-- ============================================================

DO $seed$
DECLARE
  v_compressor       UUID;
  v_run_cap          UUID;
  v_start_cap        UUID;
  v_contactor        UUID;
  v_control_board    UUID;
  v_thermostat       UUID;
  v_blower_motor     UUID;
  v_condenser_fan    UUID;
  v_txv              UUID;
  v_evaporator       UUID;
  v_condenser_coil   UUID;
  v_circuit_breaker  UUID;
  v_transformer      UUID;
  v_relay            UUID;
BEGIN
  -- Look up HVAC component IDs
  SELECT id INTO v_compressor     FROM public.equipment_components WHERE component_name = 'Compressor'         AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_run_cap        FROM public.equipment_components WHERE component_name = 'Run Capacitor'      AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_start_cap      FROM public.equipment_components WHERE component_name = 'Start Capacitor'    AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_contactor      FROM public.equipment_components WHERE component_name = 'Contactor'          AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_control_board  FROM public.equipment_components WHERE component_name = 'Control Board'      AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_thermostat     FROM public.equipment_components WHERE component_name = 'Thermostat'         AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_blower_motor   FROM public.equipment_components WHERE component_name = 'Blower Motor'       AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_condenser_fan  FROM public.equipment_components WHERE component_name = 'Condenser Fan Motor' AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_txv            FROM public.equipment_components WHERE component_name = 'TXV'                AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_evaporator     FROM public.equipment_components WHERE component_name = 'Evaporator Coil'    AND equipment_type = 'HVAC' AND tenant_id IS NULL;
  SELECT id INTO v_condenser_coil FROM public.equipment_components WHERE component_name = 'Condenser Coil'     AND equipment_type = 'HVAC' AND tenant_id IS NULL;

  -- Look up Electrical component IDs
  SELECT id INTO v_circuit_breaker FROM public.equipment_components WHERE component_name = 'Circuit Breaker' AND equipment_type = 'Electrical' AND tenant_id IS NULL;
  SELECT id INTO v_transformer     FROM public.equipment_components WHERE component_name = 'Transformer'     AND equipment_type = 'Electrical' AND tenant_id IS NULL;
  SELECT id INTO v_relay           FROM public.equipment_components WHERE component_name = 'Relay'           AND equipment_type = 'Electrical' AND tenant_id IS NULL;

  -- ── HVAC depends_on relationships ──────────────────────────
  -- Compressor depends on electrical components to start
  INSERT INTO public.component_relationships (source_id, target_id, relationship, weight)
  VALUES
    (v_compressor, v_run_cap,       'depends_on', 0.90),
    (v_compressor, v_start_cap,     'depends_on', 0.85),
    (v_compressor, v_contactor,     'depends_on', 0.90),
    (v_compressor, v_control_board, 'depends_on', 0.70),
    (v_blower_motor, v_run_cap,     'depends_on', 0.80),
    (v_blower_motor, v_control_board, 'depends_on', 0.75),
    (v_condenser_fan, v_run_cap,    'depends_on', 0.80),
    (v_condenser_fan, v_contactor,  'depends_on', 0.70),
    (v_thermostat, v_control_board, 'depends_on', 0.65),
    (v_txv, v_evaporator,          'depends_on', 0.75)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- ── failure_mode relationships ─────────────────────────────
  -- Component failures that manifest as symptoms in other components
  INSERT INTO public.component_relationships (source_id, target_id, relationship, weight)
  VALUES
    (v_run_cap,       v_compressor,     'failure_mode', 0.90),
    (v_start_cap,     v_compressor,     'failure_mode', 0.85),
    (v_contactor,     v_compressor,     'failure_mode', 0.85),
    (v_run_cap,       v_blower_motor,   'failure_mode', 0.80),
    (v_run_cap,       v_condenser_fan,  'failure_mode', 0.80),
    (v_control_board, v_thermostat,     'failure_mode', 0.65),
    (v_condenser_coil, v_compressor,    'failure_mode', 0.70),
    (v_circuit_breaker, v_transformer,  'failure_mode', 0.75),
    (v_relay,          v_transformer,   'failure_mode', 0.65)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;
END;
$seed$;
