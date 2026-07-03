import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  decideRetrievalAbstain,
  isStrongSingleChunkAnswer,
} from "./degradation.ts";
import {
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
