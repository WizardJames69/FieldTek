// ============================================================
// Field Assistant — Workflow Pattern Advisory
// ============================================================
// Fetches AI-discovered repair patterns from workflow_pattern_clusters
// and builds structured context for prompt injection.
// Behind the 'workflow_pattern_discovery' flag.
// ============================================================

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── Constants ─────────────────────────────────────────────────

const MIN_ADVISORY_SCORE = 0.2;
const MAX_ADVISORY_PATTERNS = 5;

// ── Interfaces ────────────────────────────────────────────────

export interface PatternAdvisoryEntry {
  primary_symptom: string;
  failure_components: string[];
  repair_actions: string[];
  avg_success_rate: number;
  cluster_score: number;
  total_occurrences: number;
}

export interface PatternAdvisoryContext {
  patterns: PatternAdvisoryEntry[];
  contextText: string;
}

// ── Format Label ──────────────────────────────────────────────

function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Fetch Pattern Advisory ────────────────────────────────────

export async function fetchPatternAdvisory(
  client: SupabaseClient,
  tenantId: string,
  symptomKeys: string[],
  equipmentType: string | null,
): Promise<PatternAdvisoryContext | null> {
  if (symptomKeys.length === 0) return null;

  try {
    let query = client
      .from("workflow_pattern_clusters")
      .select("primary_symptom, failure_components, repair_actions, avg_success_rate, cluster_score, total_occurrences")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("primary_symptom", symptomKeys)
      .gte("cluster_score", MIN_ADVISORY_SCORE)
      .order("cluster_score", { ascending: false })
      .limit(MAX_ADVISORY_PATTERNS);

    if (equipmentType) {
      query = query.or(`equipment_type.eq.${equipmentType},equipment_type.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.warn("[pattern-advisory] Query error:", error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    // deno-lint-ignore no-explicit-any
    const patterns: PatternAdvisoryEntry[] = data.map((row: any) => ({
      primary_symptom: row.primary_symptom,
      failure_components: row.failure_components || [],
      repair_actions: row.repair_actions || [],
      avg_success_rate: row.avg_success_rate,
      cluster_score: row.cluster_score,
      total_occurrences: row.total_occurrences,
    }));

    // Build context text
    let contextText = `\n\n## WORKFLOW PATTERN ADVISORY (AI-Discovered):\n`;
    contextText += `The following repair patterns have been detected from historical job data.\n`;
    contextText += `These are advisory only and do not replace documented procedures.\n\n`;

    for (let i = 0; i < patterns.length; i++) {
      const p = patterns[i];
      const successPct = Math.round(p.avg_success_rate * 100);
      contextText += `${i + 1}. For symptom "${formatLabel(p.primary_symptom)}":\n`;
      contextText += `   Likely components: ${p.failure_components.map(formatLabel).join(", ")}\n`;
      contextText += `   Effective repairs: ${p.repair_actions.map(formatLabel).join(", ")}\n`;
      contextText += `   Success rate: ${successPct}% across ${p.total_occurrences} jobs\n\n`;
    }

    contextText += `**ADVISORY ONLY:** These patterns are derived from historical data.\n`;
    contextText += `Always follow documented procedures and manufacturer guidelines.\n`;

    return { patterns, contextText };
  } catch (err) {
    console.warn("[pattern-advisory] Fetch error:", err);
    return null;
  }
}
