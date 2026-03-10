// ============================================================
// Verify Step Evidence — Edge Function
// ============================================================
// Validates evidence submitted for a checklist item against the
// template's required_evidence rules. Inserts into
// workflow_step_evidence with verification status.
//
// Feature flag: 'workflow_step_verification'
//   - logging_only: always returns verified, logs failures
//   - warning: returns verified with warnings array
//   - blocking: returns verification_failed if requirements not met
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Types ──────────────────────────────────────────────────────

interface EvidenceRequest {
  job_id: string;
  checklist_item_id: string;
  stage_name: string;
  step_execution_id?: string;
  evidence: {
    photo_url?: string;
    measurement_value?: number;
    measurement_unit?: string;
    serial_number?: string;
    gps_location?: { latitude: number; longitude: number; accuracy: number };
  };
  device_timestamp?: string;
}

interface MeasurementRequirement {
  unit: string;
  min?: number;
  max?: number;
}

interface EvidenceRequirement {
  photo?: boolean;
  measurement?: MeasurementRequirement;
  gps_required?: boolean;
  serial_scan?: boolean;
}

interface ValidationFailure {
  type: string;
  detail?: string;
  expected_min?: number;
  expected_max?: number;
  actual?: number;
}

// ── Validation Logic ───────────────────────────────────────────

function validateEvidence(
  evidence: EvidenceRequest["evidence"],
  requirement: EvidenceRequirement
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (requirement.photo && !evidence.photo_url) {
    failures.push({ type: "photo_missing" });
  }

  if (requirement.measurement) {
    if (evidence.measurement_value == null) {
      failures.push({ type: "measurement_missing" });
    } else {
      const { min, max } = requirement.measurement;
      if (min != null && evidence.measurement_value < min) {
        failures.push({
          type: "measurement_out_of_range",
          detail: `Below minimum ${min}`,
          expected_min: min,
          expected_max: max,
          actual: evidence.measurement_value,
        });
      }
      if (max != null && evidence.measurement_value > max) {
        failures.push({
          type: "measurement_out_of_range",
          detail: `Above maximum ${max}`,
          expected_min: min,
          expected_max: max,
          actual: evidence.measurement_value,
        });
      }
    }
  }

  if (requirement.gps_required) {
    if (!evidence.gps_location) {
      failures.push({ type: "gps_missing" });
    } else if (evidence.gps_location.accuracy > 100) {
      failures.push({
        type: "gps_low_accuracy",
        detail: `Accuracy ${evidence.gps_location.accuracy}m exceeds 100m threshold`,
      });
    }
  }

  if (requirement.serial_scan && !evidence.serial_number) {
    failures.push({ type: "serial_number_missing" });
  }

  return failures;
}

// ── Determine evidence types from submitted evidence ───────────

function getEvidenceTypes(evidence: EvidenceRequest["evidence"]): string[] {
  const types: string[] = [];
  if (evidence.photo_url) types.push("photo");
  if (evidence.measurement_value != null) types.push("measurement");
  if (evidence.serial_number) types.push("serial_scan");
  if (evidence.gps_location) types.push("gps_checkin");
  return types;
}

// ── Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's tenant
    const { data: tenantUser } = await serviceClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ error: "No active tenant membership" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // Parse request
    const body: EvidenceRequest = await req.json();
    const { job_id, checklist_item_id, stage_name, step_execution_id, evidence, device_timestamp } = body;

    if (!job_id || !checklist_item_id || !stage_name || !evidence) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: job_id, checklist_item_id, stage_name, evidence" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check feature flag
    const { data: flag } = await serviceClient
      .from("feature_flags")
      .select("is_enabled, rollout_percentage, allowed_tenant_ids, blocked_tenant_ids, metadata")
      .eq("key", "workflow_step_verification")
      .single();

    const flagEnabled = flag?.is_enabled ?? false;
    const mode = (flag?.metadata as Record<string, unknown>)?.mode as string ?? "logging_only";

    // Resolve evidence requirements — from workflow template step or legacy stage templates
    let itemRequirement: EvidenceRequirement | undefined;

    if (step_execution_id) {
      // Workflow step: resolve requirements from workflow_template_steps
      const { data: stepExec } = await serviceClient
        .from("workflow_step_executions")
        .select("step_id")
        .eq("id", step_execution_id)
        .single();

      if (stepExec) {
        const { data: templateStep } = await serviceClient
          .from("workflow_template_steps")
          .select("evidence_requirements, validation_rules, required_inputs")
          .eq("id", stepExec.step_id)
          .single();

        if (templateStep) {
          const evReq = templateStep.evidence_requirements as Record<string, boolean | undefined> ?? {};
          const valRules = templateStep.validation_rules as Record<string, number | undefined> ?? {};
          const reqInputs = templateStep.required_inputs as Record<string, string | boolean | undefined> ?? {};

          // Convert template format to EvidenceRequirement format
          const req: EvidenceRequirement = {};
          if (evReq.photo) req.photo = true;
          if (evReq.gps_required) req.gps_required = true;
          if (evReq.serial_scan) req.serial_scan = true;
          if (evReq.measurement) {
            req.measurement = {
              unit: (reqInputs.measurement_unit as string) || "units",
              min: valRules.measurement_min as number | undefined,
              max: valRules.measurement_max as number | undefined,
            };
          }
          itemRequirement = req;
        }
      }
    } else {
      // Legacy: resolve from job_stage_templates
      const { data: template } = await serviceClient
        .from("job_stage_templates")
        .select("required_evidence")
        .eq("tenant_id", tenantId)
        .eq("stage_name", stage_name)
        .maybeSingle();

      const requiredEvidence = (template?.required_evidence as Record<string, EvidenceRequirement>) ?? {};
      itemRequirement = requiredEvidence[checklist_item_id];
    }

    // Validate evidence against requirements
    let failures: ValidationFailure[] = [];
    if (itemRequirement) {
      failures = validateEvidence(evidence, itemRequirement);
    }

    const hasFailures = failures.length > 0;
    const evidenceTypes = getEvidenceTypes(evidence);

    // Determine verification status based on mode
    let verificationStatus: string;
    if (!flagEnabled || !hasFailures) {
      verificationStatus = "verified";
    } else if (mode === "logging_only") {
      verificationStatus = "flagged"; // log but don't block
    } else if (mode === "warning") {
      verificationStatus = "flagged"; // warn but don't block
    } else {
      verificationStatus = "failed"; // blocking mode
    }

    // Insert one evidence row per evidence type submitted
    const evidenceRows = evidenceTypes.map((type) => ({
      tenant_id: tenantId,
      job_id,
      checklist_item_id,
      stage_name,
      step_execution_id: step_execution_id || null,
      technician_id: user.id,
      evidence_type: type,
      photo_url: type === "photo" ? evidence.photo_url : null,
      measurement_value: type === "measurement" ? evidence.measurement_value : null,
      measurement_unit: type === "measurement" ? evidence.measurement_unit : null,
      serial_number: type === "serial_scan" ? evidence.serial_number : null,
      gps_location: type === "gps_checkin" ? evidence.gps_location : null,
      device_timestamp: device_timestamp || new Date().toISOString(),
      verification_status: verificationStatus,
      verification_details: hasFailures ? { failures } : null,
    }));

    // If no specific evidence types were submitted but requirements exist,
    // still insert a row to record the attempt
    if (evidenceRows.length === 0 && itemRequirement) {
      evidenceRows.push({
        tenant_id: tenantId,
        job_id,
        checklist_item_id,
        stage_name,
        step_execution_id: step_execution_id || null,
        technician_id: user.id,
        evidence_type: "photo", // default type for failed attempt
        photo_url: null,
        measurement_value: null,
        measurement_unit: null,
        serial_number: null,
        gps_location: null,
        device_timestamp: device_timestamp || new Date().toISOString(),
        verification_status: verificationStatus,
        verification_details: { failures },
      });
    }

    const { data: inserted, error: insertError } = await serviceClient
      .from("workflow_step_evidence")
      .insert(evidenceRows)
      .select("id");

    if (insertError) {
      console.error("Failed to insert evidence:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store evidence", detail: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build response based on mode
    if (hasFailures && flagEnabled && mode === "blocking") {
      return new Response(
        JSON.stringify({
          status: "verification_failed",
          failures,
          evidence_ids: inserted?.map((r) => r.id) ?? [],
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response: Record<string, unknown> = {
      status: "verified",
      evidence_ids: inserted?.map((r) => r.id) ?? [],
    };

    if (hasFailures && flagEnabled && mode === "warning") {
      response.warnings = failures;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("verify-step-evidence error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
