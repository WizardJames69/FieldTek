// ============================================================
// Sentinel AI v2 — Approved Learning Loop, PR-3a
// promote-lesson: pure publishing helpers
// ============================================================
// Side-effect-free helpers for turning an approved lesson_candidate into a
// "lesson" document for the EXISTING tenant document pipeline. No Deno or
// Supabase imports here so the formatting/validation rules live in one place
// and can be unit-tested in isolation via `deno test`.
//
// Scope guard: these helpers only SHAPE data. They do not embed, retrieve,
// cite, or otherwise make a lesson citable on their own. Publication is gated
// by the `lesson_citations` feature flag (default off) in the edge function.

// A lesson document is tagged with this reserved category so it can later be
// labeled ("Approved Lesson") in citations and excluded at retrieval time when
// the flag is off — both without touching `search_document_chunks`.
export const LESSON_DOCUMENT_CATEGORY = "Approved Lesson";

// System-truth provenance value stored in documents.source.
export const LESSON_DOCUMENT_SOURCE = "lesson";

// Keep generated document names readable in the documents list.
export const MAX_LESSON_DOCUMENT_NAME = 140;

const DOCUMENT_NAME_PREFIX = "Approved Lesson: ";

/**
 * Build the stable text body embedded for a lesson. Always includes the
 * Question and Answer; includes Equipment only when present. Inputs are
 * trimmed. Throws on an empty question or answer so a blank lesson can never
 * be silently published.
 */
export function formatLessonText(
  question: string,
  proposedAnswer: string,
  equipmentType?: string | null,
): string {
  const q = (question ?? "").trim();
  const a = (proposedAnswer ?? "").trim();
  const e = (equipmentType ?? "").trim();

  if (!q) throw new Error("A non-empty question is required to format lesson text.");
  if (!a) throw new Error("A non-empty answer is required to format lesson text.");

  const parts = [`Question: ${q}`, `Answer: ${a}`];
  if (e) parts.push(`Equipment: ${e}`);
  return parts.join("\n\n");
}

/**
 * Build the document name from the lesson question, collapsing whitespace and
 * truncating safely (with an ellipsis) so the prefixed name fits within
 * MAX_LESSON_DOCUMENT_NAME. Throws on an empty question.
 */
export function buildLessonDocumentName(question: string): string {
  const q = (question ?? "").trim().replace(/\s+/g, " ");
  if (!q) {
    throw new Error("A non-empty question is required to build a lesson document name.");
  }
  const budget = MAX_LESSON_DOCUMENT_NAME - DOCUMENT_NAME_PREFIX.length;
  const body = q.length > budget ? `${q.slice(0, budget - 1).trimEnd()}…` : q;
  return `${DOCUMENT_NAME_PREFIX}${body}`;
}

/**
 * A lesson may be promoted only when it is approved AND the lesson_citations
 * flag is enabled for its tenant. Both conditions are required.
 */
export function canPromoteLesson(status: string, flagEnabled: boolean): boolean {
  return status === "approved" && flagEnabled === true;
}

export interface LessonDocumentInsertInput {
  tenantId: string;
  question: string;
  proposedAnswer: string;
  equipmentType?: string | null;
  lessonId: string;
  uploadedBy: string;
}

export interface LessonDocumentInsert {
  tenant_id: string;
  name: string;
  category: string;
  source: string;
  source_id: string;
  file_url: null;
  extracted_text: string;
  extraction_status: "completed";
  embedding_status: "pending";
  uploaded_by: string;
}

/**
 * Shape the `documents` INSERT payload for a lesson. file_url is null (no
 * uploaded file), extraction is marked completed (text is supplied directly),
 * and embedding is left pending so the existing generate-embeddings pipeline
 * picks it up. Throws on missing required ids.
 */
export function buildLessonDocumentInsert(
  input: LessonDocumentInsertInput,
): LessonDocumentInsert {
  const tenantId = (input.tenantId ?? "").trim();
  const lessonId = (input.lessonId ?? "").trim();
  const uploadedBy = (input.uploadedBy ?? "").trim();

  if (!tenantId) throw new Error("A tenant id is required to build a lesson document.");
  if (!lessonId) throw new Error("A lesson id is required to build a lesson document.");
  if (!uploadedBy) throw new Error("An uploader id is required to build a lesson document.");

  return {
    tenant_id: tenantId,
    name: buildLessonDocumentName(input.question),
    category: LESSON_DOCUMENT_CATEGORY,
    source: LESSON_DOCUMENT_SOURCE,
    source_id: lessonId,
    file_url: null,
    extracted_text: formatLessonText(input.question, input.proposedAnswer, input.equipmentType),
    extraction_status: "completed",
    embedding_status: "pending",
    uploaded_by: uploadedBy,
  };
}
