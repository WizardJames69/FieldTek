-- ============================================================
-- Phase 8A: Seed Equipment Knowledge Graph
-- ============================================================
-- Industry defaults (tenant_id IS NULL). Tenants can override
-- by inserting their own row with the same component_name.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- HVAC Components
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.equipment_components (tenant_id, equipment_type, component_name, component_category, failure_modes, diagnostic_keywords)
VALUES
  (NULL, 'HVAC', 'Compressor', 'mechanical',
   ARRAY['locked_rotor', 'grounded_winding', 'open_winding', 'overheating', 'low_oil', 'short_cycling'],
   ARRAY['compressor', 'locked', 'grounded', 'megohm', 'amp_draw', 'lra', 'rla', 'not_starting', 'humming']),

  (NULL, 'HVAC', 'Condenser Coil', 'heat_exchange',
   ARRAY['dirty', 'blocked', 'bent_fins', 'refrigerant_leak'],
   ARRAY['condenser', 'coil', 'dirty', 'blocked', 'airflow', 'fins', 'high_head_pressure']),

  (NULL, 'HVAC', 'Evaporator Coil', 'heat_exchange',
   ARRAY['frozen', 'dirty', 'refrigerant_leak', 'low_airflow'],
   ARRAY['evaporator', 'coil', 'frozen', 'icing', 'low_suction', 'superheat']),

  (NULL, 'HVAC', 'TXV', 'refrigerant',
   ARRAY['stuck_open', 'stuck_closed', 'sensing_bulb_lost_charge'],
   ARRAY['txv', 'expansion_valve', 'metering', 'superheat', 'subcooling', 'flooding']),

  (NULL, 'HVAC', 'Reversing Valve', 'refrigerant',
   ARRAY['stuck', 'leaking_internally', 'solenoid_failure'],
   ARRAY['reversing_valve', 'heat_pump', 'stuck', 'not_switching', 'solenoid']),

  (NULL, 'HVAC', 'Run Capacitor', 'electrical',
   ARRAY['weak_capacitance', 'bulging', 'leaking_oil', 'open'],
   ARRAY['capacitor', 'run_capacitor', 'microfarad', 'uf', 'cap_test', 'bulging', 'weak']),

  (NULL, 'HVAC', 'Start Capacitor', 'electrical',
   ARRAY['weak_capacitance', 'open', 'short'],
   ARRAY['start_capacitor', 'capacitor', 'hard_start', 'potential_relay', 'start_assist']),

  (NULL, 'HVAC', 'Contactor', 'electrical',
   ARRAY['pitted_contacts', 'welded_contacts', 'coil_failure', 'chattering'],
   ARRAY['contactor', 'contacts', 'pitted', 'welded', 'chattering', 'not_pulling_in']),

  (NULL, 'HVAC', 'Control Board', 'controls',
   ARRAY['burned_relay', 'bad_transformer', 'error_codes', 'no_output'],
   ARRAY['control_board', 'pcb', 'circuit_board', 'error_code', 'flashing_led', 'no_signal']),

  (NULL, 'HVAC', 'Thermostat', 'controls',
   ARRAY['blank_display', 'not_calling', 'incorrect_reading', 'wiring_issue'],
   ARRAY['thermostat', 'tstat', 'blank', 'not_calling', 'setpoint', 'wiring', 'r_wire', 'y_wire']),

  (NULL, 'HVAC', 'Blower Motor', 'mechanical',
   ARRAY['not_running', 'noisy', 'overheating', 'slow_speed'],
   ARRAY['blower', 'blower_motor', 'indoor_fan', 'ecm', 'psc', 'not_running', 'noisy']),

  (NULL, 'HVAC', 'Condenser Fan Motor', 'mechanical',
   ARRAY['not_running', 'noisy_bearing', 'overheating', 'blade_loose'],
   ARRAY['condenser_fan', 'fan_motor', 'outdoor_fan', 'bearing', 'blade', 'not_spinning']),

  (NULL, 'HVAC', 'Filter Drier', 'refrigerant',
   ARRAY['restricted', 'saturated', 'moisture_contamination'],
   ARRAY['filter_drier', 'drier', 'restriction', 'moisture', 'acid', 'contamination']),

  (NULL, 'HVAC', 'Refrigerant Charge', 'refrigerant',
   ARRAY['undercharged', 'overcharged', 'leak', 'non_condensables'],
   ARRAY['refrigerant', 'charge', 'r410a', 'r22', 'r32', 'leak', 'superheat', 'subcooling', 'pressures']),

  (NULL, 'HVAC', 'Defrost Board', 'controls',
   ARRAY['not_initiating_defrost', 'stuck_in_defrost', 'timer_failure'],
   ARRAY['defrost', 'defrost_board', 'defrost_timer', 'heat_pump', 'ice_buildup'])

ON CONFLICT (tenant_id, equipment_type, component_name) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- Electrical Components
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.equipment_components (tenant_id, equipment_type, component_name, component_category, failure_modes, diagnostic_keywords)
VALUES
  (NULL, 'Electrical', 'Circuit Breaker', 'protection',
   ARRAY['tripping', 'wont_reset', 'overheating', 'internal_failure'],
   ARRAY['breaker', 'circuit_breaker', 'tripping', 'wont_reset', 'overcurrent', 'amperage']),

  (NULL, 'Electrical', 'Transformer', 'power',
   ARRAY['open_winding', 'shorted', 'overheating', 'humming'],
   ARRAY['transformer', 'voltage', 'primary', 'secondary', 'va', 'step_down', 'humming']),

  (NULL, 'Electrical', 'Relay', 'controls',
   ARRAY['stuck_open', 'stuck_closed', 'coil_failure', 'chattering'],
   ARRAY['relay', 'coil', 'contacts', 'normally_open', 'normally_closed', 'chattering']),

  (NULL, 'Electrical', 'Fuse', 'protection',
   ARRAY['blown', 'intermittent', 'wrong_rating'],
   ARRAY['fuse', 'blown', 'amperage', 'continuity', 'fuse_holder']),

  (NULL, 'Electrical', 'Wiring Harness', 'wiring',
   ARRAY['loose_connection', 'burned_wire', 'short_circuit', 'ground_fault'],
   ARRAY['wiring', 'wire', 'connection', 'loose', 'burned', 'short', 'ground_fault', 'harness']),

  (NULL, 'Electrical', 'Voltage Regulator', 'power',
   ARRAY['output_too_high', 'output_too_low', 'no_output', 'oscillating'],
   ARRAY['voltage_regulator', 'voltage', 'regulation', 'output', 'fluctuating']),

  (NULL, 'Electrical', 'Safety Switch', 'protection',
   ARRAY['wont_engage', 'wont_disengage', 'internal_failure'],
   ARRAY['safety_switch', 'disconnect', 'lockout', 'loto', 'emergency_stop']),

  (NULL, 'Electrical', 'GFCI', 'protection',
   ARRAY['tripping', 'wont_reset', 'no_power', 'false_trip'],
   ARRAY['gfci', 'ground_fault', 'tripping', 'wont_reset', 'outlet', 'receptacle'])

ON CONFLICT (tenant_id, equipment_type, component_name) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- Plumbing Components
-- ══════════════════════════════════════════════════════════════

INSERT INTO public.equipment_components (tenant_id, equipment_type, component_name, component_category, failure_modes, diagnostic_keywords)
VALUES
  (NULL, 'Plumbing', 'Condensate Pump', 'drainage',
   ARRAY['not_running', 'overflowing', 'float_stuck', 'motor_failure'],
   ARRAY['condensate_pump', 'pump', 'overflow', 'float', 'not_pumping', 'water_damage']),

  (NULL, 'Plumbing', 'Drain Line', 'drainage',
   ARRAY['clogged', 'algae_growth', 'improper_slope', 'disconnected'],
   ARRAY['drain', 'drain_line', 'clogged', 'algae', 'backed_up', 'overflow', 'wet_switch']),

  (NULL, 'Plumbing', 'P-Trap', 'drainage',
   ARRAY['dry', 'clogged', 'improper_installation'],
   ARRAY['p_trap', 'trap', 'sewer_gas', 'odor', 'dry_trap']),

  (NULL, 'Plumbing', 'Float Switch', 'controls',
   ARRAY['stuck', 'corroded', 'wiring_issue'],
   ARRAY['float_switch', 'float', 'safety_switch', 'overflow_protection']),

  (NULL, 'Plumbing', 'Condensate Pan', 'drainage',
   ARRAY['cracked', 'rusted', 'overflowing', 'improper_slope'],
   ARRAY['condensate_pan', 'drain_pan', 'cracked', 'rusted', 'standing_water']),

  (NULL, 'Plumbing', 'Water Valve', 'plumbing',
   ARRAY['leaking', 'stuck_closed', 'stuck_open', 'corroded'],
   ARRAY['water_valve', 'valve', 'shutoff', 'leaking', 'corroded', 'stuck']),

  (NULL, 'Plumbing', 'Pressure Relief Valve', 'safety',
   ARRAY['leaking', 'stuck_closed', 'wrong_rating', 'not_seating'],
   ARRAY['pressure_relief', 'prv', 'safety_valve', 'leaking', 'pressure', 'pop_off'])

ON CONFLICT (tenant_id, equipment_type, component_name) DO NOTHING;


-- ══════════════════════════════════════════════════════════════
-- Component Relationships
-- ══════════════════════════════════════════════════════════════
-- Uses CTEs to look up component IDs by name + type.
-- Relationships:
--   has_component  — parent contains child
--   connects_to    — systems that interact
--   caused_by      — failure in target can cause failure in source
--   diagnose_with  — use target to diagnose source issues
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- HVAC component IDs
  v_compressor UUID;
  v_condenser_coil UUID;
  v_evaporator_coil UUID;
  v_txv UUID;
  v_reversing_valve UUID;
  v_run_capacitor UUID;
  v_start_capacitor UUID;
  v_contactor UUID;
  v_control_board UUID;
  v_thermostat UUID;
  v_blower_motor UUID;
  v_condenser_fan UUID;
  v_filter_drier UUID;
  v_refrigerant UUID;
  v_defrost_board UUID;
  -- Electrical component IDs
  v_breaker UUID;
  v_transformer UUID;
  v_relay UUID;
  v_fuse UUID;
  v_wiring UUID;
  v_safety_switch UUID;
  -- Plumbing component IDs
  v_condensate_pump UUID;
  v_drain_line UUID;
  v_float_switch UUID;
  v_condensate_pan UUID;
BEGIN
  -- Look up HVAC components
  SELECT id INTO v_compressor FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Compressor';
  SELECT id INTO v_condenser_coil FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Condenser Coil';
  SELECT id INTO v_evaporator_coil FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Evaporator Coil';
  SELECT id INTO v_txv FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'TXV';
  SELECT id INTO v_reversing_valve FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Reversing Valve';
  SELECT id INTO v_run_capacitor FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Run Capacitor';
  SELECT id INTO v_start_capacitor FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Start Capacitor';
  SELECT id INTO v_contactor FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Contactor';
  SELECT id INTO v_control_board FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Control Board';
  SELECT id INTO v_thermostat FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Thermostat';
  SELECT id INTO v_blower_motor FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Blower Motor';
  SELECT id INTO v_condenser_fan FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Condenser Fan Motor';
  SELECT id INTO v_filter_drier FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Filter Drier';
  SELECT id INTO v_refrigerant FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Refrigerant Charge';
  SELECT id INTO v_defrost_board FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'HVAC' AND component_name = 'Defrost Board';

  -- Look up Electrical components
  SELECT id INTO v_breaker FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Electrical' AND component_name = 'Circuit Breaker';
  SELECT id INTO v_transformer FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Electrical' AND component_name = 'Transformer';
  SELECT id INTO v_relay FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Electrical' AND component_name = 'Relay';
  SELECT id INTO v_fuse FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Electrical' AND component_name = 'Fuse';
  SELECT id INTO v_wiring FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Electrical' AND component_name = 'Wiring Harness';
  SELECT id INTO v_safety_switch FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Electrical' AND component_name = 'Safety Switch';

  -- Look up Plumbing components
  SELECT id INTO v_condensate_pump FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Plumbing' AND component_name = 'Condensate Pump';
  SELECT id INTO v_drain_line FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Plumbing' AND component_name = 'Drain Line';
  SELECT id INTO v_float_switch FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Plumbing' AND component_name = 'Float Switch';
  SELECT id INTO v_condensate_pan FROM equipment_components WHERE tenant_id IS NULL AND equipment_type = 'Plumbing' AND component_name = 'Condensate Pan';

  -- ── HVAC Relationships ────────────────────────────────────

  -- Compressor relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_compressor, v_run_capacitor, 'has_component', 0.9),
    (v_compressor, v_start_capacitor, 'has_component', 0.85),
    (v_compressor, v_contactor, 'connects_to', 0.9),
    (v_compressor, v_condenser_coil, 'connects_to', 0.8),
    (v_compressor, v_evaporator_coil, 'connects_to', 0.8),
    (v_compressor, v_refrigerant, 'connects_to', 0.95),
    (v_compressor, v_wiring, 'diagnose_with', 0.6)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Contactor → Compressor (contactor failure causes compressor issues)
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_contactor, v_compressor, 'connects_to', 0.9),
    (v_contactor, v_condenser_fan, 'connects_to', 0.8),
    (v_contactor, v_control_board, 'connects_to', 0.7)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Condenser Coil relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_condenser_coil, v_condenser_fan, 'connects_to', 0.9),
    (v_condenser_coil, v_refrigerant, 'connects_to', 0.85)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Evaporator Coil relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_evaporator_coil, v_txv, 'connects_to', 0.9),
    (v_evaporator_coil, v_blower_motor, 'connects_to', 0.8),
    (v_evaporator_coil, v_refrigerant, 'connects_to', 0.85),
    (v_evaporator_coil, v_filter_drier, 'connects_to', 0.7)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- TXV relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_txv, v_refrigerant, 'connects_to', 0.9),
    (v_txv, v_filter_drier, 'connects_to', 0.8)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Blower Motor relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_blower_motor, v_run_capacitor, 'has_component', 0.85),
    (v_blower_motor, v_control_board, 'connects_to', 0.8)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Condenser Fan Motor relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_condenser_fan, v_run_capacitor, 'has_component', 0.85),
    (v_condenser_fan, v_contactor, 'connects_to', 0.8)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Control Board relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_control_board, v_thermostat, 'connects_to', 0.9),
    (v_control_board, v_transformer, 'connects_to', 0.8),
    (v_control_board, v_contactor, 'connects_to', 0.85),
    (v_control_board, v_defrost_board, 'connects_to', 0.7),
    (v_control_board, v_blower_motor, 'connects_to', 0.8),
    (v_control_board, v_relay, 'has_component', 0.7)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Thermostat relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_thermostat, v_control_board, 'connects_to', 0.9),
    (v_thermostat, v_wiring, 'diagnose_with', 0.6)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Reversing Valve relationships (heat pump)
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_reversing_valve, v_compressor, 'connects_to', 0.9),
    (v_reversing_valve, v_control_board, 'connects_to', 0.7),
    (v_reversing_valve, v_defrost_board, 'connects_to', 0.75)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Refrigerant charge relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_refrigerant, v_filter_drier, 'connects_to', 0.8),
    (v_refrigerant, v_txv, 'connects_to', 0.85)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- Defrost Board relationships
  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_defrost_board, v_reversing_valve, 'connects_to', 0.85),
    (v_defrost_board, v_control_board, 'connects_to', 0.8)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- ── Electrical Relationships ──────────────────────────────

  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_breaker, v_wiring, 'connects_to', 0.9),
    (v_breaker, v_fuse, 'connects_to', 0.7),
    (v_transformer, v_fuse, 'has_component', 0.7),
    (v_transformer, v_wiring, 'connects_to', 0.8),
    (v_relay, v_wiring, 'connects_to', 0.7),
    (v_relay, v_transformer, 'connects_to', 0.6),
    (v_safety_switch, v_breaker, 'connects_to', 0.8),
    (v_safety_switch, v_wiring, 'connects_to', 0.7)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

  -- ── Plumbing Relationships ────────────────────────────────

  INSERT INTO component_relationships (source_id, target_id, relationship, weight) VALUES
    (v_condensate_pump, v_float_switch, 'has_component', 0.9),
    (v_condensate_pump, v_drain_line, 'connects_to', 0.85),
    (v_drain_line, v_condensate_pan, 'connects_to', 0.9),
    (v_condensate_pan, v_float_switch, 'has_component', 0.8),
    (v_condensate_pan, v_drain_line, 'connects_to', 0.9),
    (v_float_switch, v_condensate_pump, 'connects_to', 0.85)
  ON CONFLICT (source_id, target_id, relationship) DO NOTHING;

END $$;
