// ============================================================
// Field Assistant — Workflow State Engine
// ============================================================
// Reads and records workflow state transitions for scheduled jobs.
// Pure data layer — no compliance logic here.
// ============================================================

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
