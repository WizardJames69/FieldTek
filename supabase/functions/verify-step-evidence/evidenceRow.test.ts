// PR-SEC-5B regression: buildEvidenceRow must NEVER emit step_execution_id.
// That column exists only in the deferred workflow-template stream
// (20260425100000) and is absent from the production schema, so referencing it
// makes PostgREST reject the whole insert → HTTP 500 on every authorized
// evidence submission. The request field stays accepted (API compat) but is
// never persisted while the stream is inactive.
//
// B4 ownership behavior (no-auth → 401, foreign/malformed job → 404, same-tenant
// → success, no cross-tenant insert) is covered by authz.test.ts and is
// unchanged by PR-SEC-5B.
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

Deno.test("1. no step_execution_id supplied → payload omits step_execution_id", () => {
  const row = buildEvidenceRow(base);
  assertEquals(hasStepExec(row), false);
});

Deno.test("2. null step_execution_id supplied → payload omits step_execution_id", () => {
  const row = buildEvidenceRow({ ...base, stepExecutionId: null });
  assertEquals(hasStepExec(row), false);
});

Deno.test("3. valid UUID step_execution_id supplied → payload STILL omits step_execution_id", () => {
  const row = buildEvidenceRow({
    ...base,
    stepExecutionId: "44444444-4444-4444-8444-444444444444",
  });
  // The absent DB column is never referenced, so a caller supplying the field
  // cannot break the insert — the allow path stays successful.
  assertEquals(hasStepExec(row), false);
});

Deno.test("4a. per-evidence-type branch shape omits step_execution_id", () => {
  // Mirrors the index.ts map(): a measurement row with an id supplied.
  const row = buildEvidenceRow({
    ...base,
    evidenceType: "measurement",
    photoUrl: null,
    measurementValue: 42,
    measurementUnit: "psi",
    verificationDetails: null,
    stepExecutionId: "55555555-5555-4555-8555-555555555555",
  });
  assertEquals(hasStepExec(row), false);
  assertEquals(row.measurement_value, 42);
  assertEquals(row.measurement_unit, "psi");
});

Deno.test("4b. no-evidence fallback branch shape omits step_execution_id", () => {
  // Mirrors the index.ts fallback push(): all-null evidence, failures recorded.
  const row = buildEvidenceRow({
    ...base,
    photoUrl: null,
    verificationStatus: "flagged",
    verificationDetails: { failures: [{ code: "missing_photo" }] },
    stepExecutionId: "66666666-6666-4666-8666-666666666666",
  });
  assertEquals(hasStepExec(row), false);
  assertEquals(row.verification_status, "flagged");
});

Deno.test("persisted columns are exactly the production-schema set (no step_execution_id)", () => {
  const row = buildEvidenceRow({ ...base, stepExecutionId: "x" });
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
