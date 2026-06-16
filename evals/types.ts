// ============================================================
// Sentinel AI eval harness — type contracts (PR-2.1)
// ============================================================
// A "case" is one benchmark question with its expected grounding artifacts.
// An "observation" is what the runner saw when it actually asked the question
// (from the field-assistant response + its ai_audit_logs row). "Scoring" maps
// (case, observation) -> a per-case result; "aggregate" rolls results into
// report-level metrics. Scoring is pure and runner-agnostic so it can be unit
// tested without a live backend.

export type EvalCaseType =
  | "manual" // answerable from an uploaded manual/spec
  | "equipment_history" // answerable from equipment records
  | "service_history" // answerable from past jobs/parts
  | "must_abstain"; // NOT supported by any source — the assistant must abstain

export interface EvalExpectedSources {
  /** At least one of these document names should appear among retrieved/cited sources. */
  documentNames?: string[];
  /** Each substring should appear in the text of at least one retrieved chunk. */
  chunkIncludes?: string[];
}

export interface EvalCase {
  id: string;
  type: EvalCaseType;
  question: string;
  /** Optional context forwarded to field-assistant (industry, equipment, …). */
  context?: Record<string, unknown>;
  /** Retrieval expectation (omit for must_abstain). */
  expectedSources?: EvalExpectedSources;
  /** Substrings the answer should contain (answerable cases). */
  expectedFacts?: string[];
  /** True for must_abstain cases: a confident answer is a failure. */
  expectAbstain?: boolean;
}

/**
 * What the runner observed for one case. Populated from the field-assistant
 * response (streamed content, abstain/block flags, sources) plus the
 * ai_audit_logs row (semantic_search_count, chunk_ids → chunk texts,
 * had_citations, judge verdict). Decoupled from the API client so scoring is
 * testable in isolation.
 */
export interface EvalObservation {
  caseId: string;
  /** A substantive answer was produced (not an abstain/compliance block). */
  answered: boolean;
  /** The assistant explicitly abstained (insufficient retrieval coverage, etc.). */
  abstained: boolean;
  answerText: string;
  /** semantic_search_count — number of chunks retrieved. */
  retrievedChunkCount: number;
  /** Distinct document names among retrieved chunks. */
  retrievedDocNames: string[];
  /** Texts of the retrieved chunks (for chunk-level retrieval scoring). */
  retrievedChunkTexts: string[];
  /** Document names actually cited in the answer / sources list. */
  citedDocNames: string[];
  /** had_citations — the answer contained at least one [Source: …]. */
  hadCitations: boolean;
  /** judge_grounded from the LLM judge (null if judge did not run). */
  judgeGrounded: boolean | null;
  /** judge_verdict: pass | warn_appended | blocked (null if judge did not run). */
  judgeVerdict: string | null;
}

export interface EvalCaseResult {
  caseId: string;
  type: EvalCaseType;
  answered: boolean;
  /** Expected source appeared among retrieved chunks (null = not applicable). */
  retrievalHit: boolean | null;
  /** Answer cited a relevant retrieved/expected source (null = not applicable). */
  citationSupported: boolean | null;
  /** All expected facts present in the answer (null = not applicable). */
  factsCovered: boolean | null;
  /** must_abstain case correctly abstained (null = not a must_abstain case). */
  abstainCorrect: boolean | null;
  /** Confident answer where it should have abstained, or judge-flagged ungrounded. */
  hallucinated: boolean;
  /** Overall per-case pass (boolean expectations; thresholds arrive in PR-2.2). */
  passed: boolean;
}

export interface EvalMetrics {
  /** hits / cases-with-retrieval-expectation. */
  retrievalAccuracy: number | null;
  /** supported / answerable-cases-with-source-expectation. */
  citationSupport: number | null;
  /** covered / cases-with-expected-facts. */
  factCoverage: number | null;
  /** correctly-abstained / must_abstain cases. */
  abstainRate: number | null;
  /** hallucinated / answered cases. */
  hallucinationRate: number | null;
}

export interface EvalReport {
  /** ISO timestamp, stamped by the runner (kept out of pure scoring). */
  generatedAtIso: string;
  /** Project/corpus label for the run. */
  label: string;
  total: number;
  passed: number;
  metrics: EvalMetrics;
  cases: EvalCaseResult[];
}
