// ============================================================
// Field Assistant — Constants, Patterns & Configuration
// ============================================================

// ── CORS ────────────────────────────────────────────────────

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Input Validation ────────────────────────────────────────

export const MAX_MESSAGES = 50;
export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_CONTEXT_SIZE = 50000;
export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image base64
export const MAX_SERVICE_HISTORY_CONTEXT = 10000; // 10KB limit for service history

// ── Semantic Search ─────────────────────────────────────────

export const SEMANTIC_SEARCH_ENABLED = true;
export const SEMANTIC_SEARCH_TOP_K = 15;
export const SEMANTIC_SEARCH_THRESHOLD = 0.55;
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;

// ── Graph Scoring ───────────────────────────────────────────

export const GRAPH_SCORING_WEIGHT = 0.15; // Weight of graph score in blended formula

// ── Content Limits ──────────────────────────────────────────

export const MAX_TOTAL_CONTENT = 80000;
export const MAX_CONTENT_PER_DOC = 25000;
export const MAX_RESPONSE_CHARS = 20000;
export const MIN_RELEVANT_CHUNKS = 2;
export const ESCALATION_SIMILARITY_THRESHOLD = 0.65;

// ── Rate Limiting ───────────────────────────────────────────

export const TIER_DAILY_LIMITS: Record<string, number> = {
  trial: 10,
  starter: 25,
  growth: 50,
  professional: 200,
  // enterprise: unlimited (no entry = skip check)
};

// ── Response Validation Patterns ────────────────────────────

export const BLOCKED_PATTERNS_WITHOUT_CITATION = [
  /\d+\.?\d*\s*(psi|PSI|kPa|bar)/i,                    // Pressure values
  /\d+\.?\d*\s*(°F|°C|degrees?|fahrenheit|celsius)/i,  // Temperature values
  /\d+\.?\d*\s*(volts?|V|amps?|A|watts?|W|ohms?|Ω)/i,  // Electrical values
  /R-?\d{2,3}[A-Za-z]?/i,                              // Refrigerant types
  /step\s+\d+[:\.]|first[,:]?\s+.*then[,:]?\s+/i,      // Procedural language
  /(typically|usually|normally|generally|in most cases)\s/i, // Generic advice
  /(as a rule|as a general rule|standard practice|it'?s common to)\s/i,
  /(in most scenarios|conventionally|routinely|customarily)\s/i,
  /(more often than not|nine times out of ten|for the most part)\s/i,
  /(industry standard|best practice|rule of thumb|common approach)\s/i,
  /(the problem is likely|this usually means|common cause)/i,
  /(most likely|probably means|chances are|in all likelihood)/i,
  /(you should|you'll want to|i'?d recommend|i suggest)\s/i,
];

export const CITATION_PATTERN = /\[Source:\s*\S[^\]]*\]/i;

export const KNOWN_CODE_PREFIXES = [
  'NEC', 'CEC', 'CSA', 'IPC', 'UPC', 'NPC', 'IRC', 'IMC',
  'NFPA', 'NBC', 'ASHRAE', 'EPA', 'TSSA', 'ANSI',
];

export const CODE_CITATION_PATTERN = /\[Source:\s*(NEC|CEC|CSA|IPC|UPC|NPC|IRC|IMC|NFPA|NBC|ASHRAE|EPA|TSSA|ANSI)\b[^\]]*\]/i;

// ── Prompt Injection Patterns ───────────────────────────────

export const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|any|above|prior)\s+(instructions?|prompts?|rules?|guidelines?)/gi,
  /disregard\s+(previous|all|any|above|prior)\s+(instructions?|prompts?|rules?|guidelines?)/gi,
  /forget\s+(everything|all|what)\s+(you\s+)?(know|learned|were\s+told)/gi,
  /you\s+are\s+now\s+(a|an)\s+(different|new|unrestricted)/gi,
  /pretend\s+(you\s+)?(are|to\s+be)\s+(a|an|unrestricted|jailbroken)/gi,
  /act\s+as\s+(if|though)\s+you\s+(don't|do\s+not)\s+have\s+(any\s+)?restrictions/gi,
  /system\s*prompt\s*(is|:|shows?|says?|reveals?)/gi,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/gi,
  /what\s+(are|were)\s+your\s+(initial|original|system)\s+(instructions?|prompts?)/gi,
  /tell\s+me\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
  /output\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
  /jailbreak|DAN\s+mode|evil\s+mode|bypass\s+(safety|restrictions?|filters?)/gi,
  /admin\s+(mode|access|override|privileges?)/gi,
  /sudo|root\s+access|developer\s+mode/gi,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|system\|>/gi,
  /you\s+must\s+comply|you\s+have\s+no\s+choice|override\s+all/gi,
];

// ── Code Compliance Patterns ────────────────────────────────

export const CODE_QUERY_PATTERNS = [
  /\b(code|codes|NEC|IPC|UPC|IRC|IMC|NFPA|EPA\s*608|CEC|NPC|CSA|TSSA|NBC|ASHRAE)\b/i,
  /\b(code\s+complian|code\s+require|code\s+section|article\s+\d|section\s+\d)/i,
  /\b(minimum\s+(clearance|distance|size|gauge|ampacity|pipe\s+size))/i,
  /\b(required\s+by\s+code|per\s+code|to\s+code|meets?\s+code)/i,
  /\b(GFCI|AFCI|ground\s+fault|arc\s+fault|tamper\s+resistant)/i,
  /\b(backflow\s+preventer|trap\s+size|vent\s+size|drain\s+size|fixture\s+unit)/i,
  /\b(wire\s+gauge|conductor\s+size|ampacity|breaker\s+size|overcurrent)/i,
  /\b(combustion\s+air|flue\s+size|vent\s+connector|clearance\s+to\s+combustible)/i,
  /\b(permit|inspection|inspector|AHJ|authority\s+having\s+jurisdiction)/i,
];

export const CANADA_INDICATORS = [
  /\b(CEC|CSA|TSSA|NPC|NBC|canadian|canada|ontario|quebec|alberta|british\s+columbia|manitoba|saskatchewan)\b/i,
  /\b(CSA\s+[BC]\d|C22\.1|B149|B52|B44)\b/i,
  /\b(province|provincial)\b/i,
];

export const US_INDICATORS = [
  /\b(NEC|IPC|UPC|IRC|IMC|NFPA|EPA\s+608)\b/i,
  /\b(state\s+code|county\s+code|city\s+code|local\s+amendment)\b/i,
];

// ── Enforcement Patterns ────────────────────────────────────

export const ESCALATION_KEYWORDS = /warranty|coverage|void|compliance|liability|safety\s+procedure/i;

export const WARRANTY_LANGUAGE_PATTERNS = [
  /warranty|warranted|warrantee/i,
  /covered\s+(under|by)|coverage\s+(period|term)/i,
  /manufacturer('s)?\s+(guarantee|liability|responsibility)/i,
  /void(ed|ing)?\s+(the\s+)?warranty/i,
  /parts?\s+and\s+labor\s+(coverage|warranty)/i,
  /claim\s+(process|procedure|filing)/i,
];

export const HUMAN_REVIEW_TRIGGERS: Record<string, RegExp> = {
  warrantyDecision: /warranty.*(void|claim|approve|deny|decline|coverage)/i,
  safetyProcedure: /(lockout|tagout|hazardous|high\s*voltage|gas\s*leak|refrigerant\s*recovery)/i,
  legalLanguage: /(liability|negligence|compliance\s*violation|code\s*violation|recall)/i,
  costEstimate: /\$\s*\d+|cost\s*estimate|price\s*quote/i,
};

// ── Code Compliance Detection Types ─────────────────────────

export interface CodeComplianceDetection {
  isCodeQuery: boolean;
  jurisdiction: 'us' | 'canada' | 'both' | null;
  trades: string[];
}

// ── Industry Types & Symptom Categories ─────────────────────
// Re-exported from the shared vocabulary module (single source of truth).
// Both collect-workflow-intelligence and field-assistant import from the same source.
export {
  SYMPTOM_CATEGORIES,
  FAILURE_PATTERNS,
  REPAIR_PATTERNS,
  extractPatternMatches,
  detectSymptomsInText,
  formatLabel,
} from "../_shared/symptomVocabulary.ts";
export type { IndustryType, SymptomCategory } from "../_shared/symptomVocabulary.ts";

// ── Industry Safety Prompts ─────────────────────────────────

export const INDUSTRY_SAFETY_PROMPTS: Record<IndustryType, string> = {
  hvac: `
## INDUSTRY-SPECIFIC SAFETY REQUIREMENTS (HVAC):
⚠️ REFRIGERANT HANDLING: EPA Section 608 certification required. Never vent refrigerants to atmosphere.
⚠️ ELECTRICAL SAFETY: Lock out/tag out procedures required before working on electrical components.
⚠️ HIGH PRESSURE: Refrigerant systems operate under high pressure. Use proper safety equipment.

### Code References:
- Reference EPA 608 regulations for refrigerant handling
- Reference ASHRAE standards for ventilation and air quality
- Reference NEC for electrical connections and wiring

### Special Considerations:
- Consider seasonal context: cooling season (summer) vs heating season (winter)
- Account for humidity levels when diagnosing comfort complaints
- Check for proper refrigerant charge using manufacturer specifications only`,

  plumbing: `
## INDUSTRY-SPECIFIC SAFETY REQUIREMENTS (PLUMBING):
⚠️ WATER CONTAMINATION: Ensure potable water protection. Follow cross-connection control requirements.
⚠️ GAS LINES: Licensed gas fitter required for gas water heater connections.
⚠️ SEWER GASES: Proper ventilation required when working on drain/waste/vent systems.

### Code References:
- Reference IPC (International Plumbing Code) for installation standards
- Reference local plumbing codes which may be more stringent
- Reference ASSE standards for backflow prevention devices

### Special Considerations:
- Consider water quality and hardness when diagnosing fixture issues
- Account for pipe material compatibility (copper, PEX, CPVC, galvanized)
- Check for proper venting on drain issues - every fixture needs a vent`,

  electrical: `
## INDUSTRY-SPECIFIC SAFETY REQUIREMENTS (ELECTRICAL):
🔴 ARC FLASH HAZARD: Proper PPE required. Follow NFPA 70E for arc flash safety.
🔴 LOCK OUT/TAG OUT: De-energize and verify zero energy before working on circuits.
🔴 QUALIFIED PERSONS ONLY: Only licensed electricians should perform electrical work.

### Code References:
- Reference NEC (National Electrical Code) for all installations
- Reference local amendments which may modify NEC requirements
- Reference NFPA 70E for electrical safety in the workplace

### Special Considerations:
- Always verify voltage with a tested meter before assuming a circuit is dead
- Consider wire ampacity based on conductor size, insulation type, and ambient temperature
- Account for voltage drop on long runs - may need to upsize conductors`,

  mechanical: `
## INDUSTRY-SPECIFIC SAFETY REQUIREMENTS (MECHANICAL):
⚠️ LOCK OUT/TAG OUT: Follow OSHA LOTO procedures before maintenance.
⚠️ ROTATING EQUIPMENT: Keep away from moving parts. No loose clothing.
⚠️ PRESSURE SYSTEMS: Depressurize hydraulic/pneumatic systems before service.

### Code References:
- Reference OSHA regulations for machine guarding and safety
- Reference manufacturer PM schedules for maintenance intervals
- Reference API or ASME standards for pressure vessels and piping

### Special Considerations:
- Document baseline vibration readings for comparison
- Consider operating temperature when evaluating lubrication
- Check for proper coupling alignment after any motor/pump work`,

  general: `
## SAFETY REQUIREMENTS:
⚠️ SAFETY FIRST: Follow all manufacturer safety guidelines.
⚠️ PROPER PPE: Use appropriate personal protective equipment.
⚠️ QUALIFIED PERSONNEL: Complex repairs may require licensed professionals.

### Special Considerations:
- Document all work performed for future reference
- Check warranty status before proceeding with repairs
- Consider manufacturer-recommended service intervals`,

  elevator: `
## INDUSTRY-SPECIFIC SAFETY REQUIREMENTS (ELEVATOR):
🔴 ASME A17.1: All work must comply with ASME A17.1 Safety Code for Elevators and Escalators.
🔴 LOCK OUT/TAG OUT: De-energize and lock out before entering pit, hoistway, or machine room.
🔴 LICENSED PERSONNEL: Only licensed elevator mechanics may perform work on elevator systems.

### Code References:
- Reference ASME A17.1 for safety requirements
- Reference local elevator codes and annual inspection requirements
- Reference CSA B44 (Canadian Elevator Code) for Canadian installations

### Special Considerations:
- All work requires permits and must pass inspection
- Door operators and interlocks are life-safety devices
- Governor and safeties must be tested per code schedule`,

  home_automation: `
## INDUSTRY-SPECIFIC SAFETY REQUIREMENTS (HOME AUTOMATION):
⚠️ LOW VOLTAGE WIRING: Follow NEC Article 725 for Class 2 and Class 3 circuits.
⚠️ NETWORK SECURITY: Change default credentials on all devices. Enable firmware updates.
⚠️ POWER SUPPLY: Verify load ratings before connecting motorized devices (shades, locks).

### Code References:
- Reference NEC Article 725 for low-voltage wiring
- Reference TIA-568 for structured cabling standards
- Reference CEC Section 16 for low-voltage in Canadian installations

### Special Considerations:
- Always verify Wi-Fi coverage before installing wireless devices
- Document all IP addresses and network credentials securely
- Test failover behavior (what happens when hub/network goes down)`
};
