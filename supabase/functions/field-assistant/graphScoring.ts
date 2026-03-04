// ============================================================
// Graph Relationship Scoring — Post-Retrieval Blending
// ============================================================
// Applies graph-derived component scores as a third factor
// in the retrieval scoring formula, re-sorting results by:
//
//   blended = (1 - graphWeight) × similarity + graphWeight × graphScore
//
// This runs AFTER retrieval + reranking, before content assembly.
// Pure function — no DB calls, no side effects.
// ============================================================

import type { GraphExpansionResult } from "./graph.ts";

interface ScoredChunk {
  id: string;
  chunk_text: string;
  document_name: string;
  document_category: string;
  similarity: number;
  keyword_rank: number | null;
  chunk_type: string;
  brand: string | null;
  model: string | null;
  embedding_model: string;
  graphScore: number;
}

/**
 * Apply graph relationship scoring to retrieval results.
 *
 * For each chunk, computes a graphScore by checking if the chunk
 * text mentions any component from the graph expansion. The final
 * similarity is re-blended using:
 *
 *   blended = (1 - graphWeight) × original_similarity + graphWeight × graphScore
 *
 * Results are re-sorted by blended score descending.
 */
export function applyGraphScoring(
  results: ScoredChunk[],
  graphData: GraphExpansionResult,
  graphWeight: number,
): ScoredChunk[] {
  if (results.length === 0 || graphData.componentScores.size === 0) {
    return results;
  }

  // Pre-compute lowercase component names for matching
  const componentEntries = Array.from(graphData.componentScores.entries());

  const scored = results.map((r) => {
    const textLower = r.chunk_text.toLowerCase();

    // Find max component score from chunk text mentions
    let maxScore = 0;
    for (const [componentName, weight] of componentEntries) {
      if (textLower.includes(componentName)) {
        maxScore = Math.max(maxScore, weight);
      }
    }

    const graphScore = maxScore;
    const blendedSimilarity =
      (1.0 - graphWeight) * r.similarity + graphWeight * graphScore;

    return {
      ...r,
      similarity: blendedSimilarity,
      graphScore,
    };
  });

  // Re-sort by blended score descending
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored;
}
