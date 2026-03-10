// ============================================================
// Field Assistant — Workflow State Engine
// ============================================================
// Reads and records workflow state transitions for scheduled jobs.
// Pure data layer — no compliance logic here.
// ============================================================

import type {
  WorkflowExecutionContext,
  WorkflowExecutionStep,
  WorkflowStepOutcomeSummary,
  WorkflowStepStatistic,
} from "./types.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── Interfaces ──────────────────────────────────────────────

export interface StageTransition {
  from: string | null;
  to: string;
  at: string;
  by: string;
}

export interface WorkflowState {
  completed_stages: string[];
  current_stage_started_at: string | null;
  stage_transitions: StageTransition[];
}

const EMPTY_WORKFLOW_STATE: WorkflowState = {
  completed_stages: [],
  current_stage_started_at: null,
  stage_transitions: [],
};

// ── Fetch Workflow State ────────────────────────────────────

export async function fetchWorkflowState(
  client: SupabaseClient,
  jobId: string,
): Promise<WorkflowState> {
  const { data, error } = await client
    .from("scheduled_jobs")
    .select("workflow_state")
    .eq("id", jobId)
    .single();

  if (error || !data?.workflow_state) {
    return { ...EMPTY_WORKFLOW_STATE };
  }

  const ws = data.workflow_state;
  return {
    completed_stages: Array.isArray(ws.completed_stages) ? ws.completed_stages : [],
    current_stage_started_at: ws.current_stage_started_at || null,
    stage_transitions: Array.isArray(ws.stage_transitions) ? ws.stage_transitions : [],
  };
}

// ── Record Stage Transition ─────────────────────────────────

export async function recordStageTransition(
  client: SupabaseClient,
  jobId: string,
  fromStage: string | null,
  toStage: string,
  userId: string,
): Promise<void> {
  const current = await fetchWorkflowState(client, jobId);
  const now = new Date().toISOString();

  // Add the previous stage to completed_stages if not already there
  if (fromStage && !current.completed_stages.includes(fromStage)) {
    current.completed_stages.push(fromStage);
  }

  current.current_stage_started_at = now;
  current.stage_transitions.push({
    from: fromStage,
    to: toStage,
    at: now,
    by: userId,
  });

  const { error } = await client
    .from("scheduled_jobs")
    .update({
      workflow_state: current,
      current_stage: toStage,
    })
    .eq("id", jobId);

  if (error) {
    console.error("[workflow] Failed to record stage transition:", error);
  }
}

// ── Fetch Workflow Execution Context ──────────────────────

// In-memory request cache — persists only for the lifetime of the edge function execution
const workflowExecutionContextCache = new Map<string, WorkflowExecutionContext | null>();

export async function fetchWorkflowExecutionContext(
  client: SupabaseClient,
  jobId: string,
  equipmentType: string | null,
): Promise<WorkflowExecutionContext | null> {
  if (workflowExecutionContextCache.has(jobId)) {
    return workflowExecutionContextCache.get(jobId)!;
  }

  // 1. Get the most recent workflow execution for this job
  const { data: exec } = await client
    .from("workflow_executions")
    .select("id, workflow_id, status, current_step_number, started_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!exec) {
    workflowExecutionContextCache.set(jobId, null);
    return null;
  }

  // 2. Get template name
  const { data: template } = await client
    .from("workflow_templates")
    .select("name")
    .eq("id", exec.workflow_id)
    .single();

  // 3. Get template steps with their definitions
  const { data: templateSteps } = await client
    .from("workflow_template_steps")
    .select("id, step_number, title, instruction, stage_name, evidence_requirements, validation_rules")
    .eq("workflow_id", exec.workflow_id)
    .order("step_number", { ascending: true });

  // 4. Get step executions
  const { data: stepExecs } = await client
    .from("workflow_step_executions")
    .select("step_id, step_number, status, measurement_value, measurement_unit, technician_notes, skipped_reason")
    .eq("execution_id", exec.id)
    .order("step_number", { ascending: true });

  if (!templateSteps || !stepExecs) {
    workflowExecutionContextCache.set(jobId, null);
    return null;
  }

  // 5. Merge template steps with executions
  // deno-lint-ignore no-explicit-any
  const steps: WorkflowExecutionStep[] = templateSteps.map((ts: any) => {
    // deno-lint-ignore no-explicit-any
    const se = stepExecs.find((e: any) => e.step_id === ts.id);
    return {
      stepId: ts.id,
      stepNumber: ts.step_number,
      title: ts.title || `Step ${ts.step_number}`,
      instruction: ts.instruction || "",
      stageName: ts.stage_name || "Service",
      status: se?.status || "pending",
      evidenceRequirements: ts.evidence_requirements || {},
      validationRules: ts.validation_rules || {},
      measurementValue: se?.measurement_value ?? null,
      measurementUnit: se?.measurement_unit ?? null,
      technicianNotes: se?.technician_notes ?? null,
      skippedReason: se?.skipped_reason ?? null,
    };
  });

  const completedSteps = steps.filter(
    (s) => s.status === "completed" || s.status === "skipped",
  ).length;

  // 6. Fetch historical outcomes for these steps + equipment type
  const stepIds = templateSteps.map((ts: { id: string }) => ts.id);
  let historicalOutcomes: WorkflowStepOutcomeSummary[] = [];

  if (stepIds.length > 0) {
    let query = client
      .from("workflow_step_outcomes")
      .select("step_id, outcome_type");

    // Filter by step IDs
    query = query.in("step_id", stepIds);

    // Filter by equipment type if available
    if (equipmentType) {
      query = query.eq("equipment_type", equipmentType);
    }

    const { data: outcomes } = await query;

    if (outcomes && outcomes.length > 0) {
      // Group by step_id + outcome_type, aggregate counts
      const grouped = new Map<string, { stepTitle: string; outcomeType: string; count: number }>();
      // deno-lint-ignore no-explicit-any
      for (const o of outcomes as any[]) {
        // deno-lint-ignore no-explicit-any
        const ts = templateSteps.find((t: any) => t.id === o.step_id);
        const title = ts?.title || "Unknown step";
        const key = `${o.step_id}::${o.outcome_type}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.count++;
        } else {
          grouped.set(key, { stepTitle: title, outcomeType: o.outcome_type, count: 1 });
        }
      }
      historicalOutcomes = Array.from(grouped.values());
    }
  }

  // 7. Fetch step statistics for these steps + equipment type
  let stepStatistics: WorkflowStepStatistic[] = [];
  if (stepIds.length > 0) {
    let statsQuery = client
      .from("workflow_step_statistics")
      .select("step_id, success_rate, total_executions, avg_duration_seconds")
      .in("step_id", stepIds);
    if (equipmentType) {
      statsQuery = statsQuery.eq("equipment_type", equipmentType);
    }
    const { data: statsData } = await statsQuery;
    if (statsData && statsData.length > 0) {
      // deno-lint-ignore no-explicit-any
      stepStatistics = statsData.map((s: any) => ({
        stepId: s.step_id,
        successRate: s.success_rate ?? 0,
        totalExecutions: s.total_executions ?? 0,
        avgDurationSeconds: s.avg_duration_seconds ?? null,
      }));
    }
  }

  const result: WorkflowExecutionContext = {
    workflowName: template?.name || "Unnamed Workflow",
    executionStatus: exec.status,
    currentStepNumber: exec.current_step_number,
    totalSteps: steps.length,
    completedSteps,
    steps,
    historicalOutcomes,
    stepStatistics,
  };

  workflowExecutionContextCache.set(jobId, result);
  return result;
}
