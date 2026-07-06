import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  countQueryContentWords,
  decideRetrievalAbstain,
  deriveAuditAbstainFlag,
  isLexicalSingleChunkAnswer,
  isStrongSingleChunkAnswer,
  shouldAttemptLexicalRescue,
} from "./degradation.ts";
import {
  LEXICAL_RESCUE_MIN_QUERY_WORDS,
  SINGLE_CHUNK_MIN_LENGTH,
  SINGLE_CHUNK_STRONG_SIMILARITY,
} from "./constants.ts";

// P3a strong-single-chunk answer path. Pure decisions only — no model, no I/O;
// run via `deno test --allow-env`. A lone retrieved chunk may support an answer
// (instead of the insufficient-coverage refusal) ONLY when the query is
// non-escalation AND the chunk clears BOTH floors (similarity >= 0.8, length
// >= 200 — the same literals the single-chunk weakness gate has always used).
// Everything else — weak single chunks, escalation queries, zero chunks —
// keeps the pre-P3a abstain/human-review posture. The served answer still goes
// through the limited-coverage prompt caveat and full post-LLM citation
// validation; nothing here bypasses grounding checks.

const FLOORS = {
  strongSimilarityFloor: SINGLE_CHUNK_STRONG_SIMILARITY,
  minChunkLength: SINGLE_CHUNK_MIN_LENGTH,
};

// ── isStrongSingleChunkAnswer ───────────────────────────────────────────────

Deno.test("strong single chunk (non-escalation, sim>=0.8, len>=200) qualifies", () => {
  assertEquals(
    isStrongSingleChunkAnswer({
      semanticSearchResultsCount: 1,
      similarity: 0.87,
      chunkTextLength: 2143,
      isEscalationQuery: false,
      ...FLOORS,
    }),
    true,
  );
});

Deno.test("exact floors (sim=0.8, len=200) qualify — floors are inclusive", () => {
  assertEquals(
    isStrongSingleChunkAnswer({
      semanticSearchResultsCount: 1,
      similarity: 0.8,
      chunkTextLength: 200,
      isEscalationQuery: false,
      ...FLOORS,
    }),
    true,
  );
});

Deno.test("weak similarity (0.61 — the founder-smoke signature) does NOT qualify", () => {
  assertEquals(
    isStrongSingleChunkAnswer({
      semanticSearchResultsCount: 1,
      similarity: 0.61,
      chunkTextLength: 2143,
      isEscalationQuery: false,
      ...FLOORS,
    }),
    false,
  );
});

Deno.test("short chunk (len<200) does NOT qualify even at high similarity", () => {
  assertEquals(
    isStrongSingleChunkAnswer({
      semanticSearchResultsCount: 1,
      similarity: 0.95,
      chunkTextLength: 150,
      isEscalationQuery: false,
      ...FLOORS,
    }),
    false,
  );
});

Deno.test("escalation query does NOT qualify regardless of strength", () => {
  assertEquals(
    isStrongSingleChunkAnswer({
      semanticSearchResultsCount: 1,
      similarity: 0.95,
      chunkTextLength: 3000,
      isEscalationQuery: true,
      ...FLOORS,
    }),
    false,
  );
});

Deno.test("rule never applies when more or fewer than exactly one chunk", () => {
  for (const count of [0, 2, 5]) {
    assertEquals(
      isStrongSingleChunkAnswer({
        semanticSearchResultsCount: count,
        similarity: 0.95,
        chunkTextLength: 3000,
        isEscalationQuery: false,
        ...FLOORS,
      }),
      false,
      `count=${count} must not qualify`,
    );
  }
});

// ── decideRetrievalAbstain with the strong-single-chunk override ────────────

Deno.test("one chunk + strongSingleChunk=true → answerable (null)", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 1,
      minRelevantChunks: 2,
      strongSingleChunk: true,
    }),
    null,
  );
});

Deno.test("one chunk + strongSingleChunk=false → insufficient_retrieval_coverage (unchanged)", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 1,
      minRelevantChunks: 2,
      strongSingleChunk: false,
    }),
    "insufficient_retrieval_coverage",
  );
});

Deno.test("one chunk with override ABSENT → insufficient_retrieval_coverage (backward compatible)", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 1,
      minRelevantChunks: 2,
    }),
    "insufficient_retrieval_coverage",
  );
});

Deno.test("zero chunks always abstain — override cannot rescue an empty retrieval", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 0,
      minRelevantChunks: 2,
      strongSingleChunk: true, // hostile input: must still abstain
    }),
    "insufficient_retrieval_coverage",
  );
});

Deno.test("retrieval never ran → retrieval_unavailable even with override set", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: false,
      semanticSearchResultsCount: 0,
      minRelevantChunks: 2,
      strongSingleChunk: true, // hostile input: bypass stays closed
    }),
    "retrieval_unavailable",
  );
});

Deno.test("MIN chunks met → answerable regardless of override (no interaction)", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 2,
      minRelevantChunks: 2,
      strongSingleChunk: false,
    }),
    null,
  );
});

// ════════════════════════════════════════════════════════════════════════════
// P3b lexical rescue. Pure decisions only — the strict AND-match and the
// rank/cosine floors are enforced server-side by the lexical_rescue_chunks
// RPC; these tests cover the trigger gate, the lexical single-chunk answer
// gate, and the abstain-override wiring. OR/partial matching does not exist
// anywhere in this path.
// ════════════════════════════════════════════════════════════════════════════

const RESCUE_BASE = {
  docsWithEmbeddingsCount: 3,
  retrievalRan: true,
  semanticSearchResultsCount: 0,
  minRelevantChunks: 2,
  isEscalationQuery: false,
  queryContentWordCount: 4,
  minQueryContentWords: LEXICAL_RESCUE_MIN_QUERY_WORDS,
};

// ── shouldAttemptLexicalRescue ──────────────────────────────────────────────

Deno.test("rescue triggers on semantic under-retrieval (0 chunks, non-escalation)", () => {
  assertEquals(shouldAttemptLexicalRescue({ ...RESCUE_BASE }), true);
});

Deno.test("rescue triggers with exactly 1 semantic chunk (still under minimum)", () => {
  assertEquals(
    shouldAttemptLexicalRescue({ ...RESCUE_BASE, semanticSearchResultsCount: 1 }),
    true,
  );
});

Deno.test("NO rescue when the minimum chunk count is already met", () => {
  for (const count of [2, 5]) {
    assertEquals(
      shouldAttemptLexicalRescue({ ...RESCUE_BASE, semanticSearchResultsCount: count }),
      false,
      `count=${count} must not rescue`,
    );
  }
});

Deno.test("NO rescue for escalation (warranty/safety) queries", () => {
  assertEquals(
    shouldAttemptLexicalRescue({ ...RESCUE_BASE, isEscalationQuery: true }),
    false,
  );
});

Deno.test("NO rescue when semantic retrieval never ran (outage stays an outage)", () => {
  assertEquals(
    shouldAttemptLexicalRescue({ ...RESCUE_BASE, retrievalRan: false }),
    false,
  );
});

Deno.test("NO rescue for tenants with no embedded documents", () => {
  assertEquals(
    shouldAttemptLexicalRescue({ ...RESCUE_BASE, docsWithEmbeddingsCount: 0 }),
    false,
  );
});

Deno.test("NO rescue for a one-word/generic query (below the content-word gate)", () => {
  assertEquals(
    shouldAttemptLexicalRescue({ ...RESCUE_BASE, queryContentWordCount: 1 }),
    false,
  );
});

// ── countQueryContentWords ──────────────────────────────────────────────────

Deno.test("content-word counting: the founder terse query clears the pre-gate", () => {
  // "what is the Nominal airflow" — 4 words of 3+ chars ("is" excluded).
  assertEquals(countQueryContentWords("what is the Nominal airflow") >= 2, true);
});

Deno.test("content-word counting: a single generic word does not clear the pre-gate", () => {
  assertEquals(countQueryContentWords("airflow") < 2, true);
  assertEquals(countQueryContentWords("") , 0);
});

// ── isLexicalSingleChunkAnswer ──────────────────────────────────────────────

const LEXICAL_SINGLE_BASE = {
  totalChunkCount: 1,
  isLexicalRescueChunk: true,
  chunkTextLength: 2143,
  isEscalationQuery: false,
  minChunkLength: SINGLE_CHUNK_MIN_LENGTH,
};

Deno.test("lone rescued chunk (AND-matched, len>=200, non-escalation) qualifies", () => {
  assertEquals(isLexicalSingleChunkAnswer({ ...LEXICAL_SINGLE_BASE }), true);
});

Deno.test("exact length floor (len=200) qualifies — floor is inclusive", () => {
  assertEquals(
    isLexicalSingleChunkAnswer({ ...LEXICAL_SINGLE_BASE, chunkTextLength: 200 }),
    true,
  );
});

Deno.test("short rescued chunk (len<200) does NOT qualify", () => {
  assertEquals(
    isLexicalSingleChunkAnswer({ ...LEXICAL_SINGLE_BASE, chunkTextLength: 150 }),
    false,
  );
});

Deno.test("a lone chunk WITHOUT lexical rescue metadata does NOT qualify (weak semantic chunk keeps its gate)", () => {
  assertEquals(
    isLexicalSingleChunkAnswer({ ...LEXICAL_SINGLE_BASE, isLexicalRescueChunk: false }),
    false,
  );
});

Deno.test("escalation query does NOT qualify even with a valid rescued chunk", () => {
  assertEquals(
    isLexicalSingleChunkAnswer({ ...LEXICAL_SINGLE_BASE, isEscalationQuery: true }),
    false,
  );
});

Deno.test("lexical rule never applies when more or fewer than exactly one chunk", () => {
  for (const count of [0, 2, 5]) {
    assertEquals(
      isLexicalSingleChunkAnswer({ ...LEXICAL_SINGLE_BASE, totalChunkCount: count }),
      false,
      `count=${count} must not qualify`,
    );
  }
});

// ── decideRetrievalAbstain with the lexical single-chunk override ───────────

Deno.test("one chunk + lexicalSingleChunk=true → answerable (null)", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 1,
      minRelevantChunks: 2,
      strongSingleChunk: false,
      lexicalSingleChunk: true,
    }),
    null,
  );
});

Deno.test("one chunk + both overrides false → insufficient_retrieval_coverage", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 1,
      minRelevantChunks: 2,
      strongSingleChunk: false,
      lexicalSingleChunk: false,
    }),
    "insufficient_retrieval_coverage",
  );
});

Deno.test("one chunk with lexical override ABSENT → insufficient_retrieval_coverage (backward compatible)", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 1,
      minRelevantChunks: 2,
      strongSingleChunk: false,
    }),
    "insufficient_retrieval_coverage",
  );
});

Deno.test("zero chunks always abstain — hostile lexicalSingleChunk cannot rescue empty retrieval", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: true,
      semanticSearchResultsCount: 0,
      minRelevantChunks: 2,
      lexicalSingleChunk: true, // hostile input: must still abstain
    }),
    "insufficient_retrieval_coverage",
  );
});

Deno.test("retrieval never ran → retrieval_unavailable even with lexical override set", () => {
  assertEquals(
    decideRetrievalAbstain({
      docsWithEmbeddingsCount: 3,
      retrievalRan: false,
      semanticSearchResultsCount: 0,
      minRelevantChunks: 2,
      lexicalSingleChunk: true, // hostile input: bypass stays closed
    }),
    "retrieval_unavailable",
  );
});

// ── deriveAuditAbstainFlag (P3c telemetry label) ────────────────────────────
// TELEMETRY ONLY. A grounded answer served through an approved single-chunk
// path (P3a strong / P3b lexical rescue) sits below MIN_RELEVANT_CHUNKS, so
// insufficientRetrievalCoverage is true, but the user got a cited answer — it
// must NOT be labelled abstain_flag=true. Every other input must reproduce the
// prior expression exactly. These assert the label only; runtime abstain
// behavior is decideRetrievalAbstain, tested above and unchanged.

const BASE_ABSTAIN = {
  validationFailed: false,
  insufficientRetrievalCoverage: false,
  retrievedChunkCount: 2,
  hasDocsWithContent: true,
  singleChunkAnswerServed: false,
};

Deno.test("audit label: served strong-single answer is NOT abstain (below-min coverage)", () => {
  assertEquals(
    deriveAuditAbstainFlag({
      ...BASE_ABSTAIN,
      insufficientRetrievalCoverage: true, // 1 < MIN_RELEVANT_CHUNKS
      retrievedChunkCount: 1,
      singleChunkAnswerServed: true, // P3a strong-single served an answer
    }),
    false,
  );
});

Deno.test("audit label: served lexical-single (rescue) answer is NOT abstain", () => {
  assertEquals(
    deriveAuditAbstainFlag({
      ...BASE_ABSTAIN,
      insufficientRetrievalCoverage: true,
      retrievedChunkCount: 1,
      singleChunkAnswerServed: true, // P3b lexical rescue served an answer
    }),
    false,
  );
});

Deno.test("audit label: genuine insufficient coverage (no answer served) IS abstain", () => {
  assertEquals(
    deriveAuditAbstainFlag({
      ...BASE_ABSTAIN,
      insufficientRetrievalCoverage: true,
      retrievedChunkCount: 1,
      singleChunkAnswerServed: false, // weak/escalation single chunk → not served
    }),
    true,
  );
});

Deno.test("audit label: validation failure stays abstain even on a single-chunk path", () => {
  // A response replaced by a refusal is a real block — the served-answer
  // suppression must not apply.
  assertEquals(
    deriveAuditAbstainFlag({
      ...BASE_ABSTAIN,
      validationFailed: true,
      insufficientRetrievalCoverage: true,
      retrievedChunkCount: 1,
      singleChunkAnswerServed: true, // hostile input: must still be abstain
    }),
    true,
  );
});

Deno.test("audit label: zero chunks with indexed content IS abstain", () => {
  assertEquals(
    deriveAuditAbstainFlag({
      ...BASE_ABSTAIN,
      retrievedChunkCount: 0,
      hasDocsWithContent: true,
      singleChunkAnswerServed: true, // hostile input: cannot rescue empty retrieval
    }),
    true,
  );
});

Deno.test("audit label: zero chunks with NO indexed content is NOT abstain (empty-tenant exemption)", () => {
  assertEquals(
    deriveAuditAbstainFlag({
      ...BASE_ABSTAIN,
      retrievedChunkCount: 0,
      hasDocsWithContent: false,
    }),
    false,
  );
});

Deno.test("audit label: normal multi-chunk answered row is NOT abstain (parity with prior expression)", () => {
  assertEquals(deriveAuditAbstainFlag({ ...BASE_ABSTAIN }), false);
});
