import { describe, it, expect } from "vitest";

// The eval threshold gate is pure (no Date/IO), so Vitest covers it and
// `npm run test` / CI catch regressions without a live backend — mirroring how
// src/test/evals/scoring.test.ts covers the scorer.
import {
  checkThresholds,
  DEFAULT_THRESHOLDS,
  type EvalThresholds,
} from "../../../evals/thresholds";
import type { EvalMetrics } from "../../../evals/types";

// A metrics object that comfortably clears the default floors/ceiling.
function passing(partial: Partial<EvalMetrics> = {}): EvalMetrics {
  return {
    retrievalAccuracy: 1,
    citationSupport: 1,
    factCoverage: 1,
    abstainRate: 1,
    hallucinationRate: 0,
    ...partial,
  };
}

describe("DEFAULT_THRESHOLDS", () => {
  it("encodes the master-plan floors and hallucination ceiling", () => {
    expect(DEFAULT_THRESHOLDS.retrievalAccuracy).toBeCloseTo(0.8);
    expect(DEFAULT_THRESHOLDS.abstainRate).toBeCloseTo(0.9);
    expect(DEFAULT_THRESHOLDS.hallucinationRate).toBeCloseTo(0.05);
    expect(DEFAULT_THRESHOLDS.regressionTolerance).toBeGreaterThan(0);
  });
});

describe("checkThresholds — absolute floors/ceiling", () => {
  it("passes when every applicable metric meets its floor / is under the ceiling", () => {
    const r = checkThresholds(passing());
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("flags a floor violation when a higher-is-better metric is below its floor", () => {
    const r = checkThresholds(passing({ retrievalAccuracy: 0.5 }));
    expect(r.passed).toBe(false);
    const v = r.violations.find((x) => x.metric === "retrievalAccuracy");
    expect(v?.kind).toBe("floor");
    expect(v?.actual).toBeCloseTo(0.5);
    expect(v?.limit).toBeCloseTo(DEFAULT_THRESHOLDS.retrievalAccuracy);
  });

  it("flags a ceiling violation when hallucination rate exceeds the ceiling", () => {
    const r = checkThresholds(passing({ hallucinationRate: 0.2 }));
    expect(r.passed).toBe(false);
    const v = r.violations.find((x) => x.metric === "hallucinationRate");
    expect(v?.kind).toBe("ceiling");
    expect(v?.actual).toBeCloseTo(0.2);
  });

  it("treats a metric exactly at its floor as passing (>= boundary)", () => {
    const r = checkThresholds(passing({ retrievalAccuracy: DEFAULT_THRESHOLDS.retrievalAccuracy }));
    expect(r.passed).toBe(true);
  });

  it("treats hallucination exactly at the ceiling as passing (<= boundary)", () => {
    const r = checkThresholds(passing({ hallucinationRate: DEFAULT_THRESHOLDS.hallucinationRate }));
    expect(r.passed).toBe(true);
  });

  it("reports every breached metric, not just the first", () => {
    const r = checkThresholds(
      passing({ retrievalAccuracy: 0.1, citationSupport: 0.1, hallucinationRate: 0.9 }),
    );
    const metrics = r.violations.map((v) => v.metric).sort();
    expect(metrics).toEqual(["citationSupport", "hallucinationRate", "retrievalAccuracy"]);
  });
});

describe("checkThresholds — not-applicable metrics", () => {
  it("skips null metrics (no applicable cases) instead of failing them", () => {
    // e.g. a run with no must_abstain cases → abstainRate is null.
    const r = checkThresholds(
      passing({ abstainRate: null, citationSupport: null }),
    );
    expect(r.passed).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("still fails an applicable metric even when another is null", () => {
    const r = checkThresholds(
      passing({ abstainRate: null, retrievalAccuracy: 0.2 }),
    );
    expect(r.passed).toBe(false);
    expect(r.violations.map((v) => v.metric)).toEqual(["retrievalAccuracy"]);
  });
});

describe("checkThresholds — regression vs baseline", () => {
  const lenient: EvalThresholds = {
    retrievalAccuracy: 0,
    citationSupport: 0,
    factCoverage: 0,
    abstainRate: 0,
    hallucinationRate: 1,
    regressionTolerance: 0.05,
  };

  it("flags a regression when a higher-is-better metric drops beyond tolerance", () => {
    const baseline = passing({ retrievalAccuracy: 0.9 });
    const current = passing({ retrievalAccuracy: 0.8 }); // -0.10 > 0.05 tolerance
    const r = checkThresholds(current, lenient, baseline);
    expect(r.passed).toBe(false);
    const v = r.violations.find((x) => x.metric === "retrievalAccuracy");
    expect(v?.kind).toBe("regression");
  });

  it("tolerates a small drop within tolerance", () => {
    const baseline = passing({ retrievalAccuracy: 0.9 });
    const current = passing({ retrievalAccuracy: 0.87 }); // -0.03 <= 0.05
    const r = checkThresholds(current, lenient, baseline);
    expect(r.passed).toBe(true);
  });

  it("flags a regression when hallucination rises beyond tolerance", () => {
    const baseline = passing({ hallucinationRate: 0.02 });
    const current = passing({ hallucinationRate: 0.1 }); // +0.08 > 0.05
    const r = checkThresholds(current, lenient, baseline);
    expect(r.passed).toBe(false);
    expect(r.violations.find((x) => x.metric === "hallucinationRate")?.kind).toBe("regression");
  });

  it("does not flag regression for a metric the baseline lacks (null)", () => {
    const baseline = passing({ retrievalAccuracy: null });
    const current = passing({ retrievalAccuracy: 0.5 });
    const r = checkThresholds(current, lenient, baseline);
    expect(r.passed).toBe(true);
  });

  it("an improvement vs baseline never regresses", () => {
    const baseline = passing({ retrievalAccuracy: 0.7, hallucinationRate: 0.2 });
    const current = passing({ retrievalAccuracy: 0.95, hallucinationRate: 0.0 });
    const r = checkThresholds(current, lenient, baseline);
    expect(r.passed).toBe(true);
  });
});

describe("checkThresholds — custom thresholds", () => {
  it("honours overridden floors", () => {
    const strict: EvalThresholds = { ...DEFAULT_THRESHOLDS, retrievalAccuracy: 0.99 };
    const r = checkThresholds(passing({ retrievalAccuracy: 0.95 }), strict);
    expect(r.passed).toBe(false);
    expect(r.violations[0].metric).toBe("retrievalAccuracy");
  });
});
