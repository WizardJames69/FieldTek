-- ============================================================
-- Phase 2: Seed Industry Default Compliance Rules
-- ============================================================
-- tenant_id IS NULL = industry defaults available to all tenants.
-- Tenants can override by inserting their own row with the same rule_key.
-- ============================================================

INSERT INTO public.compliance_rules (tenant_id, rule_key, rule_name, description, industry, workflow_stages, rule_type, condition_json, severity, code_references)
VALUES
  -- ── HVAC ──────────────────────────────────────────────────
  (NULL, 'hvac.loto_before_energize',
   'LOTO Before Energizing',
   'Lockout/Tagout must be verified before any energizing work',
   'hvac', ARRAY['Startup', 'Service'], 'safety_gate',
   '{"blocks_stage": "Service", "unless_completed": ["safety_lockout_verified", "ppe_confirmed"]}'::jsonb,
   'critical', ARRAY['OSHA 1910.147', 'NFPA 70E 120.5']),

  (NULL, 'hvac.refrigerant_recovery',
   'Refrigerant Recovery Required',
   'EPA Section 608 requires refrigerant recovery before opening sealed systems',
   'hvac', ARRAY['Service', 'Maintenance'], 'prerequisite',
   '{"requires_items": ["refrigerant_recovered"]}'::jsonb,
   'blocking', ARRAY['EPA 608 Section 5']),

  (NULL, 'hvac.pressure_test_range',
   'System Pressure Test',
   'System pressure must be within acceptable operating range',
   'hvac', ARRAY['Service', 'Startup'], 'measurement_range',
   '{"checklist_item_id": "system_pressure", "min": 50, "max": 500, "unit": "PSI"}'::jsonb,
   'warning', NULL),

  -- ── Electrical ────────────────────────────────────────────
  (NULL, 'electrical.loto_verified',
   'Electrical LOTO Verified',
   'Lockout/Tagout must be completed before any electrical work',
   'electrical', ARRAY['Startup', 'Service'], 'safety_gate',
   '{"blocks_stage": "Service", "unless_completed": ["electrical_loto_verified", "zero_energy_confirmed"]}'::jsonb,
   'critical', ARRAY['NFPA 70E', 'OSHA 1910.147']),

  (NULL, 'electrical.voltage_reading',
   'Voltage Reading Check',
   'Voltage reading must be within expected range for the circuit',
   'electrical', ARRAY['Service', 'Inspection'], 'measurement_range',
   '{"checklist_item_id": "voltage_reading", "min": 110, "max": 250, "unit": "V"}'::jsonb,
   'warning', ARRAY['NEC 110.9']),

  (NULL, 'electrical.arc_flash_ppe',
   'Arc Flash PPE Required',
   'Arc flash PPE must be confirmed before working on energized equipment',
   'electrical', ARRAY['Startup', 'Service'], 'prerequisite',
   '{"requires_items": ["arc_flash_ppe_confirmed"]}'::jsonb,
   'blocking', ARRAY['NFPA 70E 130.5']),

  -- ── Plumbing ──────────────────────────────────────────────
  (NULL, 'plumbing.water_shutoff',
   'Water Shutoff Verified',
   'Water supply must be shut off before opening plumbing connections',
   'plumbing', ARRAY['Service', 'Maintenance'], 'prerequisite',
   '{"requires_items": ["water_shutoff_verified"]}'::jsonb,
   'blocking', ARRAY['IPC 312.1']),

  (NULL, 'plumbing.pressure_test',
   'Pressure Test',
   'System pressure test must be within code-required range',
   'plumbing', ARRAY['Service', 'Inspection'], 'measurement_range',
   '{"checklist_item_id": "water_pressure", "min": 40, "max": 80, "unit": "PSI"}'::jsonb,
   'warning', ARRAY['IPC 312.2']),

  -- ── Elevator ──────────────────────────────────────────────
  (NULL, 'elevator.safety_inspection',
   'Safety Inspection Prerequisite',
   'Safety inspection items must be completed before elevator service',
   'elevator', ARRAY['Startup', 'Service'], 'prerequisite',
   '{"requires_items": ["safety_inspection_completed", "pit_inspection_done"]}'::jsonb,
   'critical', ARRAY['ASME A17.1']),

  -- ── General (all industries) ──────────────────────────────
  (NULL, 'general.safety_briefing',
   'Safety Briefing',
   'Safety briefing must be completed before beginning work',
   'general', ARRAY['Startup'], 'prerequisite',
   '{"requires_items": ["safety_briefing_completed"]}'::jsonb,
   'warning', ARRAY['OSHA General Duty Clause']),

  (NULL, 'general.startup_before_service',
   'Startup Before Service',
   'Startup stage must be completed before proceeding to Service',
   'general', ARRAY['Service'], 'safety_gate',
   '{"blocks_stage": "Service", "unless_completed": ["initial_inspection_done"]}'::jsonb,
   'warning', NULL),

  -- ── Mechanical ────────────────────────────────────────────
  (NULL, 'mechanical.vibration_reading',
   'Vibration Reading Check',
   'Vibration reading must be within acceptable range',
   'mechanical', ARRAY['Inspection', 'Maintenance'], 'measurement_range',
   '{"checklist_item_id": "vibration_reading", "min": 0, "max": 7.1, "unit": "mm/s"}'::jsonb,
   'warning', NULL)

ON CONFLICT (tenant_id, rule_key) DO NOTHING;
