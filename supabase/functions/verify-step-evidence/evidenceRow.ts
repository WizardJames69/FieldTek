// ============================================================
// verify-step-evidence — workflow_step_evidence row builder (PR-SEC-5B)
// ============================================================
// Side-effect-free (no top-level I/O) so it can be imported directly by
// evidenceRow.test.ts — same pattern as jobOwnership.ts / degradation.ts.
//
// ⚠️ DEFERRED SCHEMA — step_execution_id is intentionally NOT persisted.
// `workflow_step_evidence.step_execution_id` is created ONLY by the deferred
// workflow-template migration 20260425100000, which is deliberately NOT applied
// in production (see supabase/migrations-deferred/README.md). Referencing that
// column in an insert makes PostgREST reject the ENTIRE insert — "Could not find
// the 'step_execution_id' column of 'workflow_step_evidence' in the schema
// cache" → HTTP 500 — for every authorized evidence submission. This builder
// therefore NEVER emits step_execution_id, even when the request supplies one.
//
// The request field is still accepted upstream for API compatibility; it is
// simply ignored for persistence while the workflow-template stream is inactive.
//
// TODO(workflow-templates): restore step_execution_id persistence ONLY when the
// deferred workflow-template stream is formally activated — as part of that
// stream's own migration + production rollout, never by probing the live schema
// at request time.

export interface EvidenceRowInput {
  tenantId: string;
  jobId: string;
  checklistItemId: string;
  stageName: string;
  technicianId: string;
  evidenceType: string;
  photoUrl?: string | null;
  measurementValue?: number | null;
  measurementUnit?: string | null;
  serialNumber?: string | null;
  gpsLocation?: unknown;
  deviceTimestamp: string;
  verificationStatus: string;
  verificationDetails?: unknown;
  /**
   * Accepted for API compatibility but DELIBERATELY NOT persisted — the target
   * column does not exist in the active production schema (see header).
   */
  stepExecutionId?: string | null;
}

/**
 * Build one workflow_step_evidence insert row. Returns ONLY columns that exist
 * in the active production schema; step_execution_id is never included,
 * regardless of `input.stepExecutionId`.
 */
export function buildEvidenceRow(input: EvidenceRowInput): Record<string, unknown> {
  // NOTE: do NOT add step_execution_id here without the deferred migration —
  // see the module header. `input.stepExecutionId` is intentionally unused.
  return {
    tenant_id: input.tenantId,
    job_id: input.jobId,
    checklist_item_id: input.checklistItemId,
    stage_name: input.stageName,
    technician_id: input.technicianId,
    evidence_type: input.evidenceType,
    photo_url: input.photoUrl ?? null,
    measurement_value: input.measurementValue ?? null,
    measurement_unit: input.measurementUnit ?? null,
    serial_number: input.serialNumber ?? null,
    gps_location: input.gpsLocation ?? null,
    device_timestamp: input.deviceTimestamp,
    verification_status: input.verificationStatus,
    verification_details: input.verificationDetails ?? null,
  };
}
