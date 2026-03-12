// ============================================================
// Collect Workflow Intelligence — Edge Function
// ============================================================
// Triggered via DB trigger when scheduled_jobs.status → 'completed'.
// Extracts diagnostic patterns (symptoms, failures, diagnostics,
// repairs, outcomes) and upserts into the workflow intelligence graph.
//
// Behind the 'workflow_intelligence' feature flag.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SYMPTOM_CATEGORIES,
  FAILURE_PATTERNS,
  REPAIR_PATTERNS,
  extractPatternMatches,
  detectSymptomsInText,
  formatLabel,
} from "../_shared/symptomVocabulary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function classifyOutcome(
  job: { status: string; resolution_notes: string | null; notes: string | null },
): { key: string; label: string; type: string } {
  const text = `${job.resolution_notes || ""} ${job.notes || ""}`.toLowerCase();

  if (/\b(escalat|refer|supervisor|specialist)\b/.test(text)) {
    return { key: "escalated", label: "Escalated", type: "escalated" };
  }
  if (/\b(parts?\s+order|order(ed)?\s+parts?|back\s*order)\b/.test(text)) {
    return { key: "parts_ordered", label: "Parts Ordered", type: "parts_ordered" };
  }
  if (/\b(warranty\s+claim|warranty\s+replace|under\s+warranty)\b/.test(text)) {
    return { key: "warranty_claim", label: "Warranty Claim", type: "warranty_claim" };
  }
  if (/\b(return\s+visit|come\s+back|follow\s*up\s+visit|repeat)\b/.test(text)) {
    return { key: "repeat_visit", label: "Repeat Visit", type: "repeat_visit" };
  }
  // Default for completed jobs
  return { key: "resolved", label: "Resolved", type: "resolved" };
}

// ── Step Outcome Classification ───────────────────────────────

function classifyStepOutcome(
  step: { status: string; skipped_reason?: string | null },
  jobOutcome: string,
): string {
  if (step.status === "skipped") return "no_change";
  if (jobOutcome === "resolved") return "resolved";
  if (jobOutcome === "parts_ordered" || jobOutcome === "escalated") return "improved";
  if (jobOutcome === "repeat_visit") return "no_change";
  return "improved";
}

// ── Main Handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceRoleKey);

    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check feature flag
    const { data: flag } = await client
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", "workflow_intelligence")
      .single();

    if (!flag?.is_enabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "workflow_intelligence flag disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch job data ────────────────────────────────────────

    const [
      { data: job },
      { data: checklists },
      { data: verdicts },
    ] = await Promise.all([
      client
        .from("scheduled_jobs")
        .select("id, tenant_id, title, description, notes, resolution_notes, status, job_type, stage_data, workflow_state, equipment_id")
        .eq("id", job_id)
        .single(),
      client
        .from("job_checklist_completions")
        .select("stage_name, checklist_item, completed, notes, measurement_value, measurement_unit")
        .eq("job_id", job_id),
      client
        .from("compliance_verdicts")
        .select("rule_id, stage_name, verdict, explanation")
        .eq("job_id", job_id),
    ]);

    if (!job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch equipment type and model if equipment_id is present
    let equipmentType: string | null = null;
    let equipmentModel: string | null = null;
    if (job.equipment_id) {
      const { data: equipment } = await client
        .from("equipment_registry")
        .select("equipment_type, model")
        .eq("id", job.equipment_id)
        .single();
      equipmentType = equipment?.equipment_type || null;
      equipmentModel = equipment?.model || null;
    }

    // Fetch workflow execution data (if job used workflow templates)
    // deno-lint-ignore no-explicit-any
    let execData: any = null;
    // deno-lint-ignore no-explicit-any
    let stepExecs: any[] = [];
    {
      const { data: exec } = await client
        .from("workflow_executions")
        .select("id, workflow_id, technician_id, status")
        .eq("job_id", job_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      execData = exec;

      if (execData) {
        const { data: steps } = await client
          .from("workflow_step_executions")
          .select("id, step_id, step_number, status, technician_notes, measurement_value, measurement_unit, started_at, completed_at, skipped_reason")
          .eq("execution_id", execData.id)
          .order("step_number", { ascending: true });
        stepExecs = steps || [];
      }
    }

    const tenantId = job.tenant_id;
    const combinedText = [
      job.title, job.description, job.notes, job.resolution_notes,
      ...(checklists || []).map((c) => c.notes).filter(Boolean),
    ].join(" ");

    // ── Extract patterns ──────────────────────────────────────

    const symptomKeys = detectSymptomsInText(combinedText);
    const failureKeys = extractPatternMatches(
      `${job.resolution_notes || ""} ${(checklists || []).filter((c) => !c.completed).map((c) => c.notes || c.checklist_item).join(" ")}`,
      FAILURE_PATTERNS,
    );
    const repairKeys = extractPatternMatches(
      job.resolution_notes || "",
      REPAIR_PATTERNS,
    );

    // Extract diagnostics from measurements.
    // Canonical source: workflow_step_executions (preferred over job_checklist_completions).
    // Falls back to checklist data for jobs without workflow templates.
    const diagnosticItems: Array<{
      stage_name: string;
      checklist_item: string;
      completed: boolean;
      measurement_value: number | null;
      measurement_unit: string | null;
    }> = [];

    // 1. Prefer step execution measurements (canonical)
    for (const step of stepExecs) {
      if (step.measurement_value !== null && step.measurement_value !== undefined) {
        diagnosticItems.push({
          stage_name: `step_${step.step_number}`,
          checklist_item: `Step ${step.step_number}`,
          completed: step.status === "completed",
          measurement_value: step.measurement_value,
          measurement_unit: step.measurement_unit ?? null,
        });
      }
    }

    // 2. Fall back to checklist measurements (legacy)
    if (diagnosticItems.length === 0) {
      for (const c of checklists || []) {
        if (c.measurement_value !== null && c.measurement_value !== undefined) {
          diagnosticItems.push(c);
        }
      }
    }

    // Classify outcome
    const outcome = classifyOutcome(job);

    console.log(
      `[workflow-intelligence] job=${job_id} symptoms=${symptomKeys.length} failures=${failureKeys.length} ` +
      `repairs=${repairKeys.length} diagnostics=${diagnosticItems.length} outcome=${outcome.key}`,
    );

    // ── Upsert nodes (via RPC for atomic increment) ──────────

    const nodeIds: Record<string, Record<string, string>> = {
      symptom: {},
      failure: {},
      diagnostic: {},
      repair: {},
      outcome: {},
    };

    // Symptoms
    for (const key of symptomKeys) {
      const { data: id } = await client.rpc("upsert_workflow_symptom", {
        p_tenant_id: tenantId,
        p_symptom_key: key,
        p_symptom_label: formatLabel(key),
        p_equipment_type: equipmentType,
        p_category: key.split("_")[0],
      });
      if (id) nodeIds.symptom[key] = id;
    }

    // Failures
    for (const key of failureKeys) {
      const { data: id } = await client.rpc("upsert_workflow_failure", {
        p_tenant_id: tenantId,
        p_failure_key: key,
        p_failure_label: formatLabel(key),
        p_equipment_type: equipmentType,
      });
      if (id) nodeIds.failure[key] = id;
    }

    // Diagnostics
    for (const item of diagnosticItems) {
      const diagnosticKey = `${item.stage_name}:${item.checklist_item}`
        .toLowerCase()
        .replace(/[^a-z0-9:_]/g, "_")
        .slice(0, 100);

      const { data: id } = await client.rpc("upsert_workflow_diagnostic", {
        p_tenant_id: tenantId,
        p_diagnostic_key: diagnosticKey,
        p_diagnostic_label: item.checklist_item,
        p_equipment_type: equipmentType,
        p_success: !!item.completed,
      });
      if (id) nodeIds.diagnostic[diagnosticKey] = id;
    }

    // Repairs
    for (const key of repairKeys) {
      const { data: id } = await client.rpc("upsert_workflow_repair", {
        p_tenant_id: tenantId,
        p_repair_key: key,
        p_repair_label: formatLabel(key),
        p_equipment_type: equipmentType,
      });
      if (id) nodeIds.repair[key] = id;
    }

    // Outcome
    {
      const { data: id } = await client.rpc("upsert_workflow_outcome", {
        p_tenant_id: tenantId,
        p_outcome_key: outcome.key,
        p_outcome_label: outcome.label,
        p_outcome_type: outcome.type,
      });
      if (id) nodeIds.outcome[outcome.key] = id;
    }

    // ── Upsert edges (via RPC for atomic frequency increment) ─

    interface EdgeDef {
      source_type: string;
      source_id: string;
      target_type: string;
      target_id: string;
      edge_type: string;
    }

    const edgeDefs: EdgeDef[] = [];

    // symptom → failure (leads_to)
    for (const sKey of Object.keys(nodeIds.symptom)) {
      for (const fKey of Object.keys(nodeIds.failure)) {
        edgeDefs.push({
          source_type: "symptom",
          source_id: nodeIds.symptom[sKey],
          target_type: "failure",
          target_id: nodeIds.failure[fKey],
          edge_type: "leads_to",
        });
      }
    }

    // failure → diagnostic (diagnosed_by)
    for (const fKey of Object.keys(nodeIds.failure)) {
      for (const dKey of Object.keys(nodeIds.diagnostic)) {
        edgeDefs.push({
          source_type: "failure",
          source_id: nodeIds.failure[fKey],
          target_type: "diagnostic",
          target_id: nodeIds.diagnostic[dKey],
          edge_type: "diagnosed_by",
        });
      }
    }

    // failure → repair (repaired_by)
    for (const fKey of Object.keys(nodeIds.failure)) {
      for (const rKey of Object.keys(nodeIds.repair)) {
        edgeDefs.push({
          source_type: "failure",
          source_id: nodeIds.failure[fKey],
          target_type: "repair",
          target_id: nodeIds.repair[rKey],
          edge_type: "repaired_by",
        });
      }
    }

    // repair → outcome (resulted_in)
    for (const rKey of Object.keys(nodeIds.repair)) {
      for (const oKey of Object.keys(nodeIds.outcome)) {
        edgeDefs.push({
          source_type: "repair",
          source_id: nodeIds.repair[rKey],
          target_type: "outcome",
          target_id: nodeIds.outcome[oKey],
          edge_type: "resulted_in",
        });
      }
    }

    // If no repairs, connect failure → outcome directly
    if (repairKeys.length === 0) {
      for (const fKey of Object.keys(nodeIds.failure)) {
        for (const oKey of Object.keys(nodeIds.outcome)) {
          edgeDefs.push({
            source_type: "failure",
            source_id: nodeIds.failure[fKey],
            target_type: "outcome",
            target_id: nodeIds.outcome[oKey],
            edge_type: "resulted_in",
          });
        }
      }
    }

    // Upsert all edges via RPC
    for (const edge of edgeDefs) {
      await client.rpc("upsert_workflow_edge", {
        p_tenant_id: tenantId,
        p_source_type: edge.source_type,
        p_source_id: edge.source_id,
        p_target_type: edge.target_type,
        p_target_id: edge.target_id,
        p_edge_type: edge.edge_type,
      });
    }

    // ── Recompute probabilities ───────────────────────────────

    // Collect unique source nodes that were affected
    const affectedSources = new Set<string>();
    for (const edge of edgeDefs) {
      affectedSources.add(`${edge.source_type}:${edge.source_id}`);
    }

    for (const sourceKey of affectedSources) {
      const [sourceType, sourceId] = sourceKey.split(":");

      // Get total frequency for this source
      const { data: edges } = await client
        .from("workflow_intelligence_edges")
        .select("id, frequency")
        .eq("source_type", sourceType)
        .eq("source_id", sourceId);

      if (edges && edges.length > 0) {
        const totalFrequency = edges.reduce(
          (sum: number, e: { frequency: number }) => sum + e.frequency,
          0,
        );

        // Update each edge's probability
        for (const edge of edges) {
          await client
            .from("workflow_intelligence_edges")
            .update({ probability: edge.frequency / totalFrequency })
            .eq("id", edge.id);
        }
      }
    }

    // ── Record per-step outcomes ─────────────────────────────
    let stepOutcomesInserted = 0;
    if (execData && stepExecs.length > 0) {
      const outcomeRows = stepExecs
        .filter((s: { status: string }) => s.status === "completed" || s.status === "skipped")
        .map((s: { id: string; step_id: string; status: string; skipped_reason?: string | null; measurement_value?: number | null; measurement_unit?: string | null }) => ({
          tenant_id: tenantId,
          workflow_id: execData.workflow_id,
          step_id: s.step_id,
          step_execution_id: s.id,
          job_id: job_id,
          equipment_type: equipmentType,
          equipment_model: equipmentModel,
          symptom: symptomKeys.length > 0 ? symptomKeys[0] : null,
          outcome_type: classifyStepOutcome(s, outcome.key),
          measurement_value: s.measurement_value ?? null,
          measurement_unit: s.measurement_unit ?? null,
          technician_id: execData.technician_id,
        }));

      if (outcomeRows.length > 0) {
        const { error: outcomeErr } = await client
          .from("workflow_step_outcomes")
          .insert(outcomeRows);
        if (outcomeErr) {
          console.error("[workflow-intelligence] Failed to insert step outcomes:", outcomeErr);
        } else {
          stepOutcomesInserted = outcomeRows.length;
        }
      }
    }

    // ── Aggregate step statistics ────────────────────────────
    let stepStatsUpserted = 0;
    if (execData && stepExecs.length > 0) {
      for (const s of stepExecs.filter((s: { status: string }) => s.status === "completed" || s.status === "skipped")) {
        // Compute duration in seconds (null if timestamps missing)
        let durationSeconds: number | null = null;
        if (s.started_at && s.completed_at) {
          durationSeconds = (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000;
          if (durationSeconds < 0) durationSeconds = null;
        }

        const { error: statErr } = await client.rpc("upsert_workflow_step_statistic", {
          p_tenant_id: tenantId,
          p_workflow_id: execData.workflow_id,
          p_step_id: s.step_id,
          p_equipment_type: equipmentType,
          p_equipment_model: equipmentModel,
          p_outcome_type: classifyStepOutcome(s, outcome.key),
          p_duration_seconds: durationSeconds,
        });
        if (statErr) {
          console.error("[workflow-intelligence] Failed to upsert step statistic:", statErr);
        } else {
          stepStatsUpserted++;
        }
      }
    }

    const latencyMs = Date.now() - start;
    console.log(
      `[workflow-intelligence] Complete: ${edgeDefs.length} edges upserted, ` +
      `${affectedSources.size} sources recomputed, ${stepOutcomesInserted} step outcomes, ` +
      `${stepStatsUpserted} step stats (${latencyMs}ms)`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        job_id,
        extracted: {
          symptoms: symptomKeys.length,
          failures: failureKeys.length,
          diagnostics: diagnosticItems.length,
          repairs: repairKeys.length,
          outcome: outcome.key,
          step_outcomes: stepOutcomesInserted,
          step_stats: stepStatsUpserted,
        },
        edges_upserted: edgeDefs.length,
        latency_ms: latencyMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[workflow-intelligence] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
