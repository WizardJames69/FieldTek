/**
 * Client-side symptom detection utility.
 * Ported from supabase/functions/_shared/symptomVocabulary.ts for inline use
 * in the Sentinel Insight Panel (no server round-trip needed).
 */

const SYMPTOM_KEYWORDS: Record<string, string[]> = {
  // HVAC
  not_cooling: ["not cooling", "no cool", "won't cool", "warm air", "hot air", "no ac"],
  not_heating: ["not heating", "no heat", "won't heat", "cold air", "furnace not working"],
  refrigerant: ["leak", "leaking", "low charge", "refrigerant", "recharge", "freon"],
  hvac_electrical: ["capacitor", "contactor", "relay", "breaker", "fuse", "tripping", "burned"],
  compressor: ["compressor", "locked rotor", "overload", "hard start", "grounded"],
  motor: ["fan motor", "blower", "bearing", "seized", "squealing"],
  airflow: ["dirty filter", "clogged", "frozen", "icing", "coil dirty"],
  controls: ["thermostat", "control board", "sensor", "defrost", "limit switch"],

  // Plumbing
  water_leak: ["water leak", "leaking water", "drip", "dripping", "seeping", "puddle"],
  clog_blockage: ["clog", "clogged", "blocked", "blockage", "backup", "slow drain"],
  water_pressure: ["low pressure", "no pressure", "weak flow", "pressure drop"],
  water_heater: ["water heater", "hot water", "no hot water", "tankless", "pilot light"],
  sewer_drain: ["sewer", "septic", "main line", "sewer smell", "sewage"],

  // Electrical
  circuit_issue: ["circuit", "breaker trip", "tripping", "overload", "short circuit"],
  voltage_issue: ["voltage", "brownout", "surge", "spike", "fluctuation"],
  outlet_switch: ["outlet", "receptacle", "switch", "dead outlet", "dimmer"],

  // Mechanical
  vibration: ["vibration", "vibrating", "shaking", "wobble", "imbalance"],
  lubrication: ["lubrication", "oil", "grease", "dry bearing", "squeaking", "grinding"],
  alignment: ["alignment", "misaligned", "coupling", "shaft"],
  bearing: ["bearing", "bearings", "ball bearing", "roller"],

  // Common (all industries)
  noise: ["noise", "noisy", "loud", "rattling", "banging", "clicking", "buzzing", "humming"],
  power: ["no power", "won't start", "won't turn on", "dead", "not responding", "not starting"],
  intermittent: ["intermittent", "sometimes", "occasionally", "random", "sporadic"],
  odor: ["odor", "smell", "burning smell", "musty"],
  frozen: ["frozen", "ice buildup", "icing", "frost"],
  short_cycling: ["short cycling", "cycles frequently", "turns on and off"],
  high_energy: ["high energy", "high bill", "energy consumption", "inefficient"],
};

const SYMPTOM_LABELS: Record<string, string> = {
  not_cooling: "Not cooling",
  not_heating: "Not heating",
  refrigerant: "Refrigerant issue",
  hvac_electrical: "Electrical fault",
  compressor: "Compressor issue",
  motor: "Motor problem",
  airflow: "Airflow restriction",
  controls: "Controls/sensor issue",
  water_leak: "Water leak",
  clog_blockage: "Clog/blockage",
  water_pressure: "Water pressure issue",
  water_heater: "Water heater issue",
  sewer_drain: "Sewer/drain issue",
  circuit_issue: "Circuit issue",
  voltage_issue: "Voltage issue",
  outlet_switch: "Outlet/switch issue",
  vibration: "Vibration",
  lubrication: "Lubrication needed",
  alignment: "Alignment issue",
  bearing: "Bearing issue",
  noise: "Unusual noise",
  power: "No power",
  intermittent: "Intermittent fault",
  odor: "Unusual odor",
  frozen: "Freezing/ice buildup",
  short_cycling: "Short cycling",
  high_energy: "High energy usage",
};

/**
 * Detect symptom keys from free-text (job description + notes).
 * Returns an array of unique symptom keys found in the text.
 */
export function detectSymptoms(text: string): string[] {
  if (!text || !text.trim()) return [];

  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const [key, phrases] of Object.entries(SYMPTOM_KEYWORDS)) {
    if (phrases.some((phrase) => lower.includes(phrase))) {
      found.push(key);
    }
  }

  return found;
}

/**
 * Convert a symptom key to a human-readable label.
 */
export function getSymptomLabel(key: string): string {
  return SYMPTOM_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
