// ============================================================
// Sentinel AI v2 — Approved Learning Loop, PR-3 (unpublish)
// unpublish-lesson: pure decision helper
// ============================================================
// Side-effect-free decision for safely removing a lesson's published document
// from the tenant document pipeline. No Deno or Supabase imports here so the
// ownership/identity rules live in one place and can be unit-tested via
// `deno test`.
//
// Scope guard: this only DECIDES. It performs no auth, no delete, and no flag
// evaluation. Unpublish is a removal/cleanup action and is intentionally NOT
// gated by `lesson_citations` — platform admins must be able to remove a
// published lesson document during a rollback or incident even when the flag is
// off. The edge function enforces platform-admin auth; this helper enforces
// that the target document is the lesson's OWN published lesson document so a
// normal uploaded document can never be deleted.

import { LESSON_DOCUMENT_SOURCE } from "../promote-lesson/lesson-publish.ts";

export interface UnpublishLesson {
  id: string;
  tenant_id: string;
  published_document_id: string | null;
}

export interface UnpublishDocument {
  id: string;
  tenant_id: string;
  source: string;
  source_id: string | null;
}

export interface UnpublishInput {
  lesson: UnpublishLesson;
  /** The document row referenced by `lesson.published_document_id`, or null if it no longer exists. */
  document: UnpublishDocument | null;
}

export type UnpublishDecision =
  // The lesson was never published — nothing to do.
  | { action: "noop"; code: "not_published" }
  // The linked document is gone; clear the stale pointer (idempotent cleanup).
  | { action: "clear_link"; code: "document_missing" }
  // The linked document is not unambiguously this lesson's lesson document.
  | { action: "refuse"; code: "mismatch" }
  // Safe to delete this document (chunks cascade; FK nulls the link).
  | { action: "delete"; documentId: string };

const norm = (v: string | null | undefined): string => (v ?? "").trim();

/**
 * Decide what to do when unpublishing a lesson, given the lesson row and the
 * document it claims to have published. The target document is removable ONLY
 * when every identity check holds: it is a lesson-source document, its
 * source_id points back to this lesson, it belongs to the lesson's tenant, and
 * its id matches the lesson's published_document_id. Any mismatch refuses
 * rather than risk deleting an unrelated (e.g. uploaded) document.
 */
export function decideUnpublish(input: UnpublishInput): UnpublishDecision {
  const linkedId = norm(input.lesson.published_document_id);
  if (!linkedId) return { action: "noop", code: "not_published" };

  const doc = input.document;
  if (!doc) return { action: "clear_link", code: "document_missing" };

  const isOwnLessonDocument =
    norm(doc.id) === linkedId &&
    norm(doc.source_id) === norm(input.lesson.id) &&
    norm(doc.tenant_id) === norm(input.lesson.tenant_id) &&
    doc.source === LESSON_DOCUMENT_SOURCE;

  if (!isOwnLessonDocument) return { action: "refuse", code: "mismatch" };

  return { action: "delete", documentId: norm(doc.id) };
}
