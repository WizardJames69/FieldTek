import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildLessonDocumentInsert,
  buildLessonDocumentName,
  canPromoteLesson,
  formatLessonText,
  LESSON_DOCUMENT_CATEGORY,
  LESSON_DOCUMENT_SOURCE,
  MAX_LESSON_DOCUMENT_NAME,
} from "./lesson-publish.ts";

// lesson-publish.ts is side-effect-free, so it is imported and exercised
// directly. These tests run via `deno test --allow-env` (they need no env, but
// the suite convention passes the flag). They are NOT part of the vitest/CI run.

Deno.test("formatLessonText includes question, answer, and equipment", () => {
  const text = formatLessonText(
    "Why is the compressor short-cycling?",
    "Check the low-pressure switch and refrigerant charge.",
    "HVAC Compressor",
  );
  assertEquals(
    text,
    "Question: Why is the compressor short-cycling?\n\n" +
      "Answer: Check the low-pressure switch and refrigerant charge.\n\n" +
      "Equipment: HVAC Compressor",
  );
});

Deno.test("formatLessonText omits equipment when absent/empty/whitespace", () => {
  const expected = "Question: Q?\n\nAnswer: A.";
  assertEquals(formatLessonText("Q?", "A."), expected);
  assertEquals(formatLessonText("Q?", "A.", null), expected);
  assertEquals(formatLessonText("Q?", "A.", "   "), expected);
});

Deno.test("formatLessonText trims inputs", () => {
  const text = formatLessonText("  trimmed q  ", "\n trimmed a \n", "  Boiler  ");
  assertEquals(text, "Question: trimmed q\n\nAnswer: trimmed a\n\nEquipment: Boiler");
});

Deno.test("formatLessonText throws on empty question or answer", () => {
  assertThrows(() => formatLessonText("   ", "A."), Error, "question is required");
  assertThrows(() => formatLessonText("Q?", ""), Error, "answer is required");
});

Deno.test("buildLessonDocumentName prefixes and collapses whitespace", () => {
  assertEquals(
    buildLessonDocumentName("  How   do  I  reset   it? "),
    "Approved Lesson: How do I reset it?",
  );
});

Deno.test("buildLessonDocumentName truncates safely within the budget", () => {
  const longQuestion = "A".repeat(500);
  const name = buildLessonDocumentName(longQuestion);
  assert(name.length <= MAX_LESSON_DOCUMENT_NAME, `name too long: ${name.length}`);
  assert(name.startsWith("Approved Lesson: "));
  assert(name.endsWith("…"), "expected an ellipsis on truncation");
});

Deno.test("buildLessonDocumentName throws on empty question", () => {
  assertThrows(() => buildLessonDocumentName("   "), Error, "question is required");
});

Deno.test("canPromoteLesson requires approved status AND flag enabled", () => {
  assert(canPromoteLesson("approved", true));
  assertEquals(canPromoteLesson("approved", false), false);
  assertEquals(canPromoteLesson("pending", true), false);
  assertEquals(canPromoteLesson("rejected", true), false);
  assertEquals(canPromoteLesson("archived", true), false);
});

Deno.test("buildLessonDocumentInsert shapes a valid documents payload", () => {
  const payload = buildLessonDocumentInsert({
    tenantId: "tenant-uuid",
    question: "Why short-cycling?",
    proposedAnswer: "Check the LP switch.",
    equipmentType: "HVAC Compressor",
    lessonId: "lesson-uuid",
    uploadedBy: "admin-uuid",
  });
  assertEquals(payload, {
    tenant_id: "tenant-uuid",
    name: "Approved Lesson: Why short-cycling?",
    category: LESSON_DOCUMENT_CATEGORY,
    source: LESSON_DOCUMENT_SOURCE,
    source_id: "lesson-uuid",
    file_url: null,
    extracted_text: "Question: Why short-cycling?\n\nAnswer: Check the LP switch.\n\nEquipment: HVAC Compressor",
    extraction_status: "completed",
    embedding_status: "pending",
    uploaded_by: "admin-uuid",
  });
});

Deno.test("buildLessonDocumentInsert trims ids and omits empty equipment", () => {
  const payload = buildLessonDocumentInsert({
    tenantId: "  tenant-uuid  ",
    question: "Q?",
    proposedAnswer: "A.",
    equipmentType: null,
    lessonId: "  lesson-uuid  ",
    uploadedBy: "  admin-uuid  ",
  });
  assertEquals(payload.tenant_id, "tenant-uuid");
  assertEquals(payload.source_id, "lesson-uuid");
  assertEquals(payload.uploaded_by, "admin-uuid");
  assertEquals(payload.extracted_text, "Question: Q?\n\nAnswer: A.");
  assertEquals(payload.file_url, null);
});

Deno.test("buildLessonDocumentInsert throws on missing required ids", () => {
  const base = {
    question: "Q?",
    proposedAnswer: "A.",
    lessonId: "lesson-uuid",
    uploadedBy: "admin-uuid",
  };
  assertThrows(
    () => buildLessonDocumentInsert({ ...base, tenantId: "  " }),
    Error,
    "tenant id is required",
  );
  assertThrows(
    () => buildLessonDocumentInsert({ ...base, tenantId: "t", lessonId: "" }),
    Error,
    "lesson id is required",
  );
  assertThrows(
    () => buildLessonDocumentInsert({ ...base, tenantId: "t", uploadedBy: "" }),
    Error,
    "uploader id is required",
  );
});
