// ============================================================
// Retrieval Adapters
// ============================================================
// PgVectorAdapter: wraps the existing search_document_chunks RPC.
// ExternalRetrievalAdapter: placeholder for future external backend.
// HybridRetrievalAdapter: shadow mode for A/B comparison.
//
// Backend selection: RETRIEVAL_BACKEND env var
//   'pgvector'  (default) — current implementation
//   'external'  — external retrieval platform
//   'shadow'    — run both, serve primary, log secondary
// ============================================================

import type {
  RetrievalAdapter,
  RetrievalQuery,
  RetrievalResponse,
  RetrievalResult,
} from "./types.ts";
import { rerankChunks } from "./rerank.ts";
import { LESSON_DOCUMENT_CATEGORY } from "./constants.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ── PgVector Adapter ─────────────────────────────────────────

export class PgVectorAdapter implements RetrievalAdapter {
  constructor(private client: SupabaseClient) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievalResponse> {
    const start = Date.now();

    const { data, error } = await this.client.rpc("search_document_chunks", {
      p_tenant_id: query.tenantId,
      p_query_embedding: `[${query.queryEmbedding.join(",")}]`,
      p_match_count: query.options.matchCount,
      p_match_threshold: query.options.matchThreshold,
      p_keyword_query: query.keywordQuery,
      p_equipment_type: query.filters.equipmentType || null,
      p_chunk_types: query.filters.chunkTypes || null,
      p_brand: query.filters.brand || null,
      p_model: query.filters.model || null,
      p_document_category: query.filters.documentCategory || null,
      p_embedding_model: query.filters.embeddingModel || null,
    });

    if (error) {
      throw new Error(`PgVector retrieval failed: ${error.message}`);
    }

    let results: RetrievalResult[] = (data || []).map(
      // deno-lint-ignore no-explicit-any
      (r: any) => ({
        id: r.id,
        documentId: r.document_id,
        chunkText: r.chunk_text,
        documentName: r.document_name,
        documentCategory: r.document_category,
        similarity: r.similarity,
        keywordRank: r.keyword_rank ?? null,
        chunkType: r.chunk_type,
        brand: r.brand ?? null,
        model: r.model ?? null,
        embeddingModel: r.embedding_model ?? "text-embedding-3-small",
        pageNumber: r.page_number ?? null,
        sectionName: r.section_name ?? null,
      })
    );

    // Lesson-citation gate: when the lesson_citations flag is OFF, drop
    // lesson-sourced chunks BEFORE reranking or counting so they can never be
    // cited and never help avoid abstain. Keyed on document_category because
    // search_document_chunks does not return documents.source (and we must not
    // change that RPC). Non-lesson chunks are unaffected.
    if (query.options.excludeLessonChunks) {
      const before = results.length;
      results = results.filter((r) => r.documentCategory !== LESSON_DOCUMENT_CATEGORY);
      if (results.length < before) {
        console.log(
          `[lesson-gate] lesson_citations off: dropped ${before - results.length} lesson chunk(s) (${before} → ${results.length})`,
        );
      }
    }

    // Cross-encoder re-ranking (if enabled and results warrant it)
    if (query.options.enableReranking && results.length > 2) {
      const reranked = await rerankChunks(
        query.keywordQuery || "",
        results,
        query.options.rerankTopN,
        query.correlationId,
      );

      return {
        results: reranked.results,
        backend: "pgvector",
        latencyMs: Date.now() - start,
        rerankModel: reranked.rerankModel,
        rerankLatencyMs: reranked.rerankLatencyMs,
        rerankScores: reranked.rerankScores,
        correlationId: query.correlationId,
      };
    }

    return {
      results,
      backend: "pgvector",
      latencyMs: Date.now() - start,
      rerankModel: null,
      rerankLatencyMs: null,
      rerankScores: null,
      correlationId: query.correlationId,
    };
  }
}

// ── Lexical Rescue (P3b) ─────────────────────────────────────
// Strict lexical rescue for semantic under-retrieval. NOT part of the
// RetrievalAdapter interface: it is pgvector-specific, only ever invoked by
// the orchestrator when the semantic pass returned fewer than
// MIN_RELEVANT_CHUNKS for a non-escalation query, and the RPC enforces the
// strict AND-match + rank/cosine floors server-side (see the
// lexical_rescue_chunks migration — this is not a threshold relaxation).

export interface LexicalRescueParams {
  tenantId: string;
  /** The already-computed semantic query embedding — never re-embed. */
  queryEmbedding: number[];
  /** The RAW user search query — never the graph-enriched keyword query
   *  (appended expansion terms would poison the strict AND-match). */
  keywordQuery: string;
  /** Chunk ids already retrieved semantically — never rescue duplicates. */
  excludeChunkIds: string[];
  /** Mirror of the semantic path's lesson gate (lesson_citations flag OFF). */
  excludeLessonChunks: boolean;
  minCosine: number;
  minRank: number;
  minLexemes: number;
  maxResults: number;
  correlationId: string;
}

export interface LexicalRescueChunk {
  id: string;
  documentId: string;
  chunkText: string;
  documentName: string;
  documentCategory: string;
  /** Honest raw cosine similarity (no hybrid blend). */
  rawCosine: number;
  /** Normalized (flag 32) ts_rank of the strict AND-match. */
  lexicalRank: number;
  chunkType: string;
  brand: string | null;
  model: string | null;
  embeddingModel: string;
  pageNumber: number | null;
  sectionName: string | null;
}

export async function lexicalRescueChunks(
  client: SupabaseClient,
  params: LexicalRescueParams,
): Promise<LexicalRescueChunk[]> {
  const { data, error } = await client.rpc("lexical_rescue_chunks", {
    p_tenant_id: params.tenantId,
    p_query_embedding: `[${params.queryEmbedding.join(",")}]`,
    p_keyword_query: params.keywordQuery,
    p_min_cosine: params.minCosine,
    p_min_rank: params.minRank,
    p_min_lexemes: params.minLexemes,
    p_max_results: params.maxResults,
    p_exclude_chunk_ids: params.excludeChunkIds.length > 0 ? params.excludeChunkIds : null,
  });

  if (error) {
    throw new Error(`Lexical rescue failed: ${error.message}`);
  }

  let results: LexicalRescueChunk[] = (data || []).map(
    // deno-lint-ignore no-explicit-any
    (r: any) => ({
      id: r.id,
      documentId: r.document_id,
      chunkText: r.chunk_text,
      documentName: r.document_name,
      documentCategory: r.document_category,
      rawCosine: r.raw_cosine,
      lexicalRank: r.lexical_rank,
      chunkType: r.chunk_type ?? "narrative",
      brand: r.brand ?? null,
      model: r.model ?? null,
      embeddingModel: r.embedding_model ?? "text-embedding-3-small",
      pageNumber: r.page_number ?? null,
      sectionName: r.section_name ?? null,
    }),
  );

  // Same lesson-citation gate as the semantic path: flag OFF → lesson-sourced
  // chunks can never be rescued, cited, or help avoid abstain.
  if (params.excludeLessonChunks) {
    const before = results.length;
    results = results.filter((r) => r.documentCategory !== LESSON_DOCUMENT_CATEGORY);
    if (results.length < before) {
      console.log(
        `[lexical-rescue] lesson_citations off: dropped ${before - results.length} lesson chunk(s) (${before} → ${results.length})`,
      );
    }
  }

  return results;
}

// ── External Retrieval Adapter (future) ──────────────────────

export class ExternalRetrievalAdapter implements RetrievalAdapter {
  constructor(
    private apiUrl: string,
    private apiKey: string
  ) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievalResponse> {
    const start = Date.now();

    const response = await fetch(`${this.apiUrl}/v1/retrieve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "X-Correlation-ID": query.correlationId,
      },
      body: JSON.stringify({
        tenant_id: query.tenantId,
        query_embedding: query.queryEmbedding,
        keyword_query: query.keywordQuery,
        filters: query.filters,
        top_k: query.options.matchCount,
        threshold: query.options.matchThreshold,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `External retrieval failed: ${response.status} ${response.statusText}`
      );
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await response.json();

    const results: RetrievalResult[] = (data.results || []).map(
      // deno-lint-ignore no-explicit-any
      (r: any) => ({
        id: r.id,
        documentId: r.document_id,
        chunkText: r.chunk_text,
        documentName: r.document_name,
        documentCategory: r.document_category,
        similarity: r.similarity,
        keywordRank: r.keyword_rank ?? null,
        chunkType: r.chunk_type ?? "narrative",
        brand: r.brand ?? null,
        model: r.model ?? null,
        embeddingModel: r.embedding_model ?? "unknown",
        pageNumber: r.page_number ?? null,
        sectionName: r.section_name ?? null,
      })
    );

    return {
      results,
      backend: "external",
      latencyMs: Date.now() - start,
      rerankModel: data.rerank_model || null,
      rerankLatencyMs: data.rerank_latency_ms || null,
      rerankScores: data.rerank_scores || null,
      correlationId: query.correlationId,
    };
  }
}

// ── Hybrid Adapter (shadow mode for A/B testing) ─────────────

export class HybridRetrievalAdapter implements RetrievalAdapter {
  constructor(
    private primary: RetrievalAdapter,
    private secondary: RetrievalAdapter
  ) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievalResponse> {
    // Shadow mode: run both, return primary, log secondary for comparison
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primary.retrieve(query),
      this.secondary.retrieve(query),
    ]);

    const primary =
      primaryResult.status === "fulfilled" ? primaryResult.value : null;
    const secondary =
      secondaryResult.status === "fulfilled" ? secondaryResult.value : null;

    if (secondary) {
      console.log(
        `[retrieval-shadow] correlation_id=${query.correlationId} ` +
          `primary_count=${primary?.results.length ?? 0} secondary_count=${secondary.results.length} ` +
          `primary_latency=${primary?.latencyMs ?? "N/A"}ms secondary_latency=${secondary.latencyMs}ms`
      );
    }

    if (!primary) {
      if (secondary) {
        return { ...secondary, backend: "external-fallback" };
      }
      throw new Error("Both retrieval backends failed");
    }

    return primary;
  }
}

// ── Factory ──────────────────────────────────────────────────

export function createRetrievalAdapter(
  serviceRoleClient: SupabaseClient
): RetrievalAdapter {
  const backendConfig =
    (typeof Deno !== "undefined"
      ? Deno.env.get("RETRIEVAL_BACKEND")
      : undefined) || "pgvector";

  switch (backendConfig) {
    case "external": {
      const url = Deno.env.get("EXTERNAL_RETRIEVAL_URL");
      const key = Deno.env.get("EXTERNAL_RETRIEVAL_KEY");
      if (!url || !key) {
        console.warn(
          "[retrieval] EXTERNAL_RETRIEVAL_URL/KEY not set, falling back to pgvector"
        );
        return new PgVectorAdapter(serviceRoleClient);
      }
      return new ExternalRetrievalAdapter(url, key);
    }
    case "shadow": {
      const url = Deno.env.get("EXTERNAL_RETRIEVAL_URL");
      const key = Deno.env.get("EXTERNAL_RETRIEVAL_KEY");
      if (!url || !key) {
        console.warn(
          "[retrieval] Shadow mode requires EXTERNAL_RETRIEVAL_URL/KEY, falling back to pgvector"
        );
        return new PgVectorAdapter(serviceRoleClient);
      }
      return new HybridRetrievalAdapter(
        new PgVectorAdapter(serviceRoleClient),
        new ExternalRetrievalAdapter(url, key)
      );
    }
    default:
      return new PgVectorAdapter(serviceRoleClient);
  }
}
