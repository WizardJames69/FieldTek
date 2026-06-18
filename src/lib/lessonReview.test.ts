import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  canApprove,
  canReject,
  canArchive,
  buildReviewUpdate,
  statusBadge,
  sourceTypeLabel,
  LESSON_STATUSES,
  type LessonStatus,
} from "./lessonReview";

const NOW = "2026-06-17T12:00:00.000Z";
const REVIEWER = "reviewer-uuid";

describe("lessonReview — transitions", () => {
  it("allows pending → approved/rejected/archived", () => {
    expect(isValidTransition("pending", "approved")).toBe(true);
    expect(isValidTransition("pending", "rejected")).toBe(true);
    expect(isValidTransition("pending", "archived")).toBe(true);
  });

  it("only allows approved/rejected → archived", () => {
    expect(isValidTransition("approved", "archived")).toBe(true);
    expect(isValidTransition("rejected", "archived")).toBe(true);
    expect(isValidTransition("approved", "rejected")).toBe(false);
    expect(isValidTransition("rejected", "approved")).toBe(false);
    expect(isValidTransition("approved", "pending")).toBe(false);
  });

  it("treats archived as terminal", () => {
    for (const to of LESSON_STATUSES) {
      expect(isValidTransition("archived", to as LessonStatus)).toBe(false);
    }
  });

  it("never allows a no-op back to pending", () => {
    expect(isValidTransition("pending", "pending")).toBe(false);
  });
});

describe("lessonReview — guards", () => {
  it("canApprove / canReject only for pending", () => {
    expect(canApprove("pending")).toBe(true);
    expect(canReject("pending")).toBe(true);
    for (const s of ["approved", "rejected", "archived"] as LessonStatus[]) {
      expect(canApprove(s)).toBe(false);
      expect(canReject(s)).toBe(false);
    }
  });

  it("canArchive for anything except archived", () => {
    expect(canArchive("pending")).toBe(true);
    expect(canArchive("approved")).toBe(true);
    expect(canArchive("rejected")).toBe(true);
    expect(canArchive("archived")).toBe(false);
  });
});

describe("lessonReview — buildReviewUpdate", () => {
  it("builds an approve update with notes", () => {
    const update = buildReviewUpdate({
      currentStatus: "pending",
      action: "approve",
      reviewerId: REVIEWER,
      reviewNotes: "  Verified against manual section 4.  ",
      nowIso: NOW,
    });
    expect(update).toEqual({
      status: "approved",
      review_notes: "Verified against manual section 4.",
      reviewed_by: REVIEWER,
      reviewed_at: NOW,
    });
  });

  it("builds a reject update with notes", () => {
    const update = buildReviewUpdate({
      currentStatus: "pending",
      action: "reject",
      reviewerId: REVIEWER,
      reviewNotes: "Not grounded in any document.",
      nowIso: NOW,
    });
    expect(update.status).toBe("rejected");
    expect(update.review_notes).toBe("Not grounded in any document.");
  });

  it("requires non-empty notes to approve or reject", () => {
    expect(() =>
      buildReviewUpdate({
        currentStatus: "pending",
        action: "approve",
        reviewerId: REVIEWER,
        reviewNotes: "   ",
        nowIso: NOW,
      }),
    ).toThrow(/notes are required/i);

    expect(() =>
      buildReviewUpdate({
        currentStatus: "pending",
        action: "reject",
        reviewerId: REVIEWER,
        reviewNotes: "",
        nowIso: NOW,
      }),
    ).toThrow(/notes are required/i);
  });

  it("allows archive without notes", () => {
    const update = buildReviewUpdate({
      currentStatus: "approved",
      action: "archive",
      reviewerId: REVIEWER,
      reviewNotes: "",
      nowIso: NOW,
    });
    expect(update.status).toBe("archived");
    expect(update.review_notes).toBe("");
  });

  it("rejects invalid transitions (cannot approve an already-approved candidate)", () => {
    expect(() =>
      buildReviewUpdate({
        currentStatus: "approved",
        action: "approve",
        reviewerId: REVIEWER,
        reviewNotes: "x",
        nowIso: NOW,
      }),
    ).toThrow(/invalid lesson transition/i);
  });

  it("requires a reviewer id", () => {
    expect(() =>
      buildReviewUpdate({
        currentStatus: "pending",
        action: "approve",
        reviewerId: "",
        reviewNotes: "ok",
        nowIso: NOW,
      }),
    ).toThrow(/reviewer id is required/i);
  });
});

describe("lessonReview — display helpers", () => {
  it("returns a badge for every status", () => {
    for (const s of LESSON_STATUSES) {
      const badge = statusBadge(s as LessonStatus);
      expect(badge.label.length).toBeGreaterThan(0);
      expect(badge.className.length).toBeGreaterThan(0);
    }
  });

  it("labels known source types and falls back to the raw value", () => {
    expect(sourceTypeLabel("ai_interaction")).toBe("AI Interaction");
    expect(sourceTypeLabel("technician_note")).toBe("Technician Note");
    expect(sourceTypeLabel("manual")).toBe("Manual");
    expect(sourceTypeLabel("something_else")).toBe("something_else");
  });
});
