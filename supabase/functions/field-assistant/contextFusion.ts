// ============================================================
// Field Assistant — Context Fusion Layer
// ============================================================
// Combines all intelligence signals (diagnostic graph, step
// statistics, pattern clusters) into ranked diagnostic hypotheses
// for Sentinel prompt injection.
// ============================================================

// ── Types ─────────────────────────────────────────────────────

export interface DiagnosticHypothesis {
  repairAction: string;
  failureComponent?: string;
  confidence: number;
  sources: string[];
}

export interface ContextFusionInput {
  diagnosticSignals?: Array<{
    repair_action: string;
    failure_component: string;
    success_rate: number;
    confidence_score: number;
  }>;
  stepStatistics?: Array<{
    stepId: string;
    successRate: number;
    totalExecutions: number;
  }>;
  patternAdvisory?: Array<{
    repair_actions: string[];
    failure_components: string[];
    avg_success_rate: number;
    cluster_score: number;
  }>;
}

// ── Normalize Repair Action ───────────────────────────────────

const VERB_NORMALIZATIONS: [RegExp, string][] = [
  [/\breplaced\b/g, "replace"],
  [/\breplacing\b/g, "replace"],
  [/\binstalled\b/g, "install"],
  [/\binstalling\b/g, "install"],
  [/\brepaired\b/g, "repair"],
  [/\brepairing\b/g, "repair"],
  [/\bfixed\b/g, "fix"],
  [/\bfixing\b/g, "fix"],
];

function normalizeRepairAction(action: string): string {
  let normalized = action.toLowerCase().replace(/_/g, " ");
  for (const [pattern, replacement] of VERB_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, " ").trim();
}

// ── Format Label ──────────────────────────────────────────────

function formatLabel(key: string): string {
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Fuse Context Signals ──────────────────────────────────────

interface HypothesisAccumulator {
  confidence: number;
  failureComponent?: string;
  sources: Set<string>;
}

const WEIGHT_DIAGNOSTIC = 0.5;
const WEIGHT_STEP_STATS = 0.3;
const WEIGHT_PATTERN = 0.2;
const MAX_HYPOTHESES = 5;

export function fuseContextSignals(input: ContextFusionInput): DiagnosticHypothesis[] {
  const accumulator = new Map<string, HypothesisAccumulator>();

  function getOrCreate(key: string): HypothesisAccumulator {
    let entry = accumulator.get(key);
    if (!entry) {
      entry = { confidence: 0, sources: new Set() };
      accumulator.set(key, entry);
    }
    return entry;
  }

  // 1. Diagnostic graph signals (weight 0.5)
  if (input.diagnosticSignals) {
    for (const signal of input.diagnosticSignals) {
      const key = normalizeRepairAction(signal.repair_action);
      if (!key) continue;
      const entry = getOrCreate(key);
      entry.confidence += signal.success_rate * signal.confidence_score * WEIGHT_DIAGNOSTIC;
      if (signal.failure_component && !entry.failureComponent) {
        entry.failureComponent = signal.failure_component;
      }
      entry.sources.add("diagnostic graph");
    }
  }

  // 2. Step statistics (weight 0.3)
  // Step stats lack repair action names — they contribute as general
  // confidence signals keyed by stepId.
  if (input.stepStatistics) {
    for (const stat of input.stepStatistics) {
      if (stat.totalExecutions <= 0) continue;
      const key = `step:${stat.stepId}`;
      const entry = getOrCreate(key);
      entry.confidence += stat.successRate * WEIGHT_STEP_STATS;
      entry.sources.add("workflow statistics");
    }
  }

  // 3. Pattern clusters (weight 0.2)
  if (input.patternAdvisory) {
    for (const pattern of input.patternAdvisory) {
      for (const action of pattern.repair_actions) {
        const key = normalizeRepairAction(action);
        if (!key) continue;
        const entry = getOrCreate(key);
        entry.confidence += pattern.avg_success_rate * pattern.cluster_score * WEIGHT_PATTERN;
        if (pattern.failure_components.length > 0 && !entry.failureComponent) {
          entry.failureComponent = pattern.failure_components[0];
        }
        entry.sources.add("pattern clusters");
      }
    }
  }

  // 4. Apply corroboration boost and build result
  // Multiple independent sources confirming the same hypothesis should
  // INCREASE confidence, not decrease it (was: score/sqrt(sources)).
  const hypotheses: DiagnosticHypothesis[] = [];

  for (const [key, entry] of accumulator) {
    if (entry.confidence <= 0) continue;

    // Corroboration: reward signals confirmed by multiple sources
    const boosted = entry.confidence * Math.log2(1 + entry.sources.size);

    hypotheses.push({
      repairAction: formatLabel(key),
      failureComponent: entry.failureComponent
        ? formatLabel(entry.failureComponent)
        : undefined,
      confidence: Math.round(boosted * 100) / 100,
      sources: Array.from(entry.sources),
    });
  }

  // 5. Sort descending by confidence, return top 5
  hypotheses.sort((a, b) => b.confidence - a.confidence);
  return hypotheses.slice(0, MAX_HYPOTHESES);
}

// ── Build Fusion Context Text ─────────────────────────────────

function confidenceLabel(c: number): string {
  if (c >= 0.7) return "HIGH";
  if (c >= 0.4) return "MEDIUM";
  return "LOW";
}

export function buildFusionContextText(hypotheses: DiagnosticHypothesis[]): string {
  if (hypotheses.length === 0) return "";

  let text = `\n\n## DIAGNOSTIC HYPOTHESES (FUSED INTELLIGENCE):\n`;
  text += `The following repair hypotheses are ranked by cross-referencing multiple intelligence sources.\n\n`;

  for (let i = 0; i < hypotheses.length; i++) {
    const h = hypotheses[i];
    const label = confidenceLabel(h.confidence);
    text += `${i + 1}. ${h.repairAction}\n`;
    text += `   Confidence: ${label} (${h.confidence.toFixed(2)})\n`;
    text += `   Sources: ${h.sources.join(", ")}\n`;
    if (h.failureComponent) {
      text += `   Related component: ${h.failureComponent}\n`;
    }
    text += `\n`;
  }

  text += `**Note:** These hypotheses are AI-generated from historical data.\n`;
  text += `Always verify against documented procedures.\n`;

  return text;
}
