// ============================================================
// Shared Symptom & Pattern Vocabulary
// ============================================================
// Single source of truth for symptom, failure, and repair
// pattern keys used by:
//   - collect-workflow-intelligence (extraction)
//   - field-assistant (consumption: helpers.ts, diagnosticSignals.ts)
//
// Both systems MUST import from this module to keep keys aligned.
// ============================================================

// ── Industry Types ──────────────────────────────────────────

export type IndustryType =
  | "hvac"
  | "plumbing"
  | "electrical"
  | "mechanical"
  | "elevator"
  | "home_automation"
  | "general"
  | "fire_safety"
  | "refrigeration"
  | "building_automation"
  | "appliance"
  | "industrial_maintenance"
  | "aviation_maintenance";

// ── Symptom Category Definition ─────────────────────────────

export interface SymptomCategory {
  keywords: RegExp;
  label: string;
  description: string;
  industry: IndustryType | "common";
}

// ── UNIFIED SYMPTOM VOCABULARY ──────────────────────────────
// Canonical keys: used for both extraction and consumption.
// The old collect-workflow-intelligence SYMPTOM_PATTERNS (13 keys)
// are subsumed by this expanded vocabulary (42+ keys).
//
// Key naming convention:
//   - snake_case, industry-agnostic where possible
//   - HVAC keys: not_cooling, not_heating (NOT no_cooling, no_heating)

export const SYMPTOM_CATEGORIES: Record<string, SymptomCategory> = {
  // =============== HVAC ===============
  refrigerant: {
    keywords:
      /\b(leak|leaking|low\s+charge|refrigerant|recharge|charge|r-?410a|r-?22|freon|low\s+on\s+gas)\b/gi,
    label: "Refrigerant/Leak Issues",
    description: "leaks or refrigerant problems",
    industry: "hvac",
  },
  hvac_electrical: {
    keywords:
      /\b(electrical|capacitor|contactor|relay|breaker|fuse|short|tripping|no\s+power|voltage|amp|burned|burnt)\b/gi,
    label: "Electrical Issues",
    description: "electrical component problems",
    industry: "hvac",
  },
  compressor: {
    keywords:
      /\b(compressor|locked\s+rotor|overload|hard\s+start|grounded|open\s+winding|megohm)\b/gi,
    label: "Compressor Issues",
    description: "compressor failures or problems",
    industry: "hvac",
  },
  motor: {
    keywords:
      /\b(motor|fan\s+motor|blower|belt|bearing|seized|noisy|squealing|vibration)\b/gi,
    label: "Motor/Mechanical Issues",
    description: "motor or mechanical failures",
    industry: "hvac",
  },
  airflow: {
    keywords:
      /\b(airflow|air\s+flow|dirty\s+filter|clogged|frozen|ice|icing|coil\s+dirty|restricted)\b/gi,
    label: "Airflow Issues",
    description: "airflow restrictions or blockages",
    industry: "hvac",
  },
  controls: {
    keywords:
      /\b(thermostat|control\s+board|board|sensor|defrost|timer|sequencer|limit\s+switch)\b/gi,
    label: "Controls/Board Issues",
    description: "control system or board problems",
    industry: "hvac",
  },
  not_cooling: {
    keywords:
      /\b(not\s+cooling|no\s+cool(ing)?|won'?t\s+cool|warm\s+air|hot\s+air|not\s+cold|no\s+ac|ac\s+not\s+working)\b/gi,
    label: "Not Cooling",
    description: "cooling failure symptoms",
    industry: "hvac",
  },
  not_heating: {
    keywords:
      /\b(not\s+heating|no\s+heat(ing)?|won'?t\s+heat|cold\s+air|not\s+warm|no\s+hot|furnace\s+not\s+working)\b/gi,
    label: "Not Heating",
    description: "heating failure symptoms",
    industry: "hvac",
  },

  // =============== PLUMBING ===============
  water_leak: {
    keywords:
      /\b(water\s+leak|leaking\s+water|drip|dripping|seeping|puddle|wet\s+spot|moisture)\b/gi,
    label: "Water Leaks",
    description: "water leakage or seepage",
    industry: "plumbing",
  },
  clog_blockage: {
    keywords:
      /\b(clog|clogged|blocked|blockage|backup|backed\s+up|slow\s+drain|won'?t\s+drain|standing\s+water)\b/gi,
    label: "Clogs/Blockages",
    description: "drain clogs or pipe blockages",
    industry: "plumbing",
  },
  water_pressure: {
    keywords:
      /\b(low\s+pressure|no\s+pressure|weak\s+flow|high\s+pressure|pressure\s+drop|water\s+pressure)\b/gi,
    label: "Water Pressure Issues",
    description: "water pressure problems",
    industry: "plumbing",
  },
  water_heater: {
    keywords:
      /\b(water\s+heater|hot\s+water|no\s+hot\s+water|tankless|boiler|pilot\s+light|anode\s+rod|sediment)\b/gi,
    label: "Water Heater Issues",
    description: "water heater problems",
    industry: "plumbing",
  },
  sewer_drain: {
    keywords:
      /\b(sewer|septic|main\s+line|sewer\s+smell|sewage|drain\s+line|waste\s+line|cleanout)\b/gi,
    label: "Sewer/Drain Line Issues",
    description: "sewer or main drain problems",
    industry: "plumbing",
  },
  fixture: {
    keywords:
      /\b(faucet|toilet|sink|shower|tub|valve|supply\s+line|shutoff|flapper|fill\s+valve)\b/gi,
    label: "Fixture Issues",
    description: "plumbing fixture problems",
    industry: "plumbing",
  },
  backflow: {
    keywords:
      /\b(backflow|preventer|rpz|vacuum\s+breaker|cross\s+connection|contamination)\b/gi,
    label: "Backflow/Contamination",
    description: "backflow prevention issues",
    industry: "plumbing",
  },
  pipe_damage: {
    keywords:
      /\b(burst|broken\s+pipe|cracked|corroded|corrosion|pipe\s+damage|frozen\s+pipe|pinhole)\b/gi,
    label: "Pipe Damage",
    description: "damaged or deteriorated pipes",
    industry: "plumbing",
  },

  // =============== ELECTRICAL ===============
  circuit_issue: {
    keywords:
      /\b(circuit|breaker\s+trip|tripping|overload|short\s+circuit|arc\s+fault|afci|gfci)\b/gi,
    label: "Circuit Issues",
    description: "circuit breaker or protection problems",
    industry: "electrical",
  },
  grounding: {
    keywords:
      /\b(ground|grounding|ungrounded|ground\s+fault|bonding|earth|floating\s+neutral)\b/gi,
    label: "Grounding Issues",
    description: "grounding or bonding problems",
    industry: "electrical",
  },
  voltage_issue: {
    keywords:
      /\b(voltage|over\s*voltage|under\s*voltage|fluctuation|brownout|surge|spike|low\s+voltage|high\s+voltage)\b/gi,
    label: "Voltage Issues",
    description: "voltage irregularities",
    industry: "electrical",
  },
  panel_issue: {
    keywords:
      /\b(panel|breaker\s+box|load\s+center|subpanel|main\s+panel|bus\s+bar|lugs|meter\s+base)\b/gi,
    label: "Panel Issues",
    description: "electrical panel problems",
    industry: "electrical",
  },
  outlet_switch: {
    keywords:
      /\b(outlet|receptacle|switch|plug|socket|dimmer|dead\s+outlet|no\s+power|hot\s+outlet)\b/gi,
    label: "Outlet/Switch Issues",
    description: "outlet or switch problems",
    industry: "electrical",
  },
  wiring: {
    keywords:
      /\b(wiring|wire|cable|conductor|aluminum\s+wiring|knob\s+and\s+tube|romex|conduit|junction\s+box)\b/gi,
    label: "Wiring Issues",
    description: "wiring or cable problems",
    industry: "electrical",
  },
  lighting: {
    keywords:
      /\b(light|lighting|fixture|ballast|led|fluorescent|recessed|can\s+light|chandelier|flickering)\b/gi,
    label: "Lighting Issues",
    description: "lighting problems",
    industry: "electrical",
  },
  electrical_safety: {
    keywords:
      /\b(shock|shocking|sparking|arcing|burning\s+smell|hot\s+wire|exposed\s+wire|electrocution)\b/gi,
    label: "Safety Hazards",
    description: "electrical safety concerns",
    industry: "electrical",
  },

  // =============== MECHANICAL ===============
  vibration: {
    keywords:
      /\b(vibration|vibrating|shaking|wobble|imbalance|unbalanced|resonance)\b/gi,
    label: "Vibration Issues",
    description: "vibration or balance problems",
    industry: "mechanical",
  },
  lubrication: {
    keywords:
      /\b(lubrication|oil|grease|dry\s+bearing|squeaking|grinding|friction|lubricant)\b/gi,
    label: "Lubrication Issues",
    description: "lubrication problems",
    industry: "mechanical",
  },
  alignment: {
    keywords:
      /\b(alignment|misaligned|coupling|shaft|runout|laser\s+alignment|angular|parallel)\b/gi,
    label: "Alignment Issues",
    description: "shaft or coupling alignment problems",
    industry: "mechanical",
  },
  bearing: {
    keywords:
      /\b(bearing|bearings|ball\s+bearing|roller|race|seal|thrust\s+bearing|journal)\b/gi,
    label: "Bearing Issues",
    description: "bearing failures or wear",
    industry: "mechanical",
  },
  belt_chain: {
    keywords:
      /\b(belt|chain|tensioner|pulley|sheave|sprocket|belt\s+slip|belt\s+noise|v-belt)\b/gi,
    label: "Belt/Chain Issues",
    description: "belt or chain drive problems",
    industry: "mechanical",
  },
  hydraulic: {
    keywords:
      /\b(hydraulic|hydraulics|cylinder|pump|valve|hose|fitting|pressure|flow|oil\s+leak)\b/gi,
    label: "Hydraulic Issues",
    description: "hydraulic system problems",
    industry: "mechanical",
  },
  pneumatic: {
    keywords:
      /\b(pneumatic|air\s+compressor|air\s+cylinder|regulator|air\s+leak|psi|cfm)\b/gi,
    label: "Pneumatic Issues",
    description: "pneumatic system problems",
    industry: "mechanical",
  },
  wear: {
    keywords:
      /\b(wear|worn|deteriorat|degraded|fatigue|crack|corrosion|erosion|pitting)\b/gi,
    label: "Wear/Deterioration",
    description: "component wear or damage",
    industry: "mechanical",
  },

  // =============== FIRE SAFETY ===============
  fire_alarm: {
    keywords:
      /\b(fire\s+alarm|smoke\s+detector|heat\s+detector|pull\s+station|annunciator|trouble\s+signal|supervisory)\b/gi,
    label: "Fire Alarm Issues",
    description: "fire alarm panel or detector problems",
    industry: "fire_safety",
  },
  sprinkler: {
    keywords:
      /\b(sprinkler|sprinkler\s+head|wet\s+system|dry\s+system|pre-?action|deluge|riser|main\s+drain|tamper)\b/gi,
    label: "Sprinkler System Issues",
    description: "fire sprinkler system problems",
    industry: "fire_safety",
  },

  // =============== REFRIGERATION ===============
  temperature_issue: {
    keywords:
      /\b(temperature|temp|too\s+warm|too\s+cold|not\s+cooling|not\s+freezing|thawing|defrost|icing)\b/gi,
    label: "Temperature Issues",
    description: "temperature control problems",
    industry: "refrigeration",
  },
  refrigerant_leak: {
    keywords:
      /\b(refrigerant|leak|low\s+charge|r-?404a|r-?134a|r-?290|glycol|oil\s+spot|bubble\s+test)\b/gi,
    label: "Refrigerant Leaks",
    description: "refrigerant leak or charge issues",
    industry: "refrigeration",
  },

  // =============== BUILDING AUTOMATION ===============
  bas_communication: {
    keywords:
      /\b(bacnet|modbus|lon|communication|network|mstp|ip|polling|offline|controller)\b/gi,
    label: "BAS Communication Issues",
    description: "building automation network problems",
    industry: "building_automation",
  },

  // =============== APPLIANCE ===============
  appliance_issue: {
    keywords:
      /\b(not\s+turning\s+on|won'?t\s+start|error\s+code|not\s+heating|not\s+cooling|not\s+spinning|not\s+draining|leaking)\b/gi,
    label: "Appliance Issues",
    description: "appliance malfunction or failure",
    industry: "appliance",
  },

  // =============== INDUSTRIAL MAINTENANCE ===============
  machine_breakdown: {
    keywords:
      /\b(breakdown|failure|seized|jammed|stuck|overheated|shutdown|alarm|fault\s+code|e-?stop)\b/gi,
    label: "Machine Breakdowns",
    description: "equipment breakdown or failure",
    industry: "industrial_maintenance",
  },

  // =============== AVIATION MAINTENANCE ===============
  aircraft_system: {
    keywords:
      /\b(engine|apu|hydraulic|pneumatic|avionics|fuel\s+system|landing\s+gear|flight\s+control)\b/gi,
    label: "Aircraft System Issues",
    description: "aircraft system malfunction",
    industry: "aviation_maintenance",
  },

  // =============== COMMON (applies to all) ===============
  noise: {
    keywords:
      /\b(noise|noisy|loud|rattling|banging|clicking|buzzing|humming|grinding|squealing)\b/gi,
    label: "Noise Complaints",
    description: "unusual noise symptoms",
    industry: "common",
  },
  water: {
    keywords:
      /\b(water\s+leak|leaking\s+water|condensate|drain|overflow|dripping|wet|flooding)\b/gi,
    label: "Water/Condensate Issues",
    description: "water leaks or drainage problems",
    industry: "common",
  },
  power: {
    keywords:
      /\b(no\s+power|won'?t\s+start|won'?t\s+turn\s+on|dead|not\s+responding|unresponsive)\b/gi,
    label: "Power/Startup Issues",
    description: "equipment won't start or has no power",
    industry: "common",
  },
  intermittent: {
    keywords:
      /\b(intermittent|sometimes|occasionally|random|sporadic|on\s+and\s+off|comes\s+and\s+goes)\b/gi,
    label: "Intermittent Issues",
    description: "intermittent or random problems",
    industry: "common",
  },
};

// ── FAILURE PATTERNS ────────────────────────────────────────
// Used by collect-workflow-intelligence for extraction.
// Canonical keys for the workflow_failures table.

export const FAILURE_PATTERNS: Record<string, RegExp> = {
  capacitor_failure:
    /\b(capacitor\s+fail|bad\s+cap|cap\s+fail|weak\s+cap|blown\s+cap|swollen\s+cap)\b/i,
  compressor_failure:
    /\b(compressor\s+fail|bad\s+compressor|compressor\s+locked|compressor\s+seized)\b/i,
  contactor_failure:
    /\b(contactor\s+fail|bad\s+contactor|pitted\s+contactor|contactor\s+stuck)\b/i,
  refrigerant_leak:
    /\b(refrigerant\s+leak|low\s+charge|low\s+refrigerant|freon\s+leak)\b/i,
  motor_failure:
    /\b(motor\s+fail|bad\s+motor|burned?\s+(out\s+)?motor|motor\s+seized)\b/i,
  board_failure:
    /\b(board\s+fail|bad\s+board|control\s+board|circuit\s+board)\b/i,
  thermostat_failure:
    /\b(thermostat\s+fail|bad\s+thermostat|thermostat\s+malfunction)\b/i,
  coil_damage:
    /\b(coil\s+(damage|leak|corrode|dirty)|damaged?\s+coil|plugged\s+coil)\b/i,
  relay_failure: /\b(relay\s+fail|bad\s+relay|stuck\s+relay)\b/i,
  transformer_failure:
    /\b(transformer\s+fail|bad\s+transformer|burned?\s+transformer)\b/i,
  valve_failure:
    /\b(valve\s+fail|bad\s+valve|stuck\s+valve|txv\s+fail)\b/i,
  ductwork_issue:
    /\b(duct\s+(leak|damage|disconnect)|ductwork\s+issue)\b/i,
  filter_blocked:
    /\b(filter\s+(block|clog|dirty|restrict)|clogged\s+filter)\b/i,
  wiring_fault:
    /\b(wiring\s+fault|loose\s+wire|bad\s+connection|corroded?\s+wire)\b/i,
};

// ── REPAIR PATTERNS ─────────────────────────────────────────
// Used by collect-workflow-intelligence for extraction.
// Canonical keys for the workflow_repairs table.

export const REPAIR_PATTERNS: Record<string, RegExp> = {
  replaced_capacitor:
    /\b(replace[d]?\s+cap|new\s+cap|installed?\s+cap)\b/i,
  replaced_compressor:
    /\b(replace[d]?\s+compressor|new\s+compressor|installed?\s+compressor)\b/i,
  replaced_contactor:
    /\b(replace[d]?\s+contactor|new\s+contactor|installed?\s+contactor)\b/i,
  recharged_refrigerant:
    /\b(recharg|add(ed)?\s+refrigerant|add(ed)?\s+freon|topped?\s+(off|up))\b/i,
  replaced_motor:
    /\b(replace[d]?\s+motor|new\s+motor|installed?\s+motor)\b/i,
  replaced_board:
    /\b(replace[d]?\s+board|new\s+board|installed?\s+board)\b/i,
  replaced_thermostat:
    /\b(replace[d]?\s+thermostat|new\s+thermostat|installed?\s+thermostat)\b/i,
  cleaned_coil:
    /\b(clean(ed)?\s+coil|coil\s+clean|wash(ed)?\s+coil)\b/i,
  repaired_wiring:
    /\b(repair(ed)?\s+wir|fix(ed)?\s+wir|rewire|re-?wire)\b/i,
  replaced_filter:
    /\b(replace[d]?\s+filter|new\s+filter|changed?\s+filter)\b/i,
  sealed_duct:
    /\b(seal(ed)?\s+duct|duct\s+seal|repair(ed)?\s+duct)\b/i,
  replaced_valve:
    /\b(replace[d]?\s+valve|new\s+valve|installed?\s+valve|new\s+txv)\b/i,
  replaced_relay:
    /\b(replace[d]?\s+relay|new\s+relay)\b/i,
};

// ── Extraction Helper ───────────────────────────────────────

export function extractPatternMatches(
  text: string,
  patterns: Record<string, RegExp>,
): string[] {
  const matches: string[] = [];
  for (const [key, regex] of Object.entries(patterns)) {
    if (regex.test(text)) {
      matches.push(key);
    }
  }
  return matches;
}

// ── Symptom Detection (from text) ───────────────────────────
// Returns canonical symptom keys found in the input text.

export function detectSymptomsInText(text: string): string[] {
  const symptoms: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [key, config] of Object.entries(SYMPTOM_CATEGORIES)) {
    if (config.keywords.test(lowerText)) {
      symptoms.push(key);
    }
    config.keywords.lastIndex = 0;
  }

  return symptoms;
}

// ── Format Label ────────────────────────────────────────────

export function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
