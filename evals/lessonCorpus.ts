// ============================================================
// Sentinel AI eval harness — approved-lesson fixture (PR-3c)
// ============================================================
// A single, deterministic "approved lesson" used to prove that a published
// lesson can be retrieved and cited as the SOLE supporting source once the
// `lesson_citations` flag is enabled for the eval tenant (EV-LESSON-001), while
// abstain still holds for unrelated questions (EV-LESSON-ABSTAIN-001).
//
// Why a dedicated fixture (not the shared TEST_DOCUMENTS corpus):
//   • The topic is deliberately UNIQUE / corpus-absent (an ACME RTU-7 "E5"
//     firmware-fault clear procedure). Nothing in the Carrier 24ACC636 manual,
//     the HVAC maintenance guide, or the warranty terms can answer it — so when
//     this lesson is retrieved it is provably the only supporting source.
//   • Two explicit, query-echoing chunks satisfy the UNCHANGED abstain gate
//     (MIN_RELEVANT_CHUNKS = 2) from a single lesson document — proving a lesson
//     alone can clear retrieval without lowering any threshold.
//
// How it is made citable (deferred, gated — NOT done here):
//   • evals/seed.ts → ensureEvalLessonSeeded inserts this as a promote-lesson-
//     shaped `documents` row (category "Approved Lesson", source "lesson",
//     file_url null) + its chunks, with embeddings resolved from the committed
//     fixture (e2e/fixtures/chunk-embeddings.json). No live publish, no OpenAI
//     at seed time.
//   • Retrieval-time citability stays gated by `lesson_citations` (PR-3b): with
//     the flag off the chunks are excluded before counting/citation/abstain.
//
// Field shapes mirror supabase/functions/promote-lesson/lesson-publish.ts
// (buildLessonDocumentInsert / formatLessonText / buildLessonDocumentName). They
// are MIRRORED rather than imported: that module is Deno-side edge code, and the
// eval harness runs under Node/tsx. Keep the two in sync if the publish format
// changes.

/** Reserved category that drives the citation label + retrieval gate (mirror of LESSON_DOCUMENT_CATEGORY). */
export const LESSON_DOCUMENT_CATEGORY = "Approved Lesson";

/** System-truth provenance value stored in documents.source (mirror of LESSON_DOCUMENT_SOURCE). */
export const LESSON_DOCUMENT_SOURCE = "lesson";

/** The lesson's question — unique enough that only the lesson can answer it. */
export const LESSON_QUESTION =
  "How do I clear the recurring E5 firmware fault on the ACME RTU-7 rooftop unit?";

/**
 * The lesson's approved answer. Used as the document body (extracted_text) via
 * the formatLessonText shape; the retrievable chunks below carry the same facts.
 */
export const LESSON_ANSWER =
  "The E5 fault on the ACME RTU-7 latches when a controller firmware update " +
  "interrupts the EEPROM write. Put the unit in standby, then press and hold the " +
  "MODE and DOWN buttons together for 10 seconds until the display flashes 'CLr' — " +
  "this clears the E5 firmware fault. Confirm the home screen returns within 30 " +
  "seconds and the E5 code does not reappear on the next compressor cycle. If it " +
  "recurs after a later firmware update, repeat the 10 second MODE and DOWN hold; a " +
  "persistent E5 means the controller board must be reflashed at the service bench.";

/** Document name, mirroring buildLessonDocumentName ("Approved Lesson: " + question, < 140 chars → no truncation). */
export const LESSON_DOCUMENT_NAME = `Approved Lesson: ${LESSON_QUESTION}`;

/** Document body, mirroring formatLessonText(question, answer) (no equipment line). */
export const LESSON_EXTRACTED_TEXT = `Question: ${LESSON_QUESTION}\n\nAnswer: ${LESSON_ANSWER}`;

export interface LessonChunk {
  text: string;
  page_number?: number | null;
  section_name?: string | null;
}

/**
 * Two focused, query-echoing chunks. Both repeat the "recurring E5 firmware
 * fault … ACME RTU-7" phrasing and carry the unique facts (MODE + DOWN, 10
 * seconds) so each clears the tenant similarity threshold and the answer can
 * cover the expected facts. Edit text → regenerate the embedding fixture
 * (npm run generate:e2e-embeddings).
 */
export const LESSON_CHUNKS: LessonChunk[] = [
  {
    text:
      "Clearing the recurring E5 firmware fault on the ACME RTU-7 rooftop unit: the " +
      "E5 fault latches after a controller firmware update interrupts the EEPROM " +
      "write. To clear the E5 fault, put the unit in standby, then press and hold the " +
      "MODE and DOWN buttons together for 10 seconds until the display flashes 'CLr'. " +
      "Release the buttons and the E5 firmware fault clears.",
    page_number: 1,
    section_name: "Clear Procedure",
  },
  {
    text:
      "After clearing the E5 firmware fault on the ACME RTU-7, confirm the firmware " +
      "reload completed: the display should return to the home screen within 30 " +
      "seconds and the E5 code should not reappear on the next compressor cycle. If " +
      "the E5 fault recurs after another firmware update, repeat the MODE and DOWN " +
      "hold for 10 seconds; a persistent E5 indicates the controller board must be " +
      "reflashed at the service bench.",
    page_number: 1,
    section_name: "Confirmation",
  },
];

// ── Eval-case expectations derived from this fixture ────────────────────────

/** Substring that appears only in the lesson chunks (retrieval-hit assertion). */
export const LESSON_CHUNK_INCLUDES = ["E5 firmware fault"];

/** Facts the grounded answer must contain (fact-coverage assertion). */
export const LESSON_EXPECTED_FACTS = ["MODE", "10 seconds"];

/**
 * Sole-source allowlist: every retrieved/cited document name must match this, so
 * the case fails if any non-lesson source contributes. "Approved Lesson:" is a
 * loose substring of the full document name and of no corpus document name.
 */
export const LESSON_ONLY_DOCUMENT_NAMES = ["Approved Lesson:"];
