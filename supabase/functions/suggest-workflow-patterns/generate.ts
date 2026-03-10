// ============================================================
// Suggest Workflow Patterns — Template Generation
// ============================================================

import type { PatternCluster, PatternSuggestion, SuggestedStep } from "./types.ts";

// ── Format Label ──────────────────────────────────────────────

function formatLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Generate Suggestion ───────────────────────────────────────

export function generateSuggestion(
  cluster: PatternCluster,
  clusterId: string,
): PatternSuggestion {
  const steps: SuggestedStep[] = [];
  let stepNum = 1;

  const symptomLabel = formatLabel(cluster.primary_symptom);
  const equipLabel = cluster.equipment_type
    ? formatLabel(cluster.equipment_type)
    : "Equipment";

  // Step 1: Startup — Safety & equipment ID
  steps.push({
    step_number: stepNum++,
    stage_name: "Startup",
    title: "Safety Check & Equipment Identification",
    instruction: `Verify safety conditions and confirm equipment identity for ${equipLabel}. Review any lockout/tagout requirements before proceeding.`,
    step_type: "action",
    evidence_requirements: { photo: true },
    validation_rules: {},
    estimated_minutes: 5,
    safety_warning: "Ensure all safety protocols are followed before beginning work.",
    source_chain: null,
  });

  // Step 2: Inspection — Verify symptom
  steps.push({
    step_number: stepNum++,
    stage_name: "Inspection",
    title: `Verify Symptom: ${symptomLabel}`,
    instruction: `Inspect the equipment and confirm the reported symptom: ${symptomLabel}. Document initial observations and any additional symptoms detected.`,
    step_type: "inspection",
    evidence_requirements: { photo: true },
    validation_rules: {},
    estimated_minutes: 10,
    safety_warning: null,
    source_chain: null,
  });

  // Step 3 (conditional): Decision — Diagnose root cause
  if (cluster.failure_components.length > 1) {
    const componentList = cluster.failure_components
      .map(formatLabel)
      .join(", ");
    steps.push({
      step_number: stepNum++,
      stage_name: "Service",
      title: "Diagnose Root Cause",
      instruction: `Based on the symptom "${symptomLabel}", determine which component is the root cause. Likely components: ${componentList}. Perform targeted diagnostic checks on each.`,
      step_type: "decision",
      evidence_requirements: {},
      validation_rules: {},
      estimated_minutes: 15,
      safety_warning: null,
      source_chain: null,
    });
  }

  // Steps 4+: Service — Apply repair actions (ordered by chain success rate)
  const sortedChains = [...cluster.chains].sort(
    (a, b) => b.success_rate - a.success_rate,
  );

  // Deduplicate repairs by normalized name
  const seenRepairs = new Set<string>();
  for (const chain of sortedChains) {
    const normalized = chain.repair_action
      .toLowerCase()
      .replace(/[_\s]+/g, " ")
      .trim();
    if (seenRepairs.has(normalized)) continue;
    seenRepairs.add(normalized);

    const repairLabel = formatLabel(chain.repair_action);
    const failureLabel = formatLabel(chain.failure_component);
    const successPct = Math.round(chain.success_rate * 100);

    steps.push({
      step_number: stepNum++,
      stage_name: "Service",
      title: `${repairLabel} — ${failureLabel}`,
      instruction: `Apply repair: ${repairLabel} to address ${failureLabel}. Historical success rate: ${successPct}% across ${chain.occurrence_count} documented cases.`,
      step_type: "action",
      evidence_requirements: { photo: true },
      validation_rules: {},
      estimated_minutes: 20,
      safety_warning: null,
      source_chain: `${chain.symptom}→${chain.failure_component}→${chain.repair_action}`,
    });
  }

  // Final step: Inspection — Verify resolution
  steps.push({
    step_number: stepNum++,
    stage_name: "Inspection",
    title: "Verify Resolution",
    instruction: `Verify that the symptom "${symptomLabel}" has been resolved. Run equipment through a full operational test and confirm normal operation.`,
    step_type: "inspection",
    evidence_requirements: { photo: true },
    validation_rules: {},
    estimated_minutes: 10,
    safety_warning: null,
    source_chain: null,
  });

  // Build suggestion name
  const suggestedName = cluster.equipment_type
    ? `${formatLabel(cluster.equipment_type)} — ${symptomLabel} Repair`
    : `${symptomLabel} Repair Workflow`;

  const avgSuccessPct = Math.round(cluster.avg_success_rate * 100);
  const suggestedDescription =
    `AI-discovered workflow for ${symptomLabel} based on ${cluster.total_occurrences} historical repair cases with ${avgSuccessPct}% average success rate.`;

  return {
    cluster_id: clusterId,
    suggested_name: suggestedName,
    suggested_description: suggestedDescription,
    suggested_category: "repair",
    equipment_type: cluster.equipment_type,
    equipment_model: cluster.equipment_model,
    suggested_steps: steps,
    cluster_score: cluster.cluster_score,
    total_supporting_jobs: cluster.total_occurrences,
    avg_success_rate: cluster.avg_success_rate,
  };
}
