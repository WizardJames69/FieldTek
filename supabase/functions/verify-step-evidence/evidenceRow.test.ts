// PR-SEC-5B regression: buildEvidenceRow must NEVER emit step_execution_id.
// That column exists only in the parked guided-procedures stream
// (20260425100000) and is absent from the production schema, so referencing it
// makes PostgREST reject the whole insert → HTTP 500 on every authorized
// evidence submission. Since the 2026-07-21 stream retirement the request no
// longer carries the field at all; the exact-column-set test below is the
// standing guard against the column creeping back into the insert without the
// parked stream's own migration + rollout.
//
// B4 ownership behavior (no-auth → 401, foreign/malformed job → 404, same-tenant
// → success, no cross-tenant insert) is covered by authz.test.ts.
//
// Run: deno test --allow-env supabase/functions/verify-step-evidence/

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildEvidenceRow, EvidenceRowInput } from "./evidenceRow.ts";

const base: EvidenceRowInput = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  checklistItemId: "item-1",
  stageName: "Service",
  technicianId: "33333333-3333-4333-8333-333333333333",
  evidenceType: "photo",
  photoUrl: "https://example.com/p.jpg",
  deviceTimestamp: "2026-07-17T00:00:00.000Z",
  verificationStatus: "verified",
};

function hasStepExec(row: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(row, "step_execution_id");
}

Deno.test("1. base row omits step_execution_id", () => {
  const row = buildEvidenceRow(base);
  assertEquals(hasStepExec(row), false);
});

Deno.test("2. per-evidence-type branch shape omits step_execution_id", () => {
  // Mirrors the index.ts map(): a measurement row.
  const row = buildEvidenceRow({
    ...base,
    evidenceType: "measurement",
    photoUrl: null,
    measurementValue: 42,
    measurementUnit: "psi",
    verificationDetails: null,
  });
  assertEquals(hasStepExec(row), false);
  assertEquals(row.measurement_value, 42);
  assertEquals(row.measurement_unit, "psi");
});

Deno.test("3. no-evidence fallback branch shape omits step_execution_id", () => {
  // Mirrors the index.ts fallback push(): all-null evidence, failures recorded.
  const row = buildEvidenceRow({
    ...base,
    photoUrl: null,
    verificationStatus: "flagged",
    verificationDetails: { failures: [{ code: "missing_photo" }] },
  });
  assertEquals(hasStepExec(row), false);
  assertEquals(row.verification_status, "flagged");
});

Deno.test("persisted columns are exactly the production-schema set (no step_execution_id)", () => {
  const row = buildEvidenceRow(base);
  assertEquals(Object.keys(row).sort(), [
    "checklist_item_id",
    "device_timestamp",
    "evidence_type",
    "gps_location",
    "job_id",
    "measurement_unit",
    "measurement_value",
    "photo_url",
    "serial_number",
    "stage_name",
    "technician_id",
    "tenant_id",
    "verification_details",
    "verification_status",
  ]);
});
