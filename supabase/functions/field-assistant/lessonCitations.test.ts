import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildSourceCitations } from "./helpers.ts";
import { PgVectorAdapter } from "./retrieval.ts";
import { LESSON_DOCUMENT_CATEGORY } from "./constants.ts";
import type { RetrievalQuery } from "./types.ts";

// PR-3b lesson-citation gate + label. Pure-ish: buildSourceCitations is
// side-effect-free; the adapter is exercised with a stub client so no network
// or DB is touched. Run via `deno test --allow-env`.

// ── Citation labeling ──────────────────────────────────────────────────────
Deno.test("buildSourceCitations labels lesson-sourced chunks as 'lesson'", () => {
  const [citation] = buildSourceCitations([
    {
      document_id: "doc-lesson",
      document_name: "Approved Lesson: why short-cycling?",
      document_category: LESSON_DOCUMENT_CATEGORY,
      similarity: 0.9,
    },
  ]);
  assertEquals(citation.source_type, "lesson");
});

Deno.test("buildSourceCitations labels other categories as 'document'", () => {
  const [manual] = buildSourceCitations([
    { document_id: "d1", document_name: "Carrier Manual", document_category: "Manual", similarity: 0.8 },
  ]);
  assertEquals(manual.source_type, "document");

  const [noCategory] = buildSourceCitations([
    { document_id: "d2", document_name: "Some Doc", similarity: 0.7 },
  ]);
  assertEquals(noCategory.source_type, "document");
});

// ── Retrieval-time exclusion ────────────────────────────────────────────────
function stubClient(rows: Record<string, unknown>[]) {
  return {
    rpc: (_name: string, _params: unknown) => Promise.resolve({ data: rows, error: null }),
  };
}

function row(id: string, category: string, similarity: number) {
  return {
    id,
    document_id: `doc-${id}`,
    chunk_text: `chunk ${id}`,
    document_name: category === LESSON_DOCUMENT_CATEGORY ? `Approved Lesson: ${id}` : `Manual ${id}`,
    document_category: category,
    similarity,
    keyword_rank: null,
    chunk_type: "narrative",
    brand: null,
    model: null,
    embedding_model: "text-embedding-3-small",
    page_number: null,
    section_name: null,
  };
}

function query(excludeLessonChunks: boolean): RetrievalQuery {
  return {
    tenantId: "tenant-1",
    queryEmbedding: [0.1, 0.2, 0.3],
    keywordQuery: null,
    filters: {},
    options: {
      matchCount: 15,
      matchThreshold: 0.5,
      enableReranking: false,
      rerankTopN: 8,
      excludeLessonChunks,
    },
    correlationId: "corr-1",
  };
}

Deno.test("flag OFF: lesson chunks are dropped before they can count or be cited", async () => {
  const rows = [
    row("a", "Manual", 0.95),
    row("b", LESSON_DOCUMENT_CATEGORY, 0.92),
    row("c", LESSON_DOCUMENT_CATEGORY, 0.80),
  ];
  // deno-lint-ignore no-explicit-any
  const adapter = new PgVectorAdapter(stubClient(rows) as any);
  const res = await adapter.retrieve(query(true));

  assertEquals(res.results.length, 1, "only the non-lesson chunk should remain");
  assertEquals(res.results[0].documentCategory, "Manual");
  assert(
    res.results.every((r) => r.documentCategory !== LESSON_DOCUMENT_CATEGORY),
    "no lesson chunk may survive when the flag is off",
  );
});

Deno.test("flag ON: lesson chunks remain eligible alongside documents", async () => {
  const rows = [
    row("a", "Manual", 0.95),
    row("b", LESSON_DOCUMENT_CATEGORY, 0.92),
  ];
  // deno-lint-ignore no-explicit-any
  const adapter = new PgVectorAdapter(stubClient(rows) as any);
  const res = await adapter.retrieve(query(false));

  assertEquals(res.results.length, 2);
  assert(res.results.some((r) => r.documentCategory === LESSON_DOCUMENT_CATEGORY));
});

Deno.test("non-lesson chunks are unaffected by the gate", async () => {
  const rows = [row("a", "Manual", 0.95), row("b", "Warranty", 0.9)];
  // deno-lint-ignore no-explicit-any
  const adapter = new PgVectorAdapter(stubClient(rows) as any);
  const off = await adapter.retrieve(query(true));
  const on = await adapter.retrieve(query(false));
  assertEquals(off.results.length, 2);
  assertEquals(on.results.length, 2);
});
