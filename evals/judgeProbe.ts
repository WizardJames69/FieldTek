// ============================================================
// Sentinel AI eval harness — judge probe suite (feat/judge-eval-harness)
// ============================================================
// An OPT-IN suite (run via `npx tsx evals/run.ts --judge-check`) whose only job
// is to prove the existing LLM judge actually ran and produced a sound verdict.
// It reuses the SAME committed, fixture-backed HVAC corpus as the 11-case
// benchmark (no new documents, no new embeddings), so a judge run costs only the
// judge's own tokens on top of the answer.
//
// IMPORTANT: a --judge-check run only produces meaningful verdicts when the
// `rag_judge` flag is enabled for the eval tenant. This PR does NOT enable
// rag_judge or judge_blocking_mode — the probe is wired and unit-proven offline,
// and a live advisory-judge proof is a separate, explicitly-approved step. When
// the judge is OFF, the probe correctly FAILS (judge_grounded stays null →
// `ran:true` expectation is not met), which is the intended signal.
//
// The 11-case BENCHMARK_CASES suite is untouched and remains the default.

import type { EvalCase } from "./types";

const HVAC = { industry: "hvac" } as const;

export const JUDGE_PROBE_CASES: EvalCase[] = [
  {
    // Reuses EV-M-005's grounded question (HVAC Maintenance Best Practices),
    // which retrieves and answers reliably, then asserts the judge ran and
    // approved the grounded answer with no contradiction.
    id: "EV-JUDGE-GROUNDED-001",
    type: "manual",
    question: "What are the recommended maintenance intervals?",
    context: HVAC,
    expectedSources: {
      documentNames: ["HVAC Maintenance Best Practices"],
      chunkIncludes: ["maintenance interval"],
    },
    expectedFacts: ["quarterly"],
    expectedJudge: {
      ran: true,
      grounded: true,
      noContradiction: true,
      minConfidence: 3,
    },
  },
];
