// ============================================================
// verify-step-evidence — workflow_step_evidence row builder (PR-SEC-5B)
// ============================================================
// Side-effect-free (no top-level I/O) so it can be imported directly by
// evidenceRow.test.ts — same pattern as jobOwnership.ts / degradation.ts.
//
// ⚠️ PARKED SCHEMA — step_execution_id must NEVER be emitted here.
// `workflow_step_evidence.step_execution_id` is created ONLY by the parked
// guided-procedures migration 20260425100000, which is NOT applied in
// production (see supabase/migrations-parked/guided-procedures/README.md).
// Referencing that column in an insert makes PostgREST reject the ENTIRE
// insert — "Could not find the 'step_execution_id' column of
// 'workflow_step_evidence' in the schema cache" → HTTP 500 — for every
// authorized evidence submission (PR-SEC-5B). As of the 2026-07-21 stream
// retirement the request no longer even accepts the field; the exact-column
// regression test below is the guard against it ever creeping back in
// without that stream's own migration + rollout.

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
}

/**
 * Build one workflow_step_evidence insert row. Returns ONLY columns that exist
 * in the active production schema; step_execution_id is never included (see
 * the module header).
 */
export function buildEvidenceRow(input: EvidenceRowInput): Record<string, unknown> {
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
