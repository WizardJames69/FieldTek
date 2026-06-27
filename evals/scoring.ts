// ============================================================
// Sentinel AI eval harness — scoring (PR-2.1)
// ============================================================
// Pure, deterministic, runner-agnostic. Maps (case, observation) -> per-case
// result, and rolls results into report-level metrics. No I/O, no Date — so it
// is unit tested without a live backend (see src/test/evals/scoring.test.ts).

import type {
  EvalCase,
  EvalCaseResult,
  EvalExpectedJudge,
  EvalMetrics,
  EvalObservation,
} from "./types";

function norm(s: string): string {
  return s.toLowerCase().trim();
}

/** Case-insensitive "either contains the other" — tolerant of name variants. */
function looseMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function anyDocMatches(expected: string[], actual: string[]): boolean {
  return expected.some((e) => actual.some((a) => looseMatch(e, a)));
}

/**
 * Sole-source gate: every actual name must loosely match at least one allowed
 * name. Vacuously true for an empty actual list (the "expected doc retrieved"
 * check handles the empty case separately).
 */
function everyDocAllowed(actual: string[], allowed: string[]): boolean {
  return actual.every((a) => allowed.some((al) => looseMatch(a, al)));
}

function allSubstringsPresent(needles: string[], haystack: string): boolean {
  const h = norm(haystack);
  return needles.every((n) => h.includes(norm(n)));
}

/**
 * Did the LLM judge run for this observation? Both the async and blocking judge
 * paths set judge_grounded (and judge_model), so a non-null judgeGrounded means
 * it ran. The runner may also set judgeRan explicitly; honor that when present.
 */
export function judgeRanOf(obs: EvalObservation): boolean {
  if (obs.judgeRan === true) return true;
  if (obs.judgeRan === false) return false;
  return obs.judgeGrounded !== null && obs.judgeGrounded !== undefined;
}

/**
 * Evaluate an `expectedJudge` assertion against the observation. Returns true
 * only when EVERY specified expectation holds. Any expectation about the
 * verdict/grounding/contradiction/confidence implicitly requires the judge to
 * have run (an absent judge fails the probe — that is the point). Pure.
 */
export function evaluateJudgeExpectation(
  exp: EvalExpectedJudge,
  obs: EvalObservation,
): boolean {
  const ran = judgeRanOf(obs);

  if (exp.ran === true && !ran) return false;
  if (exp.ran === false && ran) return false;

  // Any verdict-level expectation needs the judge to have actually run.
  const needsRun =
    exp.grounded !== undefined ||
    exp.noContradiction !== undefined ||
    exp.minConfidence !== undefined ||
    exp.verdict !== undefined;
  if (needsRun && !ran) return false;

  if (exp.grounded === true && obs.judgeGrounded !== true) return false;
  if (exp.grounded === false && obs.judgeGrounded !== false) return false;
  if (exp.noContradiction === true && obs.judgeContradiction === true) return false;
  if (exp.minConfidence !== undefined && (obs.judgeConfidence ?? 0) < exp.minConfidence) {
    return false;
  }
  if (exp.verdict !== undefined && obs.judgeVerdict !== exp.verdict) return false;

  return true;
}

export function scoreCase(c: EvalCase, obs: EvalObservation): EvalCaseResult {
  const answerable = !c.expectAbstain && c.type !== "must_abstain";

  // ── Retrieval ────────────────────────────────────────────
  let retrievalHit: boolean | null = null;
  const expSrc = c.expectedSources;
  const hasRetrievalExpectation =
    !!expSrc &&
    ((expSrc.documentNames?.length ?? 0) > 0 ||
      (expSrc.chunkIncludes?.length ?? 0) > 0 ||
      (expSrc.onlyDocumentNames?.length ?? 0) > 0);
  if (hasRetrievalExpectation) {
    const docOk = expSrc!.documentNames?.length
      ? anyDocMatches(expSrc!.documentNames, obs.retrievedDocNames)
      : true;
    const chunkOk = expSrc!.chunkIncludes?.length
      ? allSubstringsPresent(expSrc!.chunkIncludes, obs.retrievedChunkTexts.join("\n"))
      : true;
    // Sole-source: no retrieved document may fall outside the allowlist.
    const retrievedOnlyOk = expSrc!.onlyDocumentNames?.length
      ? everyDocAllowed(obs.retrievedDocNames, expSrc!.onlyDocumentNames)
      : true;
    retrievalHit = docOk && chunkOk && retrievedOnlyOk;
  }

  // ── Citation support ─────────────────────────────────────
  let citationSupported: boolean | null = null;
  if (
    answerable &&
    ((expSrc?.documentNames?.length ?? 0) > 0 ||
      (expSrc?.onlyDocumentNames?.length ?? 0) > 0)
  ) {
    const citedExpectedOk = expSrc!.documentNames?.length
      ? anyDocMatches(expSrc!.documentNames, obs.citedDocNames)
      : true;
    // Sole-source: no cited document may fall outside the allowlist.
    const citedOnlyOk = expSrc!.onlyDocumentNames?.length
      ? everyDocAllowed(obs.citedDocNames, expSrc!.onlyDocumentNames)
      : true;
    citationSupported = obs.hadCitations && citedExpectedOk && citedOnlyOk;
  }

  // ── Fact coverage ────────────────────────────────────────
  let factsCovered: boolean | null = null;
  if (answerable && (c.expectedFacts?.length ?? 0) > 0) {
    factsCovered = allSubstringsPresent(c.expectedFacts!, obs.answerText);
  }

  // ── Abstain correctness ──────────────────────────────────
  let abstainCorrect: boolean | null = null;
  if (c.expectAbstain || c.type === "must_abstain") {
    abstainCorrect = obs.abstained;
  }

  // ── Hallucination ────────────────────────────────────────
  // Abstain case: answered confidently instead of abstaining.
  // Answerable case: produced an answer the judge flagged as ungrounded.
  const hallucinated = (c.expectAbstain || c.type === "must_abstain")
    ? obs.answered && !obs.abstained
    : obs.answered && obs.judgeGrounded === false;

  // ── Judge expectation (opt-in) ───────────────────────────
  // Only evaluated when the case carries `expectedJudge`. When omitted,
  // judgeChecked=false and judgePassed=null, and `passed` below is unaffected
  // (`null !== false` is true), so existing cases score exactly as before.
  const judgeChecked = c.expectedJudge !== undefined;
  const judgePassed: boolean | null = judgeChecked
    ? evaluateJudgeExpectation(c.expectedJudge!, obs)
    : null;

  // ── Overall pass ─────────────────────────────────────────
  let passed: boolean;
  if (c.expectAbstain || c.type === "must_abstain") {
    passed = obs.abstained && !hallucinated;
  } else {
    passed =
      obs.answered &&
      !hallucinated &&
      retrievalHit !== false &&
      citationSupported !== false &&
      factsCovered !== false;
  }
  // A present judge expectation that fails turns the whole case red.
  passed = passed && judgePassed !== false;

  return {
    caseId: c.id,
    type: c.type,
    answered: obs.answered,
    retrievalHit,
    citationSupported,
    factsCovered,
    abstainCorrect,
    hallucinated,
    judgeChecked,
    judgePassed,
    passed,
  };
}

function meanOf(
  results: EvalCaseResult[],
  pick: (r: EvalCaseResult) => boolean | null,
): number | null {
  const applicable = results.map(pick).filter((v): v is boolean => v !== null);
  if (applicable.length === 0) return null;
  const hits = applicable.filter((v) => v).length;
  return hits / applicable.length;
}

export function aggregate(results: EvalCaseResult[]): EvalMetrics {
  const answered = results.filter((r) => r.answered);
  return {
    retrievalAccuracy: meanOf(results, (r) => r.retrievalHit),
    citationSupport: meanOf(results, (r) => r.citationSupported),
    factCoverage: meanOf(results, (r) => r.factsCovered),
    abstainRate: meanOf(results, (r) => r.abstainCorrect),
    hallucinationRate:
      answered.length === 0
        ? null
        : answered.filter((r) => r.hallucinated).length / answered.length,
  };
}
