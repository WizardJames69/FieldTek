// ============================================================
// Sentinel AI eval harness — blocking-judge probe suite
// ============================================================
// An OPT-IN suite (run via `npx tsx evals/run.ts --judge-blocking-check`) whose
// only job is to prove the SYNCHRONOUS blocking judge does NOT harm a grounded
// answer: it must run, find the answer grounded, and emit judge_verdict="pass"
// (no warning, no block). It reuses the SAME committed, fixture-backed HVAC
// corpus as the 11-case benchmark — no new documents or embeddings.
//
// IMPORTANT: a --judge-blocking-check run only produces a meaningful verdict
// when `judge_blocking_mode` is enabled for the eval tenant. This PR does NOT
// enable judge_blocking_mode — the probe is wired and unit-proven offline, and a
// live blocking-judge proof is a separate, explicitly-approved step. When
// blocking mode is OFF, the blocking judge never runs and judge_verdict stays
// null, so the `verdict:"pass"` expectation is not met → the probe correctly
// FAILS (the intended signal).
//
// Unlike the advisory --judge-check probe (verdict is null in advisory mode),
// this asserts judge_verdict="pass" — the synchronous blocking-mode verdict for
// a grounded answer. The 11-case BENCHMARK_CASES suite is untouched.

import type { EvalCase } from "./types";

const HVAC = { industry: "hvac" } as const;

export const JUDGE_BLOCKING_PROBE_CASES: EvalCase[] = [
  {
    // Reuses EV-M-005's grounded question (HVAC Maintenance Best Practices),
    // which retrieves and answers reliably. Under judge_blocking_mode the
    // synchronous judge must find it grounded and emit verdict="pass" — proving
    // blocking mode leaves a grounded answer unchanged (no warn, no block).
    id: "EV-JUDGE-BLOCKING-PASS-001",
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
      verdict: "pass",
    },
  },
];
