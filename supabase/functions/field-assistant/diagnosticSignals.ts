// ============================================================
// Field Assistant — Diagnostic Learning Loop
// ============================================================
// Fetches historical repair probability patterns from
// workflow_diagnostic_statistics and builds structured context
// for prompt injection. Behind the 'diagnostic_learning' flag.
// ============================================================

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── Configurable Constants ──────────────────────────────────

/** Minimum occurrence count for a diagnostic pattern to be eligible. Raise to 10 for stricter filtering. */
export const MIN_DIAGNOSTIC_OCCURRENCES = 5;

/** Maximum number of diagnostic patterns to include in the prompt context. */
export const MAX_DIAGNOSTIC_PATTERNS = 5;

// ── Interfaces ──────────────────────────────────────────────

export interface DiagnosticPattern {
  symptom: string;
  failure_component: string;
  repair_action: string;
  equipment_type: string | null;
  occurrence_count: number;
  success_count: number;
  success_rate: number;
  confidence_score: number;
  /** Composite score = success_rate × confidence_score */
  composite_score: number;
}

export interface DiagnosticContext {
  patterns: DiagnosticPattern[];
  symptomsDetected: string[];
  signalStrength: number;
  contextText: string;
}

// ── Fetch Diagnostic Patterns ───────────────────────────────

export async function fetchDiagnosticPatterns(
  client: SupabaseClient,
  tenantId: string,
  symptomKeys: string[],
  equipmentType?: string | null,
): Promise<DiagnosticPattern[]> {
  if (symptomKeys.length === 0) return [];

  try {
    const selectCols = "symptom, failure_component, repair_action, equipment_type, occurrence_count, success_count, success_rate, confidence_score";

    let query;
    if (equipmentType) {
      query = client
        .from("workflow_diagnostic_statistics")
        .select(selectCols)
        .eq("tenant_id", tenantId)
        .in("symptom", symptomKeys)
        .gte("occurrence_count", MIN_DIAGNOSTIC_OCCURRENCES)
        .or(`equipment_type.eq.${equipmentType},equipment_type.is.null`)
        .order("success_rate", { ascending: false })
        .limit(20);
    } else {
      query = client
        .from("workflow_diagnostic_statistics")
        .select(selectCols)
        .eq("tenant_id", tenantId)
        .in("symptom", symptomKeys)
        .gte("occurrence_count", MIN_DIAGNOSTIC_OCCURRENCES)
        .order("success_rate", { ascending: false })
        .limit(20);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[diagnostic-signals] Query error:", error.message);
      return [];
    }

    // deno-lint-ignore no-explicit-any
    return (data || []).map((row: any) => ({
      ...row,
      composite_score: row.success_rate * row.confidence_score,
    }));
  } catch (err) {
    console.warn("[diagnostic-signals] Fetch error:", err);
    return [];
  }
}

// ── Rank Repairs by Probability ─────────────────────────────

export function rankRepairsByProbability(
  patterns: DiagnosticPattern[],
): DiagnosticPattern[] {
  return [...patterns].sort((a, b) => b.composite_score - a.composite_score);
}

// ── Build Diagnostic Context ────────────────────────────────

function confidenceLabel(score: number): string {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildDiagnosticContext(
  patterns: DiagnosticPattern[],
  symptomsDetected: string[],
): DiagnosticContext | null {
  if (patterns.length === 0) {
    return null;
  }

  const ranked = rankRepairsByProbability(patterns);
  const topPatterns = ranked.slice(0, MAX_DIAGNOSTIC_PATTERNS);
  const signalStrength = topPatterns[0]?.composite_score ?? 0;

  let contextText = `\n\n## DIAGNOSTIC INTELLIGENCE (Based on Past Repair Data):\n`;
  contextText += `Detected symptoms in query: ${symptomsDetected.map(formatLabel).join(", ")}\n\n`;
  contextText += `The following repair patterns are based on historical data from completed jobs in this organization.\n`;
  contextText += `Ranked by probability of success (success rate × confidence from sample size):\n\n`;

  for (let i = 0; i < topPatterns.length; i++) {
    const p = topPatterns[i];
    const conf = confidenceLabel(p.confidence_score);
    const successPct = Math.round(p.success_rate * 100);
    contextText += `${i + 1}. **${formatLabel(p.repair_action)}** for ${formatLabel(p.failure_component)}\n`;
    contextText += `   Success Rate: ${successPct}% | Confidence: ${conf} (${p.occurrence_count} cases)\n`;
    if (p.equipment_type) {
      contextText += `   Equipment: ${p.equipment_type}\n`;
    }
    contextText += `\n`;
  }

  contextText += `**IMPORTANT:** These are historical patterns derived from previous repair outcomes. Always verify against uploaded documentation and manufacturer procedures.\n`;
  contextText += `These patterns supplement but do NOT override document-based guidance.\n`;

  return {
    patterns: topPatterns,
    symptomsDetected,
    signalStrength,
    contextText,
  };
}
