// ============================================================
// Suggest Workflow Patterns — Clustering & Scoring
// ============================================================

import type { DiagnosticChain, PatternCluster } from "./types.ts";

// ── Constants ─────────────────────────────────────────────────

export const MIN_OCCURRENCES = 5;
export const MIN_CONFIDENCE = 0.3;
export const MIN_CLUSTER_SCORE = 0.15;
export const MIN_SUPPORTING_JOBS = 10;
export const MAX_SUGGESTIONS_PER_RUN = 10;

// ── Normalize Repair Actions ──────────────────────────────────

const VERB_PATTERN = /\b(replace|replaced|replacing|install|installed|installing|repair|repaired|repairing|fix|fixed|fixing)\b/gi;

export function normalizeRepairAction(action: string): string {
  return action
    .toLowerCase()
    .replace(VERB_PATTERN, "")
    .replace(/[_\s]+/g, " ")
    .trim();
}

// ── Cluster Chains ────────────────────────────────────────────

export function clusterChains(chains: DiagnosticChain[]): PatternCluster[] {
  const groups = new Map<string, DiagnosticChain[]>();

  for (const chain of chains) {
    const equipKey = chain.equipment_type || "__none__";
    const groupKey = `${equipKey}::${chain.symptom}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.push(chain);
    } else {
      groups.set(groupKey, [chain]);
    }
  }

  const clusters: PatternCluster[] = [];

  for (const [, groupChains] of groups) {
    const first = groupChains[0];
    const failureSet = new Set<string>();
    const repairSet = new Set<string>();
    let totalOccurrences = 0;
    let sumSuccessRate = 0;
    let sumConfidence = 0;

    for (const c of groupChains) {
      failureSet.add(c.failure_component);
      const normalized = normalizeRepairAction(c.repair_action);
      if (normalized) repairSet.add(normalized);
      totalOccurrences += c.occurrence_count;
      sumSuccessRate += c.success_rate;
      sumConfidence += c.confidence_score;
    }

    const chainCount = groupChains.length;
    const failureComponents = Array.from(failureSet).sort();
    const repairActions = Array.from(repairSet).sort();

    const clusterKey = `${first.equipment_type || "any"}:${first.symptom}:${failureComponents.join(",")}`;

    clusters.push({
      cluster_key: clusterKey,
      equipment_type: first.equipment_type,
      equipment_model: null,
      primary_symptom: first.symptom,
      failure_components: failureComponents,
      repair_actions: repairActions,
      chains: groupChains,
      chain_count: chainCount,
      total_occurrences: totalOccurrences,
      avg_success_rate: sumSuccessRate / chainCount,
      avg_confidence: sumConfidence / chainCount,
      cluster_score: 0,
    });
  }

  return clusters;
}

// ── Score Cluster ─────────────────────────────────────────────

export function scoreCluster(cluster: PatternCluster): PatternCluster {
  // Find most recent chain timestamp for recency factor
  let mostRecentMs = 0;
  for (const c of cluster.chains) {
    if (c.last_calculated_at) {
      const ms = new Date(c.last_calculated_at).getTime();
      if (ms > mostRecentMs) mostRecentMs = ms;
    }
  }

  const daysSinceLast = mostRecentMs > 0
    ? (Date.now() - mostRecentMs) / (1000 * 60 * 60 * 24)
    : 30; // default to 30 days if no timestamp

  const recencyFactor = Math.exp(-0.01 * daysSinceLast);
  const logOccurrences = Math.log(cluster.total_occurrences + 1);

  cluster.cluster_score =
    cluster.avg_success_rate *
    cluster.avg_confidence *
    logOccurrences *
    recencyFactor;

  return cluster;
}
