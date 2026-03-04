// ============================================================
// Field Assistant — Deterministic Compliance Engine
// ============================================================
// Evaluates compliance rules against DB state with ZERO AI.
// Runs BEFORE the LLM in the pipeline. Produces structured
// verdicts that the AI can reference but never override.
// ============================================================

import type { WorkflowState } from "./workflow.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── Types ───────────────────────────────────────────────────

export interface ComplianceRule {
  id: string;
  tenant_id: string | null;
  rule_key: string;
  rule_name: string;
  description: string | null;
  industry: string;
  job_types: string[];
  workflow_stages: string[];
  equipment_types: string[];
  rule_type: "prerequisite" | "measurement_range" | "safety_gate";
  condition_json: Record<string, unknown>;
  severity: "info" | "warning" | "blocking" | "critical";
  code_references: string[] | null;
  is_active: boolean;
}

export interface ComplianceVerdict {
  ruleId: string;
  ruleKey: string;
  ruleName: string;
  ruleType: string;
  verdict: "pass" | "fail" | "warn" | "block";
  severity: "info" | "warning" | "blocking" | "critical";
  explanation: string;
  evidence: Record<string, unknown>;
  codeReferences: string[];
}

export interface ChecklistCompletion {
  id: string;
  job_id: string;
  stage_name: string;
  checklist_item: string;
  completed: boolean;
  notes: string | null;
  completed_at: string | null;
  measurement_value: number | null;
  measurement_unit: string | null;
}

export interface ComplianceContext {
  jobId: string;
  tenantId: string;
  industry: string;
  currentStage: string;
  jobType: string | null;
  equipmentType: string | null;
  completions: ChecklistCompletion[];
  workflowState: WorkflowState;
}

// ── Fetch Applicable Rules ──────────────────────────────────

export async function fetchApplicableRules(
  client: SupabaseClient,
  ctx: ComplianceContext,
): Promise<ComplianceRule[]> {
  // Fetch industry defaults (tenant_id IS NULL) + tenant-specific rules
  const { data: allRules, error } = await client
    .from("compliance_rules")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${ctx.tenantId}`)
    .eq("is_active", true);

  if (error) {
    console.error("[compliance] Failed to fetch rules:", error);
    return [];
  }

  if (!allRules || allRules.length === 0) return [];

  // Merge: tenant rules override industry defaults by rule_key
  const ruleMap = new Map<string, ComplianceRule>();
  for (const rule of allRules) {
    const existing = ruleMap.get(rule.rule_key);
    // Tenant-specific rules (non-null tenant_id) take priority
    if (!existing || (rule.tenant_id && !existing.tenant_id)) {
      ruleMap.set(rule.rule_key, rule);
    }
  }

  // Filter by context
  return Array.from(ruleMap.values()).filter((rule) => {
    // Industry match: rule industry must be 'general' or match tenant industry
    if (rule.industry !== "general" && rule.industry !== ctx.industry) {
      return false;
    }

    // Stage match: if workflow_stages is specified, current stage must be included
    if (rule.workflow_stages.length > 0 && !rule.workflow_stages.includes(ctx.currentStage)) {
      return false;
    }

    // Job type match: if job_types is specified, current job type must be included
    if (rule.job_types.length > 0 && ctx.jobType && !rule.job_types.includes(ctx.jobType)) {
      return false;
    }

    // Equipment type match: if equipment_types is specified, current type must match
    if (rule.equipment_types.length > 0 && ctx.equipmentType && !rule.equipment_types.includes(ctx.equipmentType)) {
      return false;
    }

    return true;
  });
}

// ── Rule Evaluators (Pure, Deterministic) ───────────────────

function evaluatePrerequisite(
  rule: ComplianceRule,
  completions: ChecklistCompletion[],
): ComplianceVerdict {
  const condition = rule.condition_json as { requires_items: string[] };
  const requiredItems = condition.requires_items || [];
  const missingItems: string[] = [];

  for (const itemId of requiredItems) {
    const completion = completions.find(
      (c) => c.checklist_item === itemId && c.completed,
    );
    if (!completion) {
      missingItems.push(itemId);
    }
  }

  if (missingItems.length === 0) {
    return buildVerdict(rule, "pass", `All prerequisite items completed`, {
      required: requiredItems,
      completed: requiredItems,
    });
  }

  const verdict = rule.severity === "critical" || rule.severity === "blocking" ? "fail" : "warn";
  return buildVerdict(
    rule,
    verdict,
    `Missing required items: ${missingItems.join(", ")}`,
    { required: requiredItems, missing: missingItems },
  );
}

function evaluateMeasurementRange(
  rule: ComplianceRule,
  completions: ChecklistCompletion[],
): ComplianceVerdict {
  const condition = rule.condition_json as {
    checklist_item_id: string;
    min: number;
    max: number;
    unit: string;
  };

  const completion = completions.find(
    (c) => c.checklist_item === condition.checklist_item_id && c.completed,
  );

  if (!completion) {
    return buildVerdict(
      rule,
      "warn",
      `No measurement recorded for ${condition.checklist_item_id}`,
      { expected_range: `${condition.min}-${condition.max} ${condition.unit}` },
    );
  }

  // Prefer typed measurement_value; fall back to parsing notes
  let value: number | null = completion.measurement_value;
  if (value === null && completion.notes) {
    value = parseFloat(completion.notes);
    if (isNaN(value)) value = null;
  }

  if (value === null) {
    return buildVerdict(
      rule,
      "warn",
      `Could not parse measurement value for ${condition.checklist_item_id}`,
      { raw_notes: completion.notes },
    );
  }

  if (value < condition.min || value > condition.max) {
    return buildVerdict(
      rule,
      "fail",
      `Measurement ${value} ${condition.unit} is outside range [${condition.min}-${condition.max} ${condition.unit}]`,
      { value, min: condition.min, max: condition.max, unit: condition.unit },
    );
  }

  return buildVerdict(
    rule,
    "pass",
    `Measurement ${value} ${condition.unit} is within range [${condition.min}-${condition.max}]`,
    { value, min: condition.min, max: condition.max, unit: condition.unit },
  );
}

function evaluateSafetyGate(
  rule: ComplianceRule,
  currentStage: string,
  completions: ChecklistCompletion[],
): ComplianceVerdict {
  const condition = rule.condition_json as {
    blocks_stage: string;
    unless_completed: string[];
  };

  // Safety gate only applies when we're AT the blocked stage
  if (currentStage !== condition.blocks_stage) {
    return buildVerdict(
      rule,
      "pass",
      `Safety gate not applicable (current stage: ${currentStage}, blocks: ${condition.blocks_stage})`,
      { current_stage: currentStage, blocks_stage: condition.blocks_stage },
    );
  }

  const requiredItems = condition.unless_completed || [];
  const missingItems: string[] = [];

  for (const itemId of requiredItems) {
    const completion = completions.find(
      (c) => c.checklist_item === itemId && c.completed,
    );
    if (!completion) {
      missingItems.push(itemId);
    }
  }

  if (missingItems.length === 0) {
    return buildVerdict(
      rule,
      "pass",
      `All safety gate requirements met for ${condition.blocks_stage}`,
      { required: requiredItems, completed: requiredItems },
    );
  }

  const verdict = rule.severity === "critical" || rule.severity === "blocking" ? "block" : "fail";
  return buildVerdict(
    rule,
    verdict,
    `Cannot proceed to ${condition.blocks_stage}: missing ${missingItems.join(", ")}`,
    { required: requiredItems, missing: missingItems, blocks_stage: condition.blocks_stage },
  );
}

// ── Verdict Builder ─────────────────────────────────────────

function buildVerdict(
  rule: ComplianceRule,
  verdict: ComplianceVerdict["verdict"],
  explanation: string,
  evidence: Record<string, unknown>,
): ComplianceVerdict {
  return {
    ruleId: rule.id,
    ruleKey: rule.rule_key,
    ruleName: rule.rule_name,
    ruleType: rule.rule_type,
    verdict,
    severity: rule.severity,
    explanation,
    evidence,
    codeReferences: rule.code_references || [],
  };
}

// ── Main Evaluation Entry Point ─────────────────────────────

export async function evaluateCompliance(
  client: SupabaseClient,
  ctx: ComplianceContext,
): Promise<ComplianceVerdict[]> {
  const rules = await fetchApplicableRules(client, ctx);

  if (rules.length === 0) {
    return [];
  }

  const verdicts: ComplianceVerdict[] = [];

  for (const rule of rules) {
    switch (rule.rule_type) {
      case "prerequisite":
        verdicts.push(evaluatePrerequisite(rule, ctx.completions));
        break;
      case "measurement_range":
        verdicts.push(evaluateMeasurementRange(rule, ctx.completions));
        break;
      case "safety_gate":
        verdicts.push(evaluateSafetyGate(rule, ctx.currentStage, ctx.completions));
        break;
      default:
        console.warn(`[compliance] Unknown rule type: ${rule.rule_type}`);
    }
  }

  console.log(
    `[compliance] Evaluated ${rules.length} rules for job ${ctx.jobId}: ` +
    `${verdicts.filter((v) => v.verdict === "pass").length} pass, ` +
    `${verdicts.filter((v) => v.verdict === "fail").length} fail, ` +
    `${verdicts.filter((v) => v.verdict === "warn").length} warn, ` +
    `${verdicts.filter((v) => v.verdict === "block").length} block`,
  );

  return verdicts;
}

// ── Persist Verdicts ────────────────────────────────────────

export async function persistVerdicts(
  client: SupabaseClient,
  tenantId: string,
  jobId: string,
  stageName: string,
  verdicts: ComplianceVerdict[],
): Promise<void> {
  if (verdicts.length === 0) return;

  const rows = verdicts.map((v) => ({
    tenant_id: tenantId,
    job_id: jobId,
    rule_id: v.ruleId,
    stage_name: stageName,
    verdict: v.verdict,
    explanation: v.explanation,
    evidence_json: v.evidence,
  }));

  const { error } = await client.from("compliance_verdicts").insert(rows);

  if (error) {
    console.error("[compliance] Failed to persist verdicts:", error);
  }
}
