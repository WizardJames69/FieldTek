// Pure logic for the Sentinel learning-loop lesson review spine (PR-1).
//
// These functions are intentionally side-effect free (no Supabase, no Date.now
// inside the builders — callers inject the timestamp) so they can be unit-tested
// in CI without a backend. The admin UI and any future tenant-side UI both build
// their review mutations through `buildReviewUpdate` so the transition rules live
// in exactly one place.
//
// Scope guard: nothing here makes a lesson citable. Approving a candidate only
// flips its `status`; retrieval/citation/abstain behavior is untouched.

export type LessonStatus = "pending" | "approved" | "rejected" | "archived";
export type LessonSourceType = "ai_interaction" | "technician_note" | "manual";
export type ReviewAction = "approve" | "reject" | "archive";

export const LESSON_STATUSES: readonly LessonStatus[] = [
  "pending",
  "approved",
  "rejected",
  "archived",
];

export const LESSON_SOURCE_TYPES: readonly LessonSourceType[] = [
  "ai_interaction",
  "technician_note",
  "manual",
];

// Allowed status transitions. A pending candidate can be approved, rejected, or
// archived. Approved/rejected candidates can only be archived afterwards.
// Archived is terminal.
const ALLOWED_TRANSITIONS: Record<LessonStatus, readonly LessonStatus[]> = {
  pending: ["approved", "rejected", "archived"],
  approved: ["archived"],
  rejected: ["archived"],
  archived: [],
};

const ACTION_TARGET: Record<ReviewAction, LessonStatus> = {
  approve: "approved",
  reject: "rejected",
  archive: "archived",
};

export function isValidTransition(from: LessonStatus, to: LessonStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// Only pending candidates may be approved or rejected.
export function canApprove(status: LessonStatus): boolean {
  return isValidTransition(status, "approved");
}

export function canReject(status: LessonStatus): boolean {
  return isValidTransition(status, "rejected");
}

export function canArchive(status: LessonStatus): boolean {
  return isValidTransition(status, "archived");
}

export interface LessonReviewUpdate {
  status: LessonStatus;
  review_notes: string;
  reviewed_by: string;
  reviewed_at: string;
}

export interface BuildReviewUpdateInput {
  currentStatus: LessonStatus;
  action: ReviewAction;
  reviewerId: string;
  reviewNotes: string;
  nowIso: string;
}

// Approve/reject require a non-empty review note (the auditable rationale).
// Archive does not. Throws on an invalid transition or a missing required note
// so callers cannot silently persist an invalid review.
export function buildReviewUpdate(input: BuildReviewUpdateInput): LessonReviewUpdate {
  const { currentStatus, action, reviewerId, reviewNotes, nowIso } = input;
  const target = ACTION_TARGET[action];

  if (!isValidTransition(currentStatus, target)) {
    throw new Error(
      `Invalid lesson transition: cannot ${action} a candidate with status "${currentStatus}".`,
    );
  }

  const trimmedNotes = (reviewNotes ?? "").trim();
  if ((action === "approve" || action === "reject") && trimmedNotes.length === 0) {
    throw new Error(`Review notes are required to ${action} a lesson candidate.`);
  }

  if (!reviewerId) {
    throw new Error("A reviewer id is required to review a lesson candidate.");
  }

  return {
    status: target,
    review_notes: trimmedNotes,
    reviewed_by: reviewerId,
    reviewed_at: nowIso,
  };
}

// ── Candidate intake (PR-2) ────────────────────────────────────────────────
// A pure builder for a new lesson_candidates INSERT payload. Used by the admin
// AI-audit intake dialog so the validation/shaping rules live in one place and
// can be unit-tested without a backend. It does NOT make a lesson citable — it
// only produces a `pending` row; retrieval/citation/abstain are untouched.

export interface BuildCandidateInsertInput {
  tenantId: string;
  createdBy: string;
  question: string;
  proposedAnswer: string;
  sourceType: LessonSourceType;
  equipmentType?: string | null;
  auditLogId?: string | null;
  correlationId?: string | null;
}

export interface LessonCandidateInsert {
  tenant_id: string;
  created_by: string;
  question: string;
  proposed_answer: string;
  source_type: LessonSourceType;
  status: LessonStatus;
  equipment_type: string | null;
  audit_log_id: string | null;
  correlation_id: string | null;
}

function isValidSourceType(value: string): value is LessonSourceType {
  return (LESSON_SOURCE_TYPES as readonly string[]).includes(value);
}

// Validates required fields and trims free text, returning a typed payload
// compatible with the lesson_candidates Insert type. Throws (rather than
// silently persisting a bad row) on any missing/invalid required field so the
// caller surfaces the error to the reviewer. New candidates always start
// `pending`.
export function buildCandidateInsert(
  input: BuildCandidateInsertInput,
): LessonCandidateInsert {
  const tenantId = (input.tenantId ?? "").trim();
  const createdBy = (input.createdBy ?? "").trim();
  const question = (input.question ?? "").trim();
  const proposedAnswer = (input.proposedAnswer ?? "").trim();
  const equipmentType = (input.equipmentType ?? "").trim();

  if (!tenantId) {
    throw new Error("A tenant id is required to create a lesson candidate.");
  }
  if (!createdBy) {
    throw new Error("A creator id is required to create a lesson candidate.");
  }
  if (!question) {
    throw new Error("A non-empty question is required to create a lesson candidate.");
  }
  if (!proposedAnswer) {
    throw new Error("A non-empty proposed answer is required to create a lesson candidate.");
  }
  if (!isValidSourceType(input.sourceType)) {
    throw new Error(`Invalid lesson source type: "${input.sourceType}".`);
  }

  return {
    tenant_id: tenantId,
    created_by: createdBy,
    question,
    proposed_answer: proposedAnswer,
    source_type: input.sourceType,
    status: "pending",
    equipment_type: equipmentType.length > 0 ? equipmentType : null,
    audit_log_id: input.auditLogId ?? null,
    correlation_id: input.correlationId ?? null,
  };
}

export interface BadgeDisplay {
  label: string;
  className: string;
}

const STATUS_BADGE: Record<LessonStatus, BadgeDisplay> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-600" },
};

export function statusBadge(status: LessonStatus): BadgeDisplay {
  return STATUS_BADGE[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
}

const SOURCE_TYPE_LABEL: Record<LessonSourceType, string> = {
  ai_interaction: "AI Interaction",
  technician_note: "Technician Note",
  manual: "Manual",
};

export function sourceTypeLabel(sourceType: LessonSourceType | string): string {
  return SOURCE_TYPE_LABEL[sourceType as LessonSourceType] ?? sourceType;
}
