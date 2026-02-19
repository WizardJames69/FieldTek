/**
 * Industry-Specific AI Assistant Configuration
 * 
 * This file contains all industry-specific configurations for the AI Field Assistant,
 * including symptom detection patterns, diagnostic wizard templates, and safety guidance.
 */

export type IndustryType = 'hvac' | 'plumbing' | 'electrical' | 'mechanical' | 'elevator' | 'home_automation' | 'general';

// ============================================================================
// SYMPTOM DETECTION PATTERNS
// ============================================================================

export interface SymptomCategory {
  keywords: RegExp;
  label: string;
  description: string;
  industry: IndustryType | 'common'; // 'common' means applies to all industries
}

/**
 * Industry-specific symptom detection patterns
 * Used by the AI assistant to identify recurring issues and patterns
 */
export const SYMPTOM_CATEGORIES: Record<string, SymptomCategory> = {
  // =============== HVAC (existing) ===============
  refrigerant: {
    keywords: /\b(leak|leaking|low\s+charge|refrigerant|recharge|charge|r-?410a|r-?22|freon|low\s+on\s+gas)\b/gi,
    label: "Refrigerant/Leak Issues",
    description: "leaks or refrigerant problems",
    industry: 'hvac'
  },
  hvac_electrical: {
    keywords: /\b(electrical|capacitor|contactor|relay|breaker|fuse|short|tripping|no\s+power|voltage|amp|burned|burnt)\b/gi,
    label: "Electrical Issues",
    description: "electrical component problems",
    industry: 'hvac'
  },
  compressor: {
    keywords: /\b(compressor|locked\s+rotor|overload|hard\s+start|grounded|open\s+winding|megohm)\b/gi,
    label: "Compressor Issues",
    description: "compressor failures or problems",
    industry: 'hvac'
  },
  motor: {
    keywords: /\b(motor|fan\s+motor|blower|belt|bearing|seized|noisy|squealing|vibration)\b/gi,
    label: "Motor/Mechanical Issues",
    description: "motor or mechanical failures",
    industry: 'hvac'
  },
  airflow: {
    keywords: /\b(airflow|air\s+flow|dirty\s+filter|clogged|frozen|ice|icing|coil\s+dirty|restricted)\b/gi,
    label: "Airflow Issues",
    description: "airflow restrictions or blockages",
    industry: 'hvac'
  },
  controls: {
    keywords: /\b(thermostat|control\s+board|board|sensor|defrost|timer|sequencer|limit\s+switch)\b/gi,
    label: "Controls/Board Issues",
    description: "control system or board problems",
    industry: 'hvac'
  },
  not_cooling: {
    keywords: /\b(not\s+cooling|no\s+cooling|won'?t\s+cool|warm\s+air|hot\s+air|not\s+cold)\b/gi,
    label: "Not Cooling",
    description: "cooling failure symptoms",
    industry: 'hvac'
  },
  not_heating: {
    keywords: /\b(not\s+heating|no\s+heat|won'?t\s+heat|cold\s+air|not\s+warm|no\s+hot)\b/gi,
    label: "Not Heating",
    description: "heating failure symptoms",
    industry: 'hvac'
  },
  
  // =============== PLUMBING (new) ===============
  water_leak: {
    keywords: /\b(water\s+leak|leaking\s+water|drip|dripping|seeping|puddle|wet\s+spot|moisture)\b/gi,
    label: "Water Leaks",
    description: "water leakage or seepage",
    industry: 'plumbing'
  },
  clog_blockage: {
    keywords: /\b(clog|clogged|blocked|blockage|backup|backed\s+up|slow\s+drain|won'?t\s+drain|standing\s+water)\b/gi,
    label: "Clogs/Blockages",
    description: "drain clogs or pipe blockages",
    industry: 'plumbing'
  },
  water_pressure: {
    keywords: /\b(low\s+pressure|no\s+pressure|weak\s+flow|high\s+pressure|pressure\s+drop|water\s+pressure)\b/gi,
    label: "Water Pressure Issues",
    description: "water pressure problems",
    industry: 'plumbing'
  },
  water_heater: {
    keywords: /\b(water\s+heater|hot\s+water|no\s+hot\s+water|tankless|boiler|pilot\s+light|anode\s+rod|sediment)\b/gi,
    label: "Water Heater Issues",
    description: "water heater problems",
    industry: 'plumbing'
  },
  sewer_drain: {
    keywords: /\b(sewer|septic|main\s+line|sewer\s+smell|sewage|drain\s+line|waste\s+line|cleanout)\b/gi,
    label: "Sewer/Drain Line Issues",
    description: "sewer or main drain problems",
    industry: 'plumbing'
  },
  fixture: {
    keywords: /\b(faucet|toilet|sink|shower|tub|valve|supply\s+line|shutoff|flapper|fill\s+valve)\b/gi,
    label: "Fixture Issues",
    description: "plumbing fixture problems",
    industry: 'plumbing'
  },
  backflow: {
    keywords: /\b(backflow|preventer|rpz|vacuum\s+breaker|cross\s+connection|contamination)\b/gi,
    label: "Backflow/Contamination",
    description: "backflow prevention issues",
    industry: 'plumbing'
  },
  pipe_damage: {
    keywords: /\b(burst|broken\s+pipe|cracked|corroded|corrosion|pipe\s+damage|frozen\s+pipe|pinhole)\b/gi,
    label: "Pipe Damage",
    description: "damaged or deteriorated pipes",
    industry: 'plumbing'
  },

  // =============== ELECTRICAL (new) ===============
  circuit_issue: {
    keywords: /\b(circuit|breaker\s+trip|tripping|overload|short\s+circuit|arc\s+fault|afci|gfci)\b/gi,
    label: "Circuit Issues",
    description: "circuit breaker or protection problems",
    industry: 'electrical'
  },
  grounding: {
    keywords: /\b(ground|grounding|ungrounded|ground\s+fault|bonding|earth|floating\s+neutral)\b/gi,
    label: "Grounding Issues",
    description: "grounding or bonding problems",
    industry: 'electrical'
  },
  voltage_issue: {
    keywords: /\b(voltage|over\s*voltage|under\s*voltage|fluctuation|brownout|surge|spike|low\s+voltage|high\s+voltage)\b/gi,
    label: "Voltage Issues",
    description: "voltage irregularities",
    industry: 'electrical'
  },
  panel_issue: {
    keywords: /\b(panel|breaker\s+box|load\s+center|subpanel|main\s+panel|bus\s+bar|lugs|meter\s+base)\b/gi,
    label: "Panel Issues",
    description: "electrical panel problems",
    industry: 'electrical'
  },
  outlet_switch: {
    keywords: /\b(outlet|receptacle|switch|plug|socket|dimmer|dead\s+outlet|no\s+power|hot\s+outlet)\b/gi,
    label: "Outlet/Switch Issues",
    description: "outlet or switch problems",
    industry: 'electrical'
  },
  wiring: {
    keywords: /\b(wiring|wire|cable|conductor|aluminum\s+wiring|knob\s+and\s+tube|romex|conduit|junction\s+box)\b/gi,
    label: "Wiring Issues",
    description: "wiring or cable problems",
    industry: 'electrical'
  },
  lighting: {
    keywords: /\b(light|lighting|fixture|ballast|led|fluorescent|recessed|can\s+light|chandelier|flickering)\b/gi,
    label: "Lighting Issues",
    description: "lighting problems",
    industry: 'electrical'
  },
  electrical_safety: {
    keywords: /\b(shock|shocking|sparking|arcing|burning\s+smell|hot\s+wire|exposed\s+wire|electrocution)\b/gi,
    label: "Safety Hazards",
    description: "electrical safety concerns",
    industry: 'electrical'
  },

  // =============== MECHANICAL (new) ===============
  vibration: {
    keywords: /\b(vibration|vibrating|shaking|wobble|imbalance|unbalanced|resonance)\b/gi,
    label: "Vibration Issues",
    description: "vibration or balance problems",
    industry: 'mechanical'
  },
  lubrication: {
    keywords: /\b(lubrication|oil|grease|dry\s+bearing|squeaking|grinding|friction|lubricant)\b/gi,
    label: "Lubrication Issues",
    description: "lubrication problems",
    industry: 'mechanical'
  },
  alignment: {
    keywords: /\b(alignment|misaligned|coupling|shaft|runout|laser\s+alignment|angular|parallel)\b/gi,
    label: "Alignment Issues",
    description: "shaft or coupling alignment problems",
    industry: 'mechanical'
  },
  bearing: {
    keywords: /\b(bearing|bearings|ball\s+bearing|roller|race|seal|thrust\s+bearing|journal)\b/gi,
    label: "Bearing Issues",
    description: "bearing failures or wear",
    industry: 'mechanical'
  },
  belt_chain: {
    keywords: /\b(belt|chain|tensioner|pulley|sheave|sprocket|belt\s+slip|belt\s+noise|v-belt)\b/gi,
    label: "Belt/Chain Issues",
    description: "belt or chain drive problems",
    industry: 'mechanical'
  },
  hydraulic: {
    keywords: /\b(hydraulic|hydraulics|cylinder|pump|valve|hose|fitting|pressure|flow|oil\s+leak)\b/gi,
    label: "Hydraulic Issues",
    description: "hydraulic system problems",
    industry: 'mechanical'
  },
  pneumatic: {
    keywords: /\b(pneumatic|air\s+compressor|air\s+cylinder|regulator|air\s+leak|psi|cfm)\b/gi,
    label: "Pneumatic Issues",
    description: "pneumatic system problems",
    industry: 'mechanical'
  },
  wear: {
    keywords: /\b(wear|worn|deteriorat|degraded|fatigue|crack|corrosion|erosion|pitting)\b/gi,
    label: "Wear/Deterioration",
    description: "component wear or damage",
    industry: 'mechanical'
  },

  // =============== ELEVATOR (new) ===============
  leveling: {
    keywords: /\b(leveling|level|misleveled|floor\s+level|car\s+level|re-?level|releveling)\b/gi,
    label: "Leveling Issues",
    description: "car leveling problems",
    industry: 'elevator'
  },
  door_operation: {
    keywords: /\b(door|doors|door\s+operator|door\s+close|door\s+open|nudging|door\s+reversal|photo\s+eye|detector)\b/gi,
    label: "Door Operation Issues",
    description: "door opening/closing problems",
    industry: 'elevator'
  },
  ride_quality: {
    keywords: /\b(ride\s+quality|rough\s+ride|jerky|vibration|shaking|bouncing|noise|roller\s+guide)\b/gi,
    label: "Ride Quality Issues",
    description: "ride comfort problems",
    industry: 'elevator'
  },
  controller_fault: {
    keywords: /\b(controller|fault|error\s+code|board|drive|vfd|inverter|processor|software)\b/gi,
    label: "Controller Faults",
    description: "controller or drive problems",
    industry: 'elevator'
  },
  hydraulic_elevator: {
    keywords: /\b(hydraulic|jack|cylinder|piston|power\s+unit|oil\s+leak|underground|above\s+ground)\b/gi,
    label: "Hydraulic System Issues",
    description: "hydraulic elevator problems",
    industry: 'elevator'
  },
  safety_device: {
    keywords: /\b(safety|governor|overspeed|safeties|buffer|limit\s+switch|final\s+limit|slack\s+rope|pit\s+switch)\b/gi,
    label: "Safety Device Trips",
    description: "safety device activation",
    industry: 'elevator'
  },

  // =============== HOME AUTOMATION (new) ===============
  connectivity: {
    keywords: /\b(connectivity|disconnected|offline|can'?t\s+connect|no\s+connection|wifi|signal|dropped)\b/gi,
    label: "Connectivity Issues",
    description: "device connectivity or network problems",
    industry: 'home_automation'
  },
  device_offline: {
    keywords: /\b(device\s+offline|not\s+responding|unresponsive|won'?t\s+pair|pairing|discovery|unavailable)\b/gi,
    label: "Device Offline",
    description: "device not responding or unavailable",
    industry: 'home_automation'
  },
  integration_failure: {
    keywords: /\b(integration|won'?t\s+work\s+together|incompatible|protocol|zigbee|z-wave|matter|thread)\b/gi,
    label: "Integration Failures",
    description: "device integration or protocol issues",
    industry: 'home_automation'
  },
  latency_lag: {
    keywords: /\b(lag|latency|slow\s+response|delay|delayed|sluggish|buffering)\b/gi,
    label: "Latency/Lag",
    description: "slow response or delay issues",
    industry: 'home_automation'
  },
  programming_error: {
    keywords: /\b(automation|scene|routine|schedule|programming|rule|trigger|won'?t\s+trigger|not\s+running)\b/gi,
    label: "Programming Errors",
    description: "automation or scene programming issues",
    industry: 'home_automation'
  },
  power_supply: {
    keywords: /\b(power\s+supply|battery|low\s+battery|adapter|poe|power\s+over\s+ethernet|transformer)\b/gi,
    label: "Power Supply Issues",
    description: "device power or battery problems",
    industry: 'home_automation'
  },

  // =============== COMMON (applies to all) ===============
  noise: {
    keywords: /\b(noise|noisy|loud|rattling|banging|clicking|buzzing|humming|grinding|squealing)\b/gi,
    label: "Noise Complaints",
    description: "unusual noise symptoms",
    industry: 'common'
  },
  water: {
    keywords: /\b(water\s+leak|leaking\s+water|condensate|drain|overflow|dripping|wet|flooding)\b/gi,
    label: "Water/Condensate Issues",
    description: "water leaks or drainage problems",
    industry: 'common'
  },
  power: {
    keywords: /\b(no\s+power|won'?t\s+start|won'?t\s+turn\s+on|dead|not\s+responding|unresponsive)\b/gi,
    label: "Power/Startup Issues",
    description: "equipment won't start or has no power",
    industry: 'common'
  },
  intermittent: {
    keywords: /\b(intermittent|sometimes|occasionally|random|sporadic|on\s+and\s+off|comes\s+and\s+goes)\b/gi,
    label: "Intermittent Issues",
    description: "intermittent or random problems",
    industry: 'common'
  }
};

// ============================================================================
// INDUSTRY-SPECIFIC SYSTEM PROMPT ADDITIONS
// ============================================================================

export interface IndustryPromptConfig {
  safetyWarnings: string[];
  codeReferences: string[];
  specialConsiderations: string[];
  measurementUnits: Record<string, string>;
}

export const INDUSTRY_PROMPT_CONFIGS: Record<IndustryType, IndustryPromptConfig> = {
  hvac: {
    safetyWarnings: [
      "⚠️ REFRIGERANT HANDLING: EPA Section 608 certification required. Never vent refrigerants to atmosphere.",
      "⚠️ ELECTRICAL SAFETY: Lock out/tag out procedures required before working on electrical components.",
      "⚠️ HIGH PRESSURE: Refrigerant systems operate under high pressure. Use proper safety equipment."
    ],
    codeReferences: [
      "Reference EPA 608 regulations for refrigerant handling",
      "Reference ASHRAE standards for ventilation and air quality",
      "Reference NEC for electrical connections and wiring"
    ],
    specialConsiderations: [
      "Consider seasonal context: cooling season (summer) vs heating season (winter)",
      "Account for humidity levels when diagnosing comfort complaints",
      "Check for proper refrigerant charge using manufacturer specifications only"
    ],
    measurementUnits: {
      pressure: "PSI",
      temperature: "°F",
      voltage: "V",
      current: "A",
      superheat: "°F",
      subcooling: "°F",
      static_pressure: "in. w.c."
    }
  },
  plumbing: {
    safetyWarnings: [
      "⚠️ WATER CONTAMINATION: Ensure potable water protection. Follow cross-connection control requirements.",
      "⚠️ GAS LINES: Licensed gas fitter required for gas water heater connections.",
      "⚠️ SEWER GASES: Proper ventilation required when working on drain/waste/vent systems."
    ],
    codeReferences: [
      "Reference IPC (International Plumbing Code) for installation standards",
      "Reference local plumbing codes which may be more stringent",
      "Reference ASSE standards for backflow prevention devices"
    ],
    specialConsiderations: [
      "Consider water quality and hardness when diagnosing fixture issues",
      "Account for pipe material compatibility (copper, PEX, CPVC, galvanized)",
      "Check for proper venting on drain issues - every fixture needs a vent"
    ],
    measurementUnits: {
      pressure: "PSI",
      flow_rate: "GPM",
      temperature: "°F",
      pipe_size: "inches",
      slope: "inches per foot",
      ph: "pH"
    }
  },
  electrical: {
    safetyWarnings: [
      "🔴 ARC FLASH HAZARD: Proper PPE required. Follow NFPA 70E for arc flash safety.",
      "🔴 LOCK OUT/TAG OUT: De-energize and verify zero energy before working on circuits.",
      "🔴 QUALIFIED PERSONS ONLY: Only licensed electricians should perform electrical work."
    ],
    codeReferences: [
      "Reference NEC (National Electrical Code) for all installations",
      "Reference local amendments which may modify NEC requirements",
      "Reference NFPA 70E for electrical safety in the workplace"
    ],
    specialConsiderations: [
      "Always verify voltage with a tested meter before assuming a circuit is dead",
      "Consider wire ampacity based on conductor size, insulation type, and ambient temperature",
      "Account for voltage drop on long runs - may need to upsize conductors"
    ],
    measurementUnits: {
      voltage: "V",
      current: "A",
      power: "W or kW",
      resistance: "Ω",
      wire_gauge: "AWG",
      conduit_size: "inches"
    }
  },
  mechanical: {
    safetyWarnings: [
      "⚠️ LOCK OUT/TAG OUT: Follow OSHA LOTO procedures before maintenance.",
      "⚠️ ROTATING EQUIPMENT: Keep away from moving parts. No loose clothing.",
      "⚠️ PRESSURE SYSTEMS: Depressurize hydraulic/pneumatic systems before service."
    ],
    codeReferences: [
      "Reference OSHA regulations for machine guarding and safety",
      "Reference manufacturer PM schedules for maintenance intervals",
      "Reference API or ASME standards for pressure vessels and piping"
    ],
    specialConsiderations: [
      "Document baseline vibration readings for comparison",
      "Consider operating temperature when evaluating lubrication",
      "Check for proper coupling alignment after any motor/pump work"
    ],
    measurementUnits: {
      vibration: "in/s or mm/s",
      temperature: "°F",
      pressure: "PSI",
      flow: "GPM",
      rpm: "RPM",
      torque: "ft-lbs"
    }
  },
  elevator: {
    safetyWarnings: [
      "🔴 HOISTWAY SAFETY: Never enter the hoistway or pit without proper lockout/tagout and car secured.",
      "🔴 CAR TOP WORK: Follow ASME A17.1 car top procedures. Use car top inspection operation only.",
      "🔴 ENTRAPMENT: Follow established entrapment rescue procedures. Do not force doors open.",
      "⚠️ LOCK OUT/TAG OUT: De-energize main line disconnect before working on electrical components."
    ],
    codeReferences: [
      "Reference ASME A17.1 Safety Code for Elevators and Escalators",
      "Reference ASME A17.2 Guide for Inspection of Elevators, Escalators, and Moving Walks",
      "Reference local AHJ (Authority Having Jurisdiction) requirements",
      "Reference OSHA standards for elevator maintenance safety"
    ],
    specialConsiderations: [
      "Always verify car is on inspection operation before car top work",
      "Check governor and safety test dates for compliance deadlines",
      "Document all code deficiencies for AHJ reporting",
      "Account for building occupancy when scheduling testing"
    ],
    measurementUnits: {
      speed: "FPM",
      leveling: "inches",
      door_timing: "seconds",
      voltage: "V",
      current: "A",
      temperature: "°F"
    }
  },
  home_automation: {
    safetyWarnings: [
      "⚠️ LOW VOLTAGE WIRING: Follow NEC Article 725 for Class 2 low-voltage wiring requirements.",
      "⚠️ NETWORK SECURITY: Always change default credentials on all devices. Enable firmware auto-updates.",
      "⚠️ LADDER/ATTIC SAFETY: Use proper fall protection when working in attics or on ladders for AP/camera installs.",
      "⚠️ LOAD RATINGS: Verify load ratings before installing motorized shades or automated door hardware."
    ],
    codeReferences: [
      "Reference NEC Article 725 for low-voltage wiring classifications",
      "Reference TIA-568 standards for structured cabling",
      "Reference manufacturer programming guides for device configuration",
      "Follow Wi-Fi Alliance best practices for wireless network design"
    ],
    specialConsiderations: [
      "Document network topology and IP addressing for client handoff",
      "Verify hub/controller firmware is current before adding devices",
      "Test all automations and scenes before client training session",
      "Ensure adequate Wi-Fi coverage with site survey before device placement"
    ],
    measurementUnits: {
      signal_strength: "dBm",
      bandwidth: "Mbps",
      voltage: "V",
      temperature: "°F",
      latency: "ms"
    }
  },
  general: {
    safetyWarnings: [
      "⚠️ SAFETY FIRST: Follow all manufacturer safety guidelines.",
      "⚠️ PROPER PPE: Use appropriate personal protective equipment.",
      "⚠️ QUALIFIED PERSONNEL: Complex repairs may require licensed professionals."
    ],
    codeReferences: [
      "Reference manufacturer documentation for specifications",
      "Follow local building codes and regulations",
      "Adhere to warranty requirements"
    ],
    specialConsiderations: [
      "Document all work performed for future reference",
      "Check warranty status before proceeding with repairs",
      "Consider manufacturer-recommended service intervals"
    ],
    measurementUnits: {
      voltage: "V",
      current: "A",
      temperature: "°F",
      pressure: "PSI"
    }
  }
};

// ============================================================================
// DIAGNOSTIC WIZARD TEMPLATES
// ============================================================================

export interface DiagnosticStep {
  id: string;
  title: string;
  description: string;
  type: "choice" | "measurement" | "observation" | "text";
  options?: { value: string; label: string }[];
  unit?: string;
  placeholder?: string;
  required?: boolean;
}

export interface DiagnosticPath {
  id: string;
  trigger: string[];
  name: string;
  iconName: string; // Icon name as string for serialization
  industry: IndustryType | 'common';
  steps: DiagnosticStep[];
}

export const DIAGNOSTIC_PATHS: DiagnosticPath[] = [
  // =============== HVAC PATHS ===============
  {
    id: "not-cooling",
    trigger: ["not cooling", "no cooling", "warm air", "not cold"],
    name: "Not Cooling Diagnostic",
    iconName: "Thermometer",
    industry: "hvac",
    steps: [
      {
        id: "outdoor-running",
        title: "Outdoor Unit Status",
        description: "Is the outdoor unit (condenser) running?",
        type: "choice",
        options: [
          { value: "running", label: "Yes, running normally" },
          { value: "not-running", label: "No, not running" },
          { value: "cycling", label: "Cycling on/off rapidly" },
          { value: "humming", label: "Humming but not starting" },
        ],
        required: true,
      },
      {
        id: "supply-temp",
        title: "Supply Air Temperature",
        description: "Measure the temperature at the closest supply vent",
        type: "measurement",
        unit: "°F",
        placeholder: "e.g., 65",
        required: true,
      },
      {
        id: "return-temp",
        title: "Return Air Temperature",
        description: "Measure the temperature at the return air grille",
        type: "measurement",
        unit: "°F",
        placeholder: "e.g., 75",
        required: true,
      },
      {
        id: "visual-issues",
        title: "Visual Observations",
        description: "Select any issues you observe",
        type: "choice",
        options: [
          { value: "ice", label: "Ice on refrigerant lines or coil" },
          { value: "dirty-filter", label: "Dirty air filter" },
          { value: "dirty-coil", label: "Dirty condenser coil" },
          { value: "none", label: "No visible issues" },
        ],
        required: false,
      },
      {
        id: "additional-notes",
        title: "Additional Observations",
        description: "Any other symptoms or observations?",
        type: "text",
        placeholder: "Describe any unusual sounds, smells, or behaviors...",
        required: false,
      },
    ],
  },
  {
    id: "hvac-electrical",
    trigger: ["no power", "tripping", "breaker", "electrical", "won't start"],
    name: "Electrical Issue Diagnostic",
    iconName: "Zap",
    industry: "hvac",
    steps: [
      {
        id: "power-status",
        title: "Power Status",
        description: "What is the current power situation?",
        type: "choice",
        options: [
          { value: "no-power", label: "No power to unit at all" },
          { value: "partial", label: "Some components work, others don't" },
          { value: "tripping", label: "Breaker keeps tripping" },
          { value: "intermittent", label: "Power is intermittent" },
        ],
        required: true,
      },
      {
        id: "voltage",
        title: "Supply Voltage",
        description: "Measure voltage at the disconnect (if safe to do so)",
        type: "measurement",
        unit: "V",
        placeholder: "e.g., 240",
        required: false,
      },
      {
        id: "visual-damage",
        title: "Visual Inspection",
        description: "Any visible damage or issues?",
        type: "choice",
        options: [
          { value: "burned", label: "Burned or discolored wires/components" },
          { value: "corrosion", label: "Corrosion on terminals" },
          { value: "loose", label: "Loose connections" },
          { value: "none", label: "No visible damage" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "hvac-noise",
    trigger: ["noise", "loud", "rattling", "banging", "squealing", "grinding"],
    name: "Noise Complaint Diagnostic",
    iconName: "Volume2",
    industry: "hvac",
    steps: [
      {
        id: "noise-type",
        title: "Type of Noise",
        description: "What kind of noise are you hearing?",
        type: "choice",
        options: [
          { value: "rattling", label: "Rattling or vibrating" },
          { value: "squealing", label: "Squealing or screeching" },
          { value: "banging", label: "Banging or clanking" },
          { value: "grinding", label: "Grinding or scraping" },
          { value: "humming", label: "Loud humming or buzzing" },
          { value: "clicking", label: "Clicking or ticking" },
        ],
        required: true,
      },
      {
        id: "noise-location",
        title: "Noise Location",
        description: "Where is the noise coming from?",
        type: "choice",
        options: [
          { value: "outdoor", label: "Outdoor unit" },
          { value: "indoor", label: "Indoor unit / air handler" },
          { value: "ducts", label: "Ductwork" },
          { value: "unsure", label: "Not sure" },
        ],
        required: true,
      },
      {
        id: "noise-timing",
        title: "When does it occur?",
        description: "When do you hear the noise?",
        type: "choice",
        options: [
          { value: "startup", label: "At startup only" },
          { value: "shutdown", label: "At shutdown only" },
          { value: "constant", label: "Constantly while running" },
          { value: "intermittent", label: "Intermittently" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "hvac-pressure",
    trigger: ["pressure", "refrigerant", "charge", "leak"],
    name: "Refrigerant System Diagnostic",
    iconName: "Gauge",
    industry: "hvac",
    steps: [
      {
        id: "suction-pressure",
        title: "Suction Pressure",
        description: "Measure suction (low side) pressure",
        type: "measurement",
        unit: "PSI",
        placeholder: "e.g., 118",
        required: true,
      },
      {
        id: "discharge-pressure",
        title: "Discharge Pressure",
        description: "Measure discharge (high side) pressure",
        type: "measurement",
        unit: "PSI",
        placeholder: "e.g., 350",
        required: true,
      },
      {
        id: "superheat",
        title: "Superheat",
        description: "Calculated superheat value",
        type: "measurement",
        unit: "°F",
        placeholder: "e.g., 12",
        required: false,
      },
      {
        id: "subcooling",
        title: "Subcooling",
        description: "Calculated subcooling value",
        type: "measurement",
        unit: "°F",
        placeholder: "e.g., 10",
        required: false,
      },
      {
        id: "leak-detector",
        title: "Leak Detection",
        description: "Have you used a leak detector?",
        type: "choice",
        options: [
          { value: "leak-found", label: "Yes, leak found" },
          { value: "no-leak", label: "Yes, no leak detected" },
          { value: "not-checked", label: "No, haven't checked yet" },
        ],
        required: true,
      },
    ],
  },

  // =============== PLUMBING PATHS ===============
  {
    id: "plumbing-leak",
    trigger: ["water leak", "leaking", "dripping", "wet spot", "puddle"],
    name: "Water Leak Diagnostic",
    iconName: "Droplet",
    industry: "plumbing",
    steps: [
      {
        id: "leak-location",
        title: "Leak Location",
        description: "Where is the leak occurring?",
        type: "choice",
        options: [
          { value: "under-sink", label: "Under sink" },
          { value: "toilet-base", label: "Around toilet base" },
          { value: "ceiling", label: "Ceiling/overhead" },
          { value: "wall", label: "Inside wall" },
          { value: "water-heater", label: "Near water heater" },
          { value: "outdoor", label: "Outdoor/underground" },
        ],
        required: true,
      },
      {
        id: "leak-severity",
        title: "Leak Severity",
        description: "How severe is the leak?",
        type: "choice",
        options: [
          { value: "drip", label: "Slow drip" },
          { value: "steady", label: "Steady stream" },
          { value: "spray", label: "Spraying water" },
          { value: "flooding", label: "Flooding/major leak" },
        ],
        required: true,
      },
      {
        id: "water-type",
        title: "Water Type",
        description: "What type of water is leaking?",
        type: "choice",
        options: [
          { value: "clean", label: "Clean/clear water" },
          { value: "hot", label: "Hot water" },
          { value: "discolored", label: "Discolored/rusty water" },
          { value: "sewage", label: "Sewage/waste water" },
        ],
        required: true,
      },
      {
        id: "shutoff-status",
        title: "Shutoff Status",
        description: "Has the water been shut off?",
        type: "choice",
        options: [
          { value: "shutoff-yes", label: "Yes, water is shut off" },
          { value: "shutoff-no", label: "No, still running" },
          { value: "no-shutoff", label: "Can't find shutoff" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "plumbing-clog",
    trigger: ["clogged", "slow drain", "blocked", "won't drain", "backup"],
    name: "Drain Clog Diagnostic",
    iconName: "CircleSlash",
    industry: "plumbing",
    steps: [
      {
        id: "clog-fixture",
        title: "Affected Fixture",
        description: "Which fixture is clogged?",
        type: "choice",
        options: [
          { value: "sink-kitchen", label: "Kitchen sink" },
          { value: "sink-bathroom", label: "Bathroom sink" },
          { value: "toilet", label: "Toilet" },
          { value: "shower-tub", label: "Shower/tub" },
          { value: "floor-drain", label: "Floor drain" },
          { value: "multiple", label: "Multiple fixtures" },
        ],
        required: true,
      },
      {
        id: "clog-severity",
        title: "Clog Severity",
        description: "How bad is the clog?",
        type: "choice",
        options: [
          { value: "slow", label: "Draining slowly" },
          { value: "very-slow", label: "Barely draining" },
          { value: "complete", label: "Completely blocked" },
          { value: "backup", label: "Backing up into other fixtures" },
        ],
        required: true,
      },
      {
        id: "clog-attempted",
        title: "Attempts Made",
        description: "What has been tried?",
        type: "choice",
        options: [
          { value: "nothing", label: "Nothing yet" },
          { value: "plunger", label: "Plunger" },
          { value: "chemicals", label: "Drain chemicals" },
          { value: "snake", label: "Drain snake" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "plumbing-no-hot-water",
    trigger: ["no hot water", "cold water only", "water heater", "not heating"],
    name: "No Hot Water Diagnostic",
    iconName: "Flame",
    industry: "plumbing",
    steps: [
      {
        id: "heater-type",
        title: "Water Heater Type",
        description: "What type of water heater?",
        type: "choice",
        options: [
          { value: "gas-tank", label: "Gas tank" },
          { value: "electric-tank", label: "Electric tank" },
          { value: "tankless-gas", label: "Tankless gas" },
          { value: "tankless-electric", label: "Tankless electric" },
          { value: "unknown", label: "Not sure" },
        ],
        required: true,
      },
      {
        id: "hot-water-status",
        title: "Hot Water Status",
        description: "Describe the hot water issue",
        type: "choice",
        options: [
          { value: "none", label: "No hot water at all" },
          { value: "lukewarm", label: "Only lukewarm" },
          { value: "runs-out", label: "Hot water runs out quickly" },
          { value: "intermittent", label: "Sometimes hot, sometimes not" },
        ],
        required: true,
      },
      {
        id: "pilot-status",
        title: "Pilot Light Status (Gas Only)",
        description: "Is the pilot light on? (Skip if electric)",
        type: "choice",
        options: [
          { value: "pilot-on", label: "Pilot is lit" },
          { value: "pilot-off", label: "Pilot is out" },
          { value: "no-pilot", label: "No pilot (electronic ignition)" },
          { value: "electric", label: "N/A - Electric unit" },
        ],
        required: false,
      },
      {
        id: "age",
        title: "Unit Age",
        description: "Approximate age of the water heater",
        type: "choice",
        options: [
          { value: "new", label: "Less than 5 years" },
          { value: "medium", label: "5-10 years" },
          { value: "old", label: "10-15 years" },
          { value: "very-old", label: "Over 15 years" },
          { value: "unknown", label: "Unknown" },
        ],
        required: false,
      },
    ],
  },

  // =============== ELECTRICAL PATHS ===============
  {
    id: "electrical-no-power",
    trigger: ["no power", "dead outlet", "won't work", "power out"],
    name: "No Power Diagnostic",
    iconName: "Power",
    industry: "electrical",
    steps: [
      {
        id: "affected-area",
        title: "Affected Area",
        description: "What has lost power?",
        type: "choice",
        options: [
          { value: "one-outlet", label: "Single outlet" },
          { value: "one-room", label: "One room" },
          { value: "multiple-rooms", label: "Multiple rooms" },
          { value: "whole-house", label: "Entire house" },
          { value: "outdoor", label: "Outdoor only" },
        ],
        required: true,
      },
      {
        id: "breaker-check",
        title: "Breaker Panel Check",
        description: "Have you checked the breaker panel?",
        type: "choice",
        options: [
          { value: "breaker-tripped", label: "Found tripped breaker" },
          { value: "all-on", label: "All breakers are on" },
          { value: "main-off", label: "Main breaker is off" },
          { value: "not-checked", label: "Haven't checked" },
        ],
        required: true,
      },
      {
        id: "gfci-check",
        title: "GFCI Check",
        description: "Have you checked/reset any GFCI outlets?",
        type: "choice",
        options: [
          { value: "gfci-tripped", label: "Found tripped GFCI" },
          { value: "gfci-ok", label: "All GFCIs are OK" },
          { value: "no-gfci", label: "No GFCI outlets found" },
          { value: "not-checked", label: "Haven't checked" },
        ],
        required: true,
      },
      {
        id: "voltage-reading",
        title: "Voltage at Outlet",
        description: "Measure voltage at the dead outlet (if safe)",
        type: "measurement",
        unit: "V",
        placeholder: "e.g., 0 or 120",
        required: false,
      },
    ],
  },
  {
    id: "electrical-tripping",
    trigger: ["breaker tripping", "keeps tripping", "trips", "overload"],
    name: "Breaker Tripping Diagnostic",
    iconName: "AlertTriangle",
    industry: "electrical",
    steps: [
      {
        id: "breaker-type",
        title: "Breaker Type",
        description: "What type of breaker is tripping?",
        type: "choice",
        options: [
          { value: "standard", label: "Standard breaker" },
          { value: "gfci", label: "GFCI breaker" },
          { value: "afci", label: "AFCI breaker" },
          { value: "main", label: "Main breaker" },
          { value: "unknown", label: "Not sure" },
        ],
        required: true,
      },
      {
        id: "trip-frequency",
        title: "Trip Frequency",
        description: "How often does it trip?",
        type: "choice",
        options: [
          { value: "immediate", label: "Trips immediately when reset" },
          { value: "minutes", label: "Trips after a few minutes" },
          { value: "hours", label: "Trips after several hours" },
          { value: "random", label: "Random/unpredictable" },
        ],
        required: true,
      },
      {
        id: "load-identification",
        title: "Connected Loads",
        description: "What's connected to this circuit?",
        type: "text",
        placeholder: "List major appliances or equipment on this circuit...",
        required: false,
      },
      {
        id: "breaker-condition",
        title: "Breaker Condition",
        description: "Inspect the breaker",
        type: "choice",
        options: [
          { value: "normal", label: "Looks normal" },
          { value: "hot", label: "Feels hot to touch" },
          { value: "burned", label: "Shows burn marks/discoloration" },
          { value: "loose", label: "Feels loose in panel" },
        ],
        required: true,
      },
    ],
  },

  // =============== MECHANICAL PATHS ===============
  {
    id: "mechanical-vibration",
    trigger: ["vibration", "shaking", "vibrating", "wobble", "imbalance"],
    name: "Vibration Analysis Diagnostic",
    iconName: "Activity",
    industry: "mechanical",
    steps: [
      {
        id: "vibration-location",
        title: "Vibration Location",
        description: "Where is the vibration coming from?",
        type: "choice",
        options: [
          { value: "motor", label: "Motor" },
          { value: "pump", label: "Pump" },
          { value: "fan", label: "Fan/blower" },
          { value: "coupling", label: "Coupling area" },
          { value: "bearing", label: "Bearing housing" },
          { value: "base", label: "Base/mounting" },
        ],
        required: true,
      },
      {
        id: "vibration-amplitude",
        title: "Vibration Amplitude",
        description: "Measure vibration level if equipment available",
        type: "measurement",
        unit: "in/s",
        placeholder: "e.g., 0.15",
        required: false,
      },
      {
        id: "vibration-frequency",
        title: "Vibration Characteristic",
        description: "Describe the vibration",
        type: "choice",
        options: [
          { value: "constant", label: "Constant/steady" },
          { value: "1x-rpm", label: "Once per revolution" },
          { value: "2x-rpm", label: "Twice per revolution" },
          { value: "random", label: "Random/intermittent" },
          { value: "increasing", label: "Getting worse over time" },
        ],
        required: true,
      },
      {
        id: "recent-changes",
        title: "Recent Changes",
        description: "Any recent work on this equipment?",
        type: "choice",
        options: [
          { value: "none", label: "No recent work" },
          { value: "motor-replaced", label: "Motor replaced" },
          { value: "realigned", label: "Recently aligned" },
          { value: "bearing-replaced", label: "Bearings replaced" },
          { value: "moved", label: "Equipment was moved" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "mechanical-bearing",
    trigger: ["bearing", "grinding", "squealing", "hot bearing", "bearing noise"],
    name: "Bearing Failure Diagnostic",
    iconName: "Circle",
    industry: "mechanical",
    steps: [
      {
        id: "bearing-symptoms",
        title: "Symptoms Observed",
        description: "What symptoms are present?",
        type: "choice",
        options: [
          { value: "noise", label: "Unusual noise" },
          { value: "heat", label: "Excessive heat" },
          { value: "vibration", label: "Increased vibration" },
          { value: "play", label: "Shaft has play/looseness" },
          { value: "multiple", label: "Multiple symptoms" },
        ],
        required: true,
      },
      {
        id: "bearing-temperature",
        title: "Bearing Temperature",
        description: "Measure bearing housing temperature",
        type: "measurement",
        unit: "°F",
        placeholder: "e.g., 150",
        required: false,
      },
      {
        id: "lubrication-status",
        title: "Lubrication Status",
        description: "Check lubrication condition",
        type: "choice",
        options: [
          { value: "adequate", label: "Appears adequate" },
          { value: "low", label: "Low/dry" },
          { value: "contaminated", label: "Contaminated/discolored" },
          { value: "over-greased", label: "Over-greased" },
          { value: "cannot-check", label: "Cannot access" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "mechanical-hydraulic",
    trigger: ["hydraulic", "cylinder", "won't move", "slow movement", "leaking oil"],
    name: "Hydraulic System Diagnostic",
    iconName: "Gauge",
    industry: "mechanical",
    steps: [
      {
        id: "hydraulic-symptom",
        title: "Primary Symptom",
        description: "What is the main issue?",
        type: "choice",
        options: [
          { value: "no-movement", label: "No movement at all" },
          { value: "slow", label: "Slow operation" },
          { value: "weak", label: "Weak force" },
          { value: "jerky", label: "Jerky movement" },
          { value: "oil-leak", label: "Oil leaking" },
          { value: "noise", label: "Pump noise" },
        ],
        required: true,
      },
      {
        id: "oil-level",
        title: "Oil Level",
        description: "Check hydraulic oil level",
        type: "choice",
        options: [
          { value: "full", label: "Full/normal" },
          { value: "low", label: "Low" },
          { value: "very-low", label: "Very low/empty" },
          { value: "overfilled", label: "Overfilled" },
        ],
        required: true,
      },
      {
        id: "system-pressure",
        title: "System Pressure",
        description: "Measure system pressure at pump outlet",
        type: "measurement",
        unit: "PSI",
        placeholder: "e.g., 2500",
        required: false,
      },
      {
        id: "oil-condition",
        title: "Oil Condition",
        description: "Inspect hydraulic oil",
        type: "choice",
        options: [
          { value: "clean", label: "Clean and clear" },
          { value: "dark", label: "Dark/discolored" },
          { value: "milky", label: "Milky (water contamination)" },
          { value: "foamy", label: "Foamy (air in system)" },
        ],
        required: true,
      },
    ],
  },

  // =============== HOME AUTOMATION PATHS ===============
  {
    id: "home-auto-network",
    trigger: ["connectivity", "wifi", "network", "signal", "dropped", "offline"],
    name: "Network Connectivity Diagnostic",
    iconName: "Wifi",
    industry: "home_automation",
    steps: [
      {
        id: "network-symptom",
        title: "Primary Symptom",
        description: "What is the main network issue?",
        type: "choice",
        options: [
          { value: "device-offline", label: "Device(s) going offline" },
          { value: "slow-response", label: "Slow device response" },
          { value: "intermittent", label: "Intermittent connectivity" },
          { value: "no-connection", label: "Cannot connect at all" },
        ],
        required: true,
      },
      {
        id: "signal-strength",
        title: "Wi-Fi Signal Strength",
        description: "Measure signal strength at device location",
        type: "measurement",
        unit: "dBm",
        placeholder: "e.g., -65",
        required: false,
      },
      {
        id: "device-count",
        title: "Devices on Network",
        description: "How many smart devices are connected?",
        type: "choice",
        options: [
          { value: "few", label: "Under 15 devices" },
          { value: "moderate", label: "15-30 devices" },
          { value: "many", label: "30-50 devices" },
          { value: "heavy", label: "Over 50 devices" },
        ],
        required: true,
      },
      {
        id: "network-setup",
        title: "Network Setup",
        description: "What type of network infrastructure?",
        type: "choice",
        options: [
          { value: "consumer-router", label: "Single consumer router" },
          { value: "mesh", label: "Mesh system" },
          { value: "enterprise-ap", label: "Enterprise APs" },
          { value: "unknown", label: "Not sure" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "home-auto-integration",
    trigger: ["integration", "won't work together", "incompatible", "pairing", "protocol"],
    name: "Device Integration Diagnostic",
    iconName: "Link",
    industry: "home_automation",
    steps: [
      {
        id: "integration-type",
        title: "Integration Type",
        description: "What kind of integration issue?",
        type: "choice",
        options: [
          { value: "pairing", label: "Device won't pair to hub" },
          { value: "protocol", label: "Protocol mismatch" },
          { value: "scene", label: "Scene/automation not triggering" },
          { value: "cross-brand", label: "Cross-brand compatibility" },
        ],
        required: true,
      },
      {
        id: "protocol",
        title: "Communication Protocol",
        description: "What protocol does the device use?",
        type: "choice",
        options: [
          { value: "wifi", label: "Wi-Fi" },
          { value: "zigbee", label: "Zigbee" },
          { value: "zwave", label: "Z-Wave" },
          { value: "matter", label: "Matter/Thread" },
          { value: "bluetooth", label: "Bluetooth" },
          { value: "unknown", label: "Not sure" },
        ],
        required: true,
      },
      {
        id: "firmware-version",
        title: "Firmware Status",
        description: "Is the hub/controller firmware up to date?",
        type: "choice",
        options: [
          { value: "current", label: "Up to date" },
          { value: "outdated", label: "Update available" },
          { value: "unknown", label: "Haven't checked" },
        ],
        required: true,
      },
      {
        id: "integration-notes",
        title: "Additional Details",
        description: "Device brands, models, or error messages?",
        type: "text",
        placeholder: "e.g., Lutron Caseta switch won't pair with SmartThings hub...",
        required: false,
      },
    ],
  },

  // =============== ELEVATOR PATHS ===============
  {
    id: "elevator-door",
    trigger: ["door", "doors", "door operator", "won't close", "won't open", "nudging"],
    name: "Door Operation Diagnostic",
    iconName: "DoorOpen",
    industry: "elevator",
    steps: [
      {
        id: "door-symptom",
        title: "Door Symptom",
        description: "What is the door doing?",
        type: "choice",
        options: [
          { value: "wont-close", label: "Won't close fully" },
          { value: "wont-open", label: "Won't open" },
          { value: "reversal", label: "Keeps reversing" },
          { value: "slow", label: "Very slow operation" },
          { value: "banging", label: "Slamming/banging" },
          { value: "nudging", label: "Constant nudging/buzzing" },
        ],
        required: true,
      },
      {
        id: "door-type",
        title: "Door Type",
        description: "What type of door operator?",
        type: "choice",
        options: [
          { value: "center-open", label: "Center opening" },
          { value: "side-open", label: "Side opening (single speed)" },
          { value: "two-speed", label: "Two-speed side opening" },
          { value: "unknown", label: "Not sure" },
        ],
        required: true,
      },
      {
        id: "close-time",
        title: "Door Close Time",
        description: "Measure full close time from fully open",
        type: "measurement",
        unit: "seconds",
        placeholder: "e.g., 4.5",
        required: false,
      },
      {
        id: "detector-check",
        title: "Safety Edge / Photo Eye",
        description: "Are door safety devices working?",
        type: "choice",
        options: [
          { value: "working", label: "Working correctly" },
          { value: "stuck", label: "Stuck/blocked" },
          { value: "intermittent", label: "Intermittent operation" },
          { value: "disabled", label: "Appears disabled" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "elevator-leveling",
    trigger: ["leveling", "misleveled", "floor level", "not level", "trip hazard"],
    name: "Leveling / Ride Quality Diagnostic",
    iconName: "Ruler",
    industry: "elevator",
    steps: [
      {
        id: "leveling-amount",
        title: "Misleveling Distance",
        description: "How far off from floor level?",
        type: "measurement",
        unit: "inches",
        placeholder: "e.g., 1.5",
        required: true,
      },
      {
        id: "leveling-direction",
        title: "Leveling Direction",
        description: "Is the car high or low?",
        type: "choice",
        options: [
          { value: "high", label: "Car stops above floor level" },
          { value: "low", label: "Car stops below floor level" },
          { value: "varies", label: "Varies by floor" },
          { value: "both", label: "Sometimes high, sometimes low" },
        ],
        required: true,
      },
      {
        id: "car-speed",
        title: "Car Speed",
        description: "Measure car speed (if equipment available)",
        type: "measurement",
        unit: "FPM",
        placeholder: "e.g., 200",
        required: false,
      },
      {
        id: "ride-observations",
        title: "Ride Quality Observations",
        description: "Any other ride quality issues?",
        type: "choice",
        options: [
          { value: "smooth", label: "Ride is smooth otherwise" },
          { value: "jerky-start", label: "Jerky start" },
          { value: "rough-stop", label: "Rough stop" },
          { value: "vibration", label: "Vibration during travel" },
          { value: "noise", label: "Unusual noise during travel" },
        ],
        required: false,
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get symptom categories for a specific industry
 */
export function getSymptomCategoriesForIndustry(industry: IndustryType): Record<string, SymptomCategory> {
  const result: Record<string, SymptomCategory> = {};
  
  for (const [key, category] of Object.entries(SYMPTOM_CATEGORIES)) {
    if (category.industry === industry || category.industry === 'common') {
      result[key] = category;
    }
  }
  
  return result;
}

/**
 * Get diagnostic paths for a specific industry
 */
export function getDiagnosticPathsForIndustry(industry: IndustryType): DiagnosticPath[] {
  return DIAGNOSTIC_PATHS.filter(
    path => path.industry === industry || path.industry === 'common'
  );
}

/**
 * Get the prompt configuration for an industry
 */
export function getIndustryPromptConfig(industry: IndustryType): IndustryPromptConfig {
  return INDUSTRY_PROMPT_CONFIGS[industry] || INDUSTRY_PROMPT_CONFIGS.general;
}

/**
 * Build industry-specific safety prompt section
 */
export function buildIndustrySafetyPrompt(industry: IndustryType): string {
  const config = getIndustryPromptConfig(industry);
  
  let prompt = "\n\n## INDUSTRY-SPECIFIC SAFETY REQUIREMENTS:\n";
  
  config.safetyWarnings.forEach(warning => {
    prompt += `${warning}\n`;
  });
  
  prompt += "\n### Code References:\n";
  config.codeReferences.forEach(ref => {
    prompt += `- ${ref}\n`;
  });
  
  prompt += "\n### Special Considerations:\n";
  config.specialConsiderations.forEach(consideration => {
    prompt += `- ${consideration}\n`;
  });
  
  return prompt;
}

/**
 * Find matching diagnostic path for given text
 */
export function findDiagnosticPath(text: string, industry?: IndustryType): DiagnosticPath | null {
  const lowerText = text.toLowerCase();
  const paths = industry ? getDiagnosticPathsForIndustry(industry) : DIAGNOSTIC_PATHS;
  
  return paths.find(path =>
    path.trigger.some(trigger => lowerText.includes(trigger))
  ) || null;
}
