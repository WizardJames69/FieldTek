import { describe, it, expect } from "vitest";

// The eval harness lives under /evals (run ad-hoc via tsx) but its scoring is
// pure ES-module TypeScript, so Vitest imports it and `npm run test` / CI cover
// it — mirroring how src/test/lib/chunking.test.ts covers the _shared chunker.
import { scoreCase, aggregate } from "../../../evals/scoring";
import type { EvalCase, EvalObservation, EvalCaseResult } from "../../../evals/types";

// Convenience builders -------------------------------------------------------

function obs(partial: Partial<EvalObservation>): EvalObservation {
  return {
    caseId: "c",
    answered: true,
    abstained: false,
    answerText: "",
    retrievedChunkCount: 0,
    retrievedDocNames: [],
    retrievedChunkTexts: [],
    citedDocNames: [],
    hadCitations: false,
    judgeGrounded: null,
    judgeVerdict: null,
    ...partial,
  };
}

const manualCase: EvalCase = {
  id: "m1",
  type: "manual",
  question: "What refrigerant does the 24ACC6 use?",
  expectedSources: {
    documentNames: ["Carrier 24ACC6 Manual"],
    chunkIncludes: ["refrigerant charge"],
  },
  expectedFacts: ["R-410A"],
};

const abstainCase: EvalCase = {
  id: "a1",
  type: "must_abstain",
  question: "What is the airspeed velocity of an unladen swallow?",
  expectAbstain: true,
};

// scoreCase ------------------------------------------------------------------

describe("scoreCase — answerable (manual) cases", () => {
  it("passes when expected source is retrieved, cited, and the fact is present", () => {
    const r = scoreCase(
      manualCase,
      obs({
        retrievedDocNames: ["Carrier 24ACC6 Manual"],
        retrievedChunkTexts: ["The proper refrigerant charge is 6 lb 4 oz."],
        citedDocNames: ["Carrier 24ACC6 Manual"],
        hadCitations: true,
        answerText: "Use R-410A; the proper refrigerant charge is 6 lb 4 oz. [Source: Carrier 24ACC6 Manual p.12]",
        judgeGrounded: true,
      }),
    );
    expect(r.retrievalHit).toBe(true);
    expect(r.citationSupported).toBe(true);
    expect(r.factsCovered).toBe(true);
    expect(r.abstainCorrect).toBeNull();
    expect(r.hallucinated).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("fails retrieval when the expected document was not retrieved", () => {
    const r = scoreCase(
      manualCase,
      obs({
        retrievedDocNames: ["Unrelated Warranty Terms"],
        retrievedChunkTexts: ["Warranty is void if tampered with."],
        citedDocNames: ["Unrelated Warranty Terms"],
        hadCitations: true,
        answerText: "Use R-410A.",
        judgeGrounded: true,
      }),
    );
    expect(r.retrievalHit).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("fails fact coverage when an expected fact is missing from the answer", () => {
    const r = scoreCase(
      manualCase,
      obs({
        retrievedDocNames: ["Carrier 24ACC6 Manual"],
        retrievedChunkTexts: ["The proper refrigerant charge is 6 lb 4 oz."],
        citedDocNames: ["Carrier 24ACC6 Manual"],
        hadCitations: true,
        answerText: "I'm not sure which refrigerant; check the nameplate.",
        judgeGrounded: true,
      }),
    );
    expect(r.factsCovered).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("fails citation support when the answer has no citations", () => {
    const r = scoreCase(
      manualCase,
      obs({
        retrievedDocNames: ["Carrier 24ACC6 Manual"],
        retrievedChunkTexts: ["The proper refrigerant charge is 6 lb 4 oz."],
        citedDocNames: [],
        hadCitations: false,
        answerText: "Use R-410A.",
        judgeGrounded: true,
      }),
    );
    expect(r.citationSupported).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("counts a judge-ungrounded answer as a hallucination and a fail", () => {
    const r = scoreCase(
      manualCase,
      obs({
        retrievedDocNames: ["Carrier 24ACC6 Manual"],
        retrievedChunkTexts: ["The proper refrigerant charge is 6 lb 4 oz."],
        citedDocNames: ["Carrier 24ACC6 Manual"],
        hadCitations: true,
        answerText: "Use R-410A. [Source: Carrier 24ACC6 Manual]",
        judgeGrounded: false,
      }),
    );
    expect(r.hallucinated).toBe(true);
    expect(r.passed).toBe(false);
  });
});

describe("scoreCase — onlyDocumentNames (sole-source gate)", () => {
  const lessonCase: EvalCase = {
    id: "lesson1",
    type: "manual",
    question: "How do I clear the E5 firmware fault?",
    expectedSources: {
      documentNames: ["Approved Lesson: How do I clear the E5 firmware fault?"],
      chunkIncludes: ["E5 firmware fault"],
      onlyDocumentNames: ["Approved Lesson:"],
    },
    expectedFacts: ["MODE"],
  };

  const soleSourceObs = () =>
    obs({
      retrievedDocNames: ["Approved Lesson: How do I clear the E5 firmware fault?"],
      retrievedChunkTexts: ["Hold MODE and DOWN for 10 seconds to clear the E5 firmware fault."],
      citedDocNames: ["Approved Lesson: How do I clear the E5 firmware fault?"],
      hadCitations: true,
      answerText:
        "Hold MODE and DOWN for 10 seconds. [Source: Approved Lesson: How do I clear the E5 firmware fault?]",
      judgeGrounded: true,
    });

  it("passes when the lesson is the only retrieved AND cited source", () => {
    const r = scoreCase(lessonCase, soleSourceObs());
    expect(r.retrievalHit).toBe(true);
    expect(r.citationSupported).toBe(true);
    expect(r.factsCovered).toBe(true);
    expect(r.passed).toBe(true);
  });

  it("fails retrieval when a non-allowed document is also retrieved", () => {
    const o = soleSourceObs();
    o.retrievedDocNames = [...o.retrievedDocNames, "Carrier 24ACC636 Installation Manual"];
    const r = scoreCase(lessonCase, o);
    expect(r.retrievalHit).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("fails citation when a non-allowed document is also cited", () => {
    const o = soleSourceObs();
    o.citedDocNames = [...o.citedDocNames, "Warranty Terms - Carrier Equipment"];
    const r = scoreCase(lessonCase, o);
    expect(r.citationSupported).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("is backward-compatible: extra sources are allowed when onlyDocumentNames is absent", () => {
    const r = scoreCase(
      manualCase,
      obs({
        retrievedDocNames: ["Carrier 24ACC6 Manual", "Some Other Doc"],
        retrievedChunkTexts: ["The proper refrigerant charge is 6 lb 4 oz."],
        citedDocNames: ["Carrier 24ACC6 Manual", "Some Other Doc"],
        hadCitations: true,
        answerText: "Use R-410A; the proper refrigerant charge is 6 lb 4 oz. [Source: Carrier 24ACC6 Manual]",
        judgeGrounded: true,
      }),
    );
    expect(r.retrievalHit).toBe(true);
    expect(r.citationSupported).toBe(true);
    expect(r.passed).toBe(true);
  });
});

describe("scoreCase — must_abstain cases", () => {
  it("passes when the assistant correctly abstains", () => {
    const r = scoreCase(abstainCase, obs({ answered: false, abstained: true }));
    expect(r.abstainCorrect).toBe(true);
    expect(r.hallucinated).toBe(false);
    expect(r.retrievalHit).toBeNull();
    expect(r.citationSupported).toBeNull();
    expect(r.factsCovered).toBeNull();
    expect(r.passed).toBe(true);
  });

  it("fails (and flags a hallucination) when it answers instead of abstaining", () => {
    const r = scoreCase(
      abstainCase,
      obs({ answered: true, abstained: false, answerText: "About 24 miles per hour." }),
    );
    expect(r.abstainCorrect).toBe(false);
    expect(r.hallucinated).toBe(true);
    expect(r.passed).toBe(false);
  });
});

// aggregate ------------------------------------------------------------------

describe("aggregate", () => {
  it("computes each metric over its applicable denominator", () => {
    const results: EvalCaseResult[] = [
      // answered manual, all good
      { caseId: "1", type: "manual", answered: true, retrievalHit: true, citationSupported: true, factsCovered: true, abstainCorrect: null, hallucinated: false, passed: true },
      // answered manual, retrieval miss + hallucination
      { caseId: "2", type: "manual", answered: true, retrievalHit: false, citationSupported: false, factsCovered: true, abstainCorrect: null, hallucinated: true, passed: false },
      // must_abstain, correct
      { caseId: "3", type: "must_abstain", answered: false, retrievalHit: null, citationSupported: null, factsCovered: null, abstainCorrect: true, hallucinated: false, passed: true },
      // must_abstain, wrong (answered) → hallucinated
      { caseId: "4", type: "must_abstain", answered: true, retrievalHit: null, citationSupported: null, factsCovered: null, abstainCorrect: false, hallucinated: true, passed: false },
    ];
    const m = aggregate(results);
    expect(m.retrievalAccuracy).toBeCloseTo(0.5); // 1 of 2 applicable
    expect(m.citationSupport).toBeCloseTo(0.5); // 1 of 2 applicable
    expect(m.factCoverage).toBeCloseTo(1); // 2 of 2 applicable
    expect(m.abstainRate).toBeCloseTo(0.5); // 1 of 2 must_abstain
    expect(m.hallucinationRate).toBeCloseTo(2 / 3); // 2 hallucinated of 3 answered
  });

  it("returns null for a metric with no applicable cases", () => {
    const results: EvalCaseResult[] = [
      { caseId: "1", type: "must_abstain", answered: false, retrievalHit: null, citationSupported: null, factsCovered: null, abstainCorrect: true, hallucinated: false, passed: true },
    ];
    const m = aggregate(results);
    expect(m.retrievalAccuracy).toBeNull();
    expect(m.citationSupport).toBeNull();
    expect(m.factCoverage).toBeNull();
    expect(m.hallucinationRate).toBeNull(); // no answered cases
    expect(m.abstainRate).toBeCloseTo(1);
  });
});

// Judge expectations (feat/judge-eval-harness) -------------------------------
// A case may carry `expectedJudge` to assert the existing LLM judge actually ran
// and produced the right verdict. These assertions are OPT-IN: when a case omits
// `expectedJudge`, scoring is byte-for-byte unchanged (judgeChecked=false,
// judgePassed=null, `passed` unaffected). When present, judgePassed folds into
// `passed`. The judge probe is what proves judge wiring works without enabling
// rag_judge in production.

// A grounded answerable case that also asserts the judge ran and approved it.
const judgeProbeCase: EvalCase = {
  id: "jp1",
  type: "manual",
  question: "What refrigerant does the 24ACC6 use?",
  expectedSources: {
    documentNames: ["Carrier 24ACC6 Manual"],
    chunkIncludes: ["refrigerant charge"],
  },
  expectedFacts: ["R-410A"],
  expectedJudge: { ran: true, grounded: true, noContradiction: true, minConfidence: 3 },
};

// A fully-grounded observation that ALSO passes retrieval/citation/fact checks,
// so the only thing the judge expectation can change is judgePassed/passed.
function groundedProbeObs(partial: Partial<EvalObservation> = {}): EvalObservation {
  return obs({
    retrievedDocNames: ["Carrier 24ACC6 Manual"],
    retrievedChunkTexts: ["The proper refrigerant charge is 6 lb 4 oz."],
    citedDocNames: ["Carrier 24ACC6 Manual"],
    hadCitations: true,
    answerText: "Use R-410A; the proper refrigerant charge is 6 lb 4 oz. [Source: Carrier 24ACC6 Manual p.12]",
    judgeRan: true,
    judgeGrounded: true,
    judgeContradiction: false,
    judgeConfidence: 5,
    judgeVerdict: "pass",
    ...partial,
  });
}

describe("scoreCase — judge expectations", () => {
  it("omitted expectedJudge → judgeChecked=false, judgePassed=null, scoring unchanged", () => {
    const r = scoreCase(manualCase, groundedProbeObs());
    expect(r.judgeChecked).toBe(false);
    expect(r.judgePassed).toBeNull();
    expect(r.passed).toBe(true);
  });

  it("judge ran + grounded + no contradiction + confident → judgePassed=true and passes", () => {
    const r = scoreCase(judgeProbeCase, groundedProbeObs());
    expect(r.judgeChecked).toBe(true);
    expect(r.judgePassed).toBe(true);
    expect(r.passed).toBe(true);
  });

  it("judge did NOT run (judge_grounded null) but was expected → judgePassed=false, fail", () => {
    const r = scoreCase(
      judgeProbeCase,
      groundedProbeObs({ judgeRan: false, judgeGrounded: null, judgeContradiction: null, judgeConfidence: null, judgeVerdict: "none" }),
    );
    expect(r.judgePassed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("judge ran but ungrounded → judgePassed=false, fail", () => {
    const r = scoreCase(
      judgeProbeCase,
      groundedProbeObs({ judgeGrounded: false }),
    );
    expect(r.judgePassed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("judge detected a contradiction → judgePassed=false, fail", () => {
    const r = scoreCase(
      judgeProbeCase,
      groundedProbeObs({ judgeContradiction: true }),
    );
    expect(r.judgePassed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("judge confidence below minConfidence → judgePassed=false, fail", () => {
    const r = scoreCase(
      judgeProbeCase,
      groundedProbeObs({ judgeConfidence: 2 }),
    );
    expect(r.judgePassed).toBe(false);
    expect(r.passed).toBe(false);
  });

  it("supports a future blocking assertion via expectedJudge.verdict (no live case here)", () => {
    const blockingCase: EvalCase = {
      ...judgeProbeCase,
      id: "jp-block",
      expectedJudge: { ran: true, verdict: "blocked" },
    };
    // verdict "pass" does not satisfy an expected "blocked" verdict.
    expect(scoreCase(blockingCase, groundedProbeObs()).judgePassed).toBe(false);
    // verdict "blocked" satisfies it.
    expect(scoreCase(blockingCase, groundedProbeObs({ judgeVerdict: "blocked" })).judgePassed).toBe(true);
  });

  it("an existing must_abstain case is unaffected by judge machinery", () => {
    const r = scoreCase(abstainCase, obs({ answered: false, abstained: true }));
    expect(r.judgeChecked).toBe(false);
    expect(r.judgePassed).toBeNull();
    expect(r.passed).toBe(true);
  });
});
