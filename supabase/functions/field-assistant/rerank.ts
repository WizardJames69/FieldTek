// ============================================================
// Cross-Encoder Re-ranking — Cohere rerank-v3.5
// ============================================================
// Post-retrieval re-ranking that applies query-specific relevance
// scoring using a cross-encoder model. This adds ~200ms per query
// but significantly improves retrieval precision vs. embedding
// similarity alone.
//
// Graceful degradation: if Cohere API fails or is unavailable,
// the original vector-similarity ranking is preserved.
// ============================================================

import type { RetrievalResult } from "./types.ts";

export interface RerankResponse {
  results: RetrievalResult[];
  rerankScores: number[];
  rerankModel: string;
  rerankLatencyMs: number;
}

const COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank";
const COHERE_MODEL = "rerank-v3.5";
const RERANK_TIMEOUT_MS = 3000;

/**
 * Re-rank retrieval results using Cohere cross-encoder.
 *
 * @param query       The user's original question
 * @param results     Retrieved chunks from vector search
 * @param topN        Maximum number of results to return after reranking
 * @param correlationId  Correlation ID for tracing
 * @returns Reranked results with scores, or original results if reranking fails
 */
export async function rerankChunks(
  query: string,
  results: RetrievalResult[],
  topN: number,
  correlationId: string,
): Promise<RerankResponse> {
  const cohereKey =
    (typeof Deno !== "undefined" ? Deno.env.get("COHERE_API_KEY") : undefined) ||
    null;

  // Skip reranking if no API key or too few results
  if (!cohereKey || results.length <= 2) {
    return {
      results,
      rerankScores: results.map((r) => r.similarity),
      rerankModel: "none",
      rerankLatencyMs: 0,
    };
  }

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);

    const response = await fetch(COHERE_RERANK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cohereKey}`,
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify({
        model: COHERE_MODEL,
        query,
        documents: results.map((r) => r.chunkText),
        top_n: Math.min(results.length, topN),
        return_documents: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const latencyMs = Date.now() - start;
      console.warn(
        `[rerank] [correlation_id=${correlationId}] API returned ${response.status}, using original order (${latencyMs}ms)`
      );
      return {
        results,
        rerankScores: results.map((r) => r.similarity),
        rerankModel: `${COHERE_MODEL}-failed`,
        rerankLatencyMs: latencyMs,
      };
    }

    const data = await response.json();
    const latencyMs = Date.now() - start;

    // Map reranked results back to original objects with updated similarity
    const reranked: RetrievalResult[] = [];
    const scores: number[] = [];

    for (const r of data.results as Array<{
      index: number;
      relevance_score: number;
    }>) {
      reranked.push({
        ...results[r.index],
        similarity: r.relevance_score,
      });
      scores.push(r.relevance_score);
    }

    console.log(
      `[rerank] [correlation_id=${correlationId}] Reranked ${results.length} → ${reranked.length} results in ${latencyMs}ms`
    );

    return {
      results: reranked,
      rerankScores: scores,
      rerankModel: COHERE_MODEL,
      rerankLatencyMs: latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.warn(
      `[rerank] [correlation_id=${correlationId}] Error after ${latencyMs}ms:`,
      err instanceof Error ? err.message : String(err)
    );
    return {
      results,
      rerankScores: results.map((r) => r.similarity),
      rerankModel: "error",
      rerankLatencyMs: latencyMs,
    };
  }
}
