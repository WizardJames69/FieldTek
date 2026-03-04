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

// ── Assistant Message Types ─────────────────────────────────

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string } };
export type MessageContent = string | Array<TextContent | ImageContent>;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: MessageContent;
}

// ── Service History Types ───────────────────────────────────

export interface ServiceJob {
  id: string;
  title: string;
  job_type: string | null;
  status: string;
  scheduled_date: string | null;
  description: string | null;
  notes: string | null;
  internal_notes: string | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
}

export interface PartHistoryEntry {
  part_name: string;
  part_number: string | null;
  quantity: number;
  notes: string | null;
  created_at: string;
  scheduled_jobs: { id: string; title: string; scheduled_date: string | null; equipment_id: string } | { id: string; title: string; scheduled_date: string | null; equipment_id: string }[] | null;
}

// ── Parts Prediction Types ──────────────────────────────────

export interface PartPrediction {
  part_name: string;
  part_number: string | null;
  confidence: number;
  reason: string;
  usage_count: number;
  last_used: string;
}

export interface PartUsageStats {
  part_name: string;
  part_number: string | null;
  total_usage: number;
  equipment_type_usage: number;
  symptom_correlation: number;
  brand_usage: number;
  recent_usage: number;
  last_used: string;
}

export interface PartsPredictionContext {
  equipmentType: string | null;
  brand: string | null;
  model: string | null;
  jobType: string | null;
  currentSymptoms: string[];
}

export interface TenantPartsData {
  part_name: string;
  part_number: string | null;
  quantity: number;
  created_at: string;
  job_type: string | null;
  job_description: string | null;
  job_notes: string | null;
  equipment_type: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
}

// ── Symptom Tracking Types ──────────────────────────────────

export interface SymptomOccurrence {
  category: string;
  label: string;
  count: number;
  occurrences: { date: string; jobTitle: string; excerpt: string }[];
}

// ── Compliance Engine Types ─────────────────────────────────

export interface ComplianceVerdictSummary {
  ruleName: string;
  ruleKey: string;
  verdict: "pass" | "fail" | "warn" | "block";
  severity: "info" | "warning" | "blocking" | "critical";
  explanation: string;
  codeReferences: string[];
}

export interface WorkflowComplianceContext {
  currentStage: string;
  completedStages: string[];
  verdicts: ComplianceVerdictSummary[];
  blockingIssues: string[];
}
