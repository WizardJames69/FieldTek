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
  /**
   * Sole-source allowlist. When set, EVERY retrieved AND cited document name must
   * loosely match one of these — i.e. no source outside this list may contribute.
   * Used to assert a single document (e.g. an approved lesson) is the ONLY
   * supporting source. Backward-compatible: omit it and scoring is unchanged.
   */
  onlyDocumentNames?: string[];
}

/**
 * Optional assertions about the existing LLM judge (judge.ts → ai_audit_logs
 * judge_* columns). Used by the opt-in `--judge-check` probe to prove the judge
 * actually ran and reached the right verdict, WITHOUT enabling rag_judge in
 * production. Every field is optional and only checked when present.
 * Backward-compatible: a case that omits `expectedJudge` scores exactly as before.
 */
export interface EvalExpectedJudge {
  /** The judge must have run for this case (judge_grounded non-null / judge_model set). */
  ran?: boolean;
  /** judge_grounded must equal this. */
  grounded?: boolean;
  /** judge_contradiction must be false (no contradiction detected). */
  noContradiction?: boolean;
  /** judge_confidence must be >= this (clamped 1–5 by the judge). */
  minConfidence?: number;
  /**
   * Future blocking assertion: required judge_verdict
   * ("pass" | "warn_appended" | "blocked"). Harness support only — no live
   * blocking case ships in this PR and blocking is NOT enabled here.
   */
  verdict?: string;
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
  /**
   * Opt-in judge assertion. Omit it and scoring is unchanged; set it (e.g. in
   * the --judge-check probe) to assert the judge ran and approved the answer.
   */
  expectedJudge?: EvalExpectedJudge;
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
  /** judge_verdict: none | pass | warn_appended | blocked (null if not persisted). */
  judgeVerdict: string | null;
  /** judge_contradiction from the LLM judge (null if judge did not run). */
  judgeContradiction?: boolean | null;
  /** judge_confidence 1–5 from the LLM judge (null if judge did not run). */
  judgeConfidence?: number | null;
  /**
   * Whether the judge ran at all. Derived by the runner from the audit row
   * (judge_grounded non-null or judge_model present). Optional/undefined for
   * synthetic observations that don't set it — scoring falls back to
   * judgeGrounded !== null.
   */
  judgeRan?: boolean | null;

  // ── Diagnostic fields (optional; populated by the live runner for the
  //    enriched report). Kept optional so the pure scorer + its tests are
  //    unaffected — scoring reads only the fields above. ──────────────────
  /** Cited doc names taken from the streamed `metadata.sources` array. */
  citedDocNamesFromMetadata?: string[];
  /** Cited doc names parsed from the answer text's `[Source: …]` markers. */
  citedDocNamesFromText?: string[];
  /** ai_audit_logs.citation_density (`[Source:]` markers per 1k chars). */
  citationDensity?: number | null;
  /** ai_audit_logs.abstain_flag (validation failed / insufficient coverage / fallback). */
  abstainFlag?: boolean | null;
  /** Streamed `metadata.degraded` — answer served from the full-doc fallback. */
  degraded?: boolean | null;
  /** Streamed `metadata.degraded_reason`. */
  degradedReason?: string | null;
  /** ai_audit_logs.enforcement_rules_triggered. */
  enforcementRulesTriggered?: string[] | null;
  /** ai_audit_logs.similarity_scores (retrieved-chunk cosine scores). */
  similarityScores?: number[] | null;
  /** ai_audit_logs.id for the row this observation came from. */
  auditLogId?: string | null;
  /** correlation_id from the streamed metadata. */
  correlationId?: string | null;
  /** Any model/API/transport error captured while observing this case. */
  error?: string | null;
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
  /** True when the case carried an `expectedJudge` assertion (judge probe). */
  judgeChecked: boolean;
  /** All judge expectations held (null = no expectedJudge → not applicable). */
  judgePassed: boolean | null;
  /** Overall per-case pass (boolean expectations; thresholds arrive in PR-2.2). */
  passed: boolean;
}

/**
 * A self-contained, diagnosable per-case row for the JSON report. Extends the
 * scored result with the case definition + the diagnostic signals observed, so a
 * failed run can be triaged from the report ALONE (the first baseline review had
 * to query ai_audit_logs because the report stored only booleans). Built by
 * evals/report.ts → buildCaseReport. Secret-safe: answerText/error are redacted.
 */
export interface EvalCaseReport extends EvalCaseResult {
  question: string;
  expectedSources?: EvalExpectedSources;
  expectedFacts?: string[];
  answerText: string;
  hadCitations: boolean;
  /** Effective cited docs used by the scorer (metadata ∪ text-parsed). */
  citedDocNames: string[];
  citedDocNamesFromMetadata: string[];
  citedDocNamesFromText: string[];
  retrievedDocNames: string[];
  citationDensity: number | null;
  abstainFlag: boolean | null;
  degraded: boolean | null;
  degradedReason: string | null;
  enforcementRulesTriggered: string[] | null;
  similarityScores: number[] | null;
  auditLogId: string | null;
  correlationId: string | null;
  error: string | null;
  // ── Judge signals (for judge-probe runs; null/absent on normal runs where
  //    the judge is off). Surfaced so a --judge-check failure is diagnosable
  //    from the report alone. ──
  judgeRan: boolean | null;
  judgeGrounded: boolean | null;
  judgeContradiction: boolean | null;
  judgeConfidence: number | null;
  judgeVerdict: string | null;
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
  cases: EvalCaseReport[];
}
