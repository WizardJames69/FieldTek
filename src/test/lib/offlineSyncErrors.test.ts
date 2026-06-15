import { describe, it, expect } from "vitest";
import {
  getOperationLabel,
  getOperationJobId,
  getJobContextLabel,
  buildSyncErrorMessage,
  buildDroppedMessage,
  FALLBACK_OPERATION_LABEL,
} from "@/lib/offlineSyncErrors";

describe("getOperationLabel", () => {
  it("maps known operation types to friendly nouns", () => {
    expect(getOperationLabel("checklist_completion_update")).toBe("checklist update");
    expect(getOperationLabel("job_checklist_update")).toBe("checklist update");
    expect(getOperationLabel("job_status_update")).toBe("job status update");
    expect(getOperationLabel("job_notes_update")).toBe("job note");
    expect(getOperationLabel("evidence_submission")).toBe("photo evidence");
  });

  it("falls back to a generic label for unknown types", () => {
    expect(getOperationLabel("something_new")).toBe(FALLBACK_OPERATION_LABEL);
    expect(getOperationLabel("")).toBe(FALLBACK_OPERATION_LABEL);
  });
});

describe("getOperationJobId", () => {
  it("reads camelCase jobId", () => {
    expect(getOperationJobId({ payload: { jobId: "abc" } })).toBe("abc");
  });

  it("reads snake_case job_id (evidence submissions)", () => {
    expect(getOperationJobId({ payload: { job_id: "xyz" } })).toBe("xyz");
  });

  it("returns null when no job id or empty payload", () => {
    expect(getOperationJobId({ payload: {} })).toBeNull();
    expect(getOperationJobId({})).toBeNull();
    expect(getOperationJobId({ payload: { jobId: "" } })).toBeNull();
  });
});

describe("getJobContextLabel", () => {
  it("prefers the job title", () => {
    expect(
      getJobContextLabel({ title: "AC Repair", client: { name: "Acme", address: "1 St" } })
    ).toBe("AC Repair");
  });

  it("falls back to client name, then address, then client address", () => {
    expect(getJobContextLabel({ client: { name: "Acme Co" } })).toBe("Acme Co");
    expect(getJobContextLabel({ address: "12 Main St" })).toBe("12 Main St");
    expect(getJobContextLabel({ client: { address: "9 Side Rd" } })).toBe("9 Side Rd");
  });

  it("trims whitespace and ignores blank values", () => {
    expect(getJobContextLabel({ title: "   ", client: { name: " Acme " } })).toBe("Acme");
  });

  it("returns null when nothing usable is present", () => {
    expect(getJobContextLabel(null)).toBeNull();
    expect(getJobContextLabel(undefined)).toBeNull();
    expect(getJobContextLabel({})).toBeNull();
    expect(getJobContextLabel({ title: 42 as unknown as string })).toBeNull();
  });
});

describe("buildSyncErrorMessage", () => {
  it("names the operation and job context", () => {
    expect(buildSyncErrorMessage("checklist_completion_update", "AC Repair - 12 Main St")).toBe(
      'Couldn\'t sync checklist update for "AC Repair - 12 Main St"'
    );
  });

  it("omits context when none is available", () => {
    expect(buildSyncErrorMessage("job_status_update")).toBe("Couldn't sync job status update");
  });

  it("uses a fully generic message for unknown type with no context", () => {
    expect(buildSyncErrorMessage("mystery")).toBe("Couldn't sync an offline change");
  });

  it("appends an attempt count when provided", () => {
    expect(
      buildSyncErrorMessage("job_notes_update", "Job A", { count: 3, max: 10 })
    ).toBe('Couldn\'t sync job note for "Job A" (attempt 3 of 10)');
  });
});

describe("buildDroppedMessage", () => {
  it("produces a loud, support-facing message with job context", () => {
    expect(
      buildDroppedMessage("checklist_completion_update", 10, "Offline Drill - Real Device Test")
    ).toBe(
      'A checklist update for "Offline Drill - Real Device Test" failed after 10 attempts and was removed. Contact support if this change is missing.'
    );
  });

  it("uses the correct article for vowel-initial labels and no context", () => {
    expect(buildDroppedMessage("mystery", 10)).toBe(
      "An offline change failed after 10 attempts and was removed. Contact support if this change is missing."
    );
  });

  it("never includes raw payload data — only the friendly label and context", () => {
    const msg = buildDroppedMessage("job_status_update", 10, "Job Z");
    expect(msg).toContain("A job status update");
    expect(msg).toContain('"Job Z"');
    expect(msg).not.toContain("payload");
  });
});
