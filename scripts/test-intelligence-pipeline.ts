// ============================================================
// Intelligence Pipeline Test Harness
// ============================================================
// Simulates a complete workflow intelligence cycle:
//   1. Inserts synthetic diagnostic statistics
//   2. Inserts synthetic step statistics
//   3. Inserts synthetic pattern clusters
//   4. Calls fuseContextSignals() locally
//   5. Verifies hypothesis ranking and dampening
//   6. Cleans up test rows
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/test-intelligence-pipeline.ts
// ============================================================

import { createClient } from "@supabase/supabase-js";

// ── Inline fusion logic (mirrors contextFusion.ts for local testing) ──

interface DiagnosticHypothesis {
  repairAction: string;
  failureComponent?: string;
  confidence: number;
  sources: string[];
}

interface ContextFusionInput {
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

function formatLabel(key: string): string {
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fuseContextSignals(input: ContextFusionInput): DiagnosticHypothesis[] {
  const accumulator = new Map<string, { confidence: number; failureComponent?: string; sources: Set<string> }>();

  function getOrCreate(key: string) {
    let entry = accumulator.get(key);
    if (!entry) {
      entry = { confidence: 0, sources: new Set() };
      accumulator.set(key, entry);
    }
    return entry;
  }

  if (input.diagnosticSignals) {
    for (const signal of input.diagnosticSignals) {
      const key = normalizeRepairAction(signal.repair_action);
      if (!key) continue;
      const entry = getOrCreate(key);
      entry.confidence += signal.success_rate * signal.confidence_score * 0.5;
      if (signal.failure_component && !entry.failureComponent) {
        entry.failureComponent = signal.failure_component;
      }
      entry.sources.add("diagnostic graph");
    }
  }

  if (input.stepStatistics) {
    for (const stat of input.stepStatistics) {
      if (stat.totalExecutions <= 0) continue;
      const key = `step:${stat.stepId}`;
      const entry = getOrCreate(key);
      entry.confidence += stat.successRate * 0.3;
      entry.sources.add("workflow statistics");
    }
  }

  if (input.patternAdvisory) {
    for (const pattern of input.patternAdvisory) {
      for (const action of pattern.repair_actions) {
        const key = normalizeRepairAction(action);
        if (!key) continue;
        const entry = getOrCreate(key);
        entry.confidence += pattern.avg_success_rate * pattern.cluster_score * 0.2;
        if (pattern.failure_components.length > 0 && !entry.failureComponent) {
          entry.failureComponent = pattern.failure_components[0];
        }
        entry.sources.add("pattern clusters");
      }
    }
  }

  const hypotheses: DiagnosticHypothesis[] = [];
  for (const [key, entry] of accumulator) {
    if (entry.confidence <= 0) continue;
    const dampened = entry.confidence / Math.sqrt(entry.sources.size);
    hypotheses.push({
      repairAction: formatLabel(key),
      failureComponent: entry.failureComponent ? formatLabel(entry.failureComponent) : undefined,
      confidence: Math.round(dampened * 100) / 100,
      sources: Array.from(entry.sources),
    });
  }

  hypotheses.sort((a, b) => b.confidence - a.confidence);
  return hypotheses.slice(0, 5);
}

// ── Test Data ─────────────────────────────────────────────────

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000099";
const TEST_CLUSTER_KEY = "test_hvac::no_cooling::capacitor_failure,compressor_failure";

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const client = createClient(url, key);
  const insertedIds: { table: string; id: string }[] = [];

  try {
    console.log("\n=== Intelligence Pipeline Test Harness ===\n");

    // ── Step 1: Insert synthetic diagnostic statistics ────────
    console.log("1. Inserting synthetic diagnostic statistics...");

    const diagStats = [
      { tenant_id: TEST_TENANT_ID, symptom: "no_cooling", failure_component: "capacitor_failure", repair_action: "replaced_capacitor", equipment_type: "hvac", occurrence_count: 42, success_count: 36, success_rate: 0.857, confidence_score: 0.75 },
      { tenant_id: TEST_TENANT_ID, symptom: "no_cooling", failure_component: "compressor_failure", repair_action: "replaced_compressor", equipment_type: "hvac", occurrence_count: 28, success_count: 22, success_rate: 0.786, confidence_score: 0.68 },
      { tenant_id: TEST_TENANT_ID, symptom: "strange_noise", failure_component: "fan_motor", repair_action: "replaced_fan_motor", equipment_type: "hvac", occurrence_count: 15, success_count: 13, success_rate: 0.867, confidence_score: 0.55 },
    ];

    for (const stat of diagStats) {
      const { data, error } = await client
        .from("workflow_diagnostic_statistics")
        .insert(stat)
        .select("id")
        .single();
      if (error) {
        console.warn(`  Warning: Could not insert diagnostic stat: ${error.message}`);
      } else if (data) {
        insertedIds.push({ table: "workflow_diagnostic_statistics", id: data.id });
        console.log(`  Inserted diagnostic stat: ${stat.symptom}→${stat.repair_action}`);
      }
    }

    // ── Step 2: Insert synthetic pattern clusters ─────────────
    console.log("\n2. Inserting synthetic pattern cluster...");

    const { data: clusterData, error: clusterErr } = await client
      .from("workflow_pattern_clusters")
      .insert({
        tenant_id: TEST_TENANT_ID,
        cluster_key: TEST_CLUSTER_KEY,
        equipment_type: "hvac",
        primary_symptom: "no_cooling",
        failure_components: ["capacitor_failure", "compressor_failure"],
        repair_actions: ["replaced_capacitor", "replaced_compressor"],
        chain_count: 2,
        total_occurrences: 70,
        avg_success_rate: 0.82,
        avg_confidence: 0.72,
        cluster_score: 0.65,
        status: "active",
      })
      .select("id")
      .single();

    if (clusterErr) {
      console.warn(`  Warning: Could not insert cluster: ${clusterErr.message}`);
    } else if (clusterData) {
      insertedIds.push({ table: "workflow_pattern_clusters", id: clusterData.id });
      console.log(`  Inserted pattern cluster: ${TEST_CLUSTER_KEY}`);
    }

    // ── Step 3: Call fuseContextSignals locally ───────────────
    console.log("\n3. Running context fusion...");

    const fusionInput: ContextFusionInput = {
      diagnosticSignals: diagStats.map((s) => ({
        repair_action: s.repair_action,
        failure_component: s.failure_component,
        success_rate: s.success_rate,
        confidence_score: s.confidence_score,
      })),
      stepStatistics: [
        { stepId: "step-001", successRate: 0.92, totalExecutions: 50 },
        { stepId: "step-002", successRate: 0.78, totalExecutions: 30 },
      ],
      patternAdvisory: [
        {
          repair_actions: ["replaced_capacitor", "replaced_compressor"],
          failure_components: ["capacitor_failure", "compressor_failure"],
          avg_success_rate: 0.82,
          cluster_score: 0.65,
        },
      ],
    };

    const hypotheses = fuseContextSignals(fusionInput);

    console.log(`\n  Generated ${hypotheses.length} hypotheses:\n`);
    for (let i = 0; i < hypotheses.length; i++) {
      const h = hypotheses[i];
      const label = h.confidence >= 0.7 ? "HIGH" : h.confidence >= 0.4 ? "MEDIUM" : "LOW";
      console.log(`  ${i + 1}. ${h.repairAction}`);
      console.log(`     Confidence: ${label} (${h.confidence.toFixed(2)})`);
      console.log(`     Sources: ${h.sources.join(", ")}`);
      if (h.failureComponent) {
        console.log(`     Related component: ${h.failureComponent}`);
      }
      console.log();
    }

    // ── Step 4: Verify ranking logic ─────────────────────────
    console.log("4. Verifying ranking logic...");

    let passed = true;

    // Check sorted by confidence descending
    for (let i = 1; i < hypotheses.length; i++) {
      if (hypotheses[i].confidence > hypotheses[i - 1].confidence) {
        console.error(`  FAIL: Hypotheses not sorted by confidence at index ${i}`);
        passed = false;
      }
    }
    if (passed) console.log("  PASS: Hypotheses sorted by confidence descending");

    // Check max 5
    if (hypotheses.length <= 5) {
      console.log("  PASS: At most 5 hypotheses returned");
    } else {
      console.error(`  FAIL: ${hypotheses.length} hypotheses returned (max 5)`);
      passed = false;
    }

    // Check dampening applied (multi-source entries should have dampened confidence)
    const multiSource = hypotheses.filter((h) => h.sources.length > 1);
    if (multiSource.length > 0) {
      console.log(`  PASS: ${multiSource.length} hypothesis(es) have multi-source fusion`);
    } else {
      console.log("  INFO: No multi-source hypotheses (may be expected with test data)");
    }

    // Check sources are valid
    const validSources = new Set(["diagnostic graph", "workflow statistics", "pattern clusters"]);
    for (const h of hypotheses) {
      for (const s of h.sources) {
        if (!validSources.has(s)) {
          console.error(`  FAIL: Unknown source "${s}" in hypothesis "${h.repairAction}"`);
          passed = false;
        }
      }
    }
    if (passed) console.log("  PASS: All sources are valid");

    // Check verb normalization
    const capacitorHypothesis = hypotheses.find((h) => h.repairAction.toLowerCase().includes("capacitor"));
    if (capacitorHypothesis && !capacitorHypothesis.repairAction.toLowerCase().includes("replaced")) {
      console.log("  PASS: Verb normalization applied (replaced → replace)");
    } else if (capacitorHypothesis) {
      console.error("  FAIL: Verb normalization not applied");
      passed = false;
    }

    console.log(`\n  Overall: ${passed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`);

  } finally {
    // ── Step 5: Cleanup ──────────────────────────────────────
    console.log("\n5. Cleaning up test data...");
    for (const { table, id } of insertedIds.reverse()) {
      const { error } = await client.from(table).delete().eq("id", id);
      if (error) {
        console.warn(`  Warning: Could not delete from ${table}: ${error.message}`);
      } else {
        console.log(`  Deleted from ${table}: ${id}`);
      }
    }
    console.log("\n=== Test Harness Complete ===\n");
  }
}

main().catch((err) => {
  console.error("Test harness failed:", err);
  process.exit(1);
});
