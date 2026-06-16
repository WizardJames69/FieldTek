// ============================================================
// Sentinel AI eval harness — enriched per-case report builder
// ============================================================
// Pure, deterministic (no IO/Date). Merges a case definition, its observation,
// and its scored result into ONE self-contained, diagnosable report row so a
// failed run can be triaged from the JSON report alone — the first live baseline
// review had to query ai_audit_logs because the report stored only booleans.
// Secret-safe: answerText/error are passed through a conservative redactor so a
// leaked token can never be persisted under evals/reports/. Unit-tested in
// src/test/evals/report.test.ts.

import type { EvalCase, EvalCaseReport, EvalCaseResult, EvalObservation } from "./types";

/**
 * Mask clearly-secret substrings (JWTs, Supabase `sb_*` keys, bearer tokens) so
 * reports never persist credentials. Conservative by design — it only touches
 * unmistakable token shapes, so real answer text (HVAC prose, `[Source:]`
 * markers, `65°F`, numbers) passes through unchanged.
 */
export function redactSecrets(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text ?? "";
  return text
    .replace(/eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, "[REDACTED_JWT]")
    .replace(/sb_[a-z]+_[A-Za-z0-9]{8,}/g, "[REDACTED_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [REDACTED]");
}

/**
 * Build the enriched, self-contained per-case report row. Carries the case
 * definition + the scored booleans + every diagnostic signal observed (cited
 * docs from BOTH the streamed metadata and the answer text, retrieved docs,
 * citation density, abstain/degraded flags, enforcement rules, similarity
 * scores, audit/correlation ids, and any error). Optional observation fields
 * default to null/[] so the offline self-test (whose synthetic observations omit
 * them) and the pure scorer are unaffected.
 */
export function buildCaseReport(
  c: EvalCase,
  obs: EvalObservation,
  result: EvalCaseResult,
): EvalCaseReport {
  return {
    ...result,
    question: c.question,
    expectedSources: c.expectedSources,
    expectedFacts: c.expectedFacts,
    answerText: redactSecrets(obs.answerText ?? ""),
    hadCitations: obs.hadCitations,
    citedDocNames: obs.citedDocNames ?? [],
    citedDocNamesFromMetadata: obs.citedDocNamesFromMetadata ?? [],
    citedDocNamesFromText: obs.citedDocNamesFromText ?? [],
    retrievedDocNames: obs.retrievedDocNames ?? [],
    citationDensity: obs.citationDensity ?? null,
    abstainFlag: obs.abstainFlag ?? null,
    degraded: obs.degraded ?? null,
    degradedReason: obs.degradedReason ?? null,
    enforcementRulesTriggered: obs.enforcementRulesTriggered ?? null,
    similarityScores: obs.similarityScores ?? null,
    auditLogId: obs.auditLogId ?? null,
    correlationId: obs.correlationId ?? null,
    error: obs.error ? redactSecrets(obs.error) : null,
  };
}
