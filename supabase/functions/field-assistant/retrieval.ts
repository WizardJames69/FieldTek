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

    const results: RetrievalResult[] = (data || []).map(
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
      })
    );

    return {
      results,
      backend: "pgvector",
      latencyMs: Date.now() - start,
      rerankModel: null,
      rerankLatencyMs: null,
      correlationId: query.correlationId,
    };
  }
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
      })
    );

    return {
      results,
      backend: "external",
      latencyMs: Date.now() - start,
      rerankModel: data.rerank_model || null,
      rerankLatencyMs: data.rerank_latency_ms || null,
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
