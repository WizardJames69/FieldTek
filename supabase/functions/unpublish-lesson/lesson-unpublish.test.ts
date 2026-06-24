import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  decideUnpublish,
  type UnpublishDecision,
  type UnpublishDocument,
  type UnpublishLesson,
} from "./lesson-unpublish.ts";

// lesson-unpublish.ts is side-effect-free, so it is imported and exercised
// directly. These tests run via `deno test --allow-env` (they need no env, but
// the suite convention passes the flag). They are NOT part of the vitest/CI run.
//
// Unpublish is a removal/cleanup action and is intentionally NOT gated by the
// lesson_citations flag — there is no flag input here. Platform admins must be
// able to remove a published lesson document during a rollback or incident even
// when the flag is off. The decision below enforces only ownership/identity:
// the target document must be the lesson's own published lesson document.

const LESSON: UnpublishLesson = {
  id: "lesson-uuid",
  tenant_id: "tenant-uuid",
  published_document_id: "doc-uuid",
};

const MATCHING_DOC: UnpublishDocument = {
  id: "doc-uuid",
  tenant_id: "tenant-uuid",
  source: "lesson",
  source_id: "lesson-uuid",
};

Deno.test("decideUnpublish: noop when the lesson has no published document", () => {
  const decision = decideUnpublish({
    lesson: { ...LESSON, published_document_id: null },
    document: null,
  });
  assertEquals<UnpublishDecision>(decision, { action: "noop", code: "not_published" });
});

Deno.test("decideUnpublish: noop when published_document_id is blank", () => {
  const decision = decideUnpublish({
    lesson: { ...LESSON, published_document_id: "   " },
    document: null,
  });
  assertEquals(decision.action, "noop");
});

Deno.test("decideUnpublish: clear_link when the linked document is already gone", () => {
  // Dangling link: lesson points at a document that no longer exists. Idempotent
  // cleanup — clear the stale pointer, report success, delete nothing.
  const decision = decideUnpublish({ lesson: LESSON, document: null });
  assertEquals<UnpublishDecision>(decision, { action: "clear_link", code: "document_missing" });
});

Deno.test("decideUnpublish: delete when the document is the lesson's own lesson document", () => {
  const decision = decideUnpublish({ lesson: LESSON, document: MATCHING_DOC });
  assertEquals<UnpublishDecision>(decision, { action: "delete", documentId: "doc-uuid" });
});

Deno.test("decideUnpublish: refuse when the document is not a lesson document", () => {
  // Guards against ever deleting a normal uploaded document.
  const decision = decideUnpublish({
    lesson: LESSON,
    document: { ...MATCHING_DOC, source: "upload" },
  });
  assertEquals(decision.action, "refuse");
  assert(decision.action === "refuse" && decision.code === "mismatch");
});

Deno.test("decideUnpublish: refuse when source_id does not point back to the lesson", () => {
  const decision = decideUnpublish({
    lesson: LESSON,
    document: { ...MATCHING_DOC, source_id: "some-other-lesson" },
  });
  assertEquals(decision.action, "refuse");
});

Deno.test("decideUnpublish: refuse on a cross-tenant document", () => {
  const decision = decideUnpublish({
    lesson: LESSON,
    document: { ...MATCHING_DOC, tenant_id: "other-tenant" },
  });
  assertEquals(decision.action, "refuse");
});

Deno.test("decideUnpublish: refuse when the document id does not match the lesson's link", () => {
  const decision = decideUnpublish({
    lesson: LESSON,
    document: { ...MATCHING_DOC, id: "different-doc" },
  });
  assertEquals(decision.action, "refuse");
});

Deno.test("decideUnpublish: tolerates surrounding whitespace on matching ids", () => {
  const decision = decideUnpublish({
    lesson: { ...LESSON, published_document_id: "  doc-uuid  " },
    document: { ...MATCHING_DOC, id: " doc-uuid ", source_id: " lesson-uuid " },
  });
  assertEquals(decision.action, "delete");
});
