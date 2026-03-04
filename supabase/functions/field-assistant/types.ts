// ============================================================
// Retrieval Abstraction Types
// ============================================================
// Decouples retrieval implementation from the generation pipeline.
// Enables backend swaps (pgvector → external) via env var without
// code changes, and supports A/B testing via shadow mode.
// ============================================================

export interface RetrievalFilters {
  equipmentType?: string;
  brand?: string;
  model?: string;
  documentCategory?: string;
  chunkTypes?: string[];
  embeddingModel?: string;
}

export interface RetrievalOptions {
  matchCount: number;
  matchThreshold: number;
  enableReranking: boolean;
  rerankTopN: number;
}

export interface RetrievalQuery {
  tenantId: string;
  queryEmbedding: number[];
  keywordQuery: string | null;
  filters: RetrievalFilters;
  options: RetrievalOptions;
  correlationId: string;
}

export interface RetrievalResult {
  id: string;
  documentId: string;
  chunkText: string;
  documentName: string;
  documentCategory: string;
  similarity: number;
  keywordRank: number | null;
  chunkType: string;
  brand: string | null;
  model: string | null;
  embeddingModel: string;
}

export interface RetrievalResponse {
  results: RetrievalResult[];
  backend: string;
  latencyMs: number;
  rerankModel: string | null;
  rerankLatencyMs: number | null;
  rerankScores: number[] | null;
  correlationId: string;
}

export interface RetrievalAdapter {
  retrieve(query: RetrievalQuery): Promise<RetrievalResponse>;
}
