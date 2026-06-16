// ============================================================
// Sentinel AI eval harness — threshold gate (PR-2.2)
// ============================================================
// Turns aggregated EvalMetrics into a pass/fail verdict against absolute floors
// (and an optional no-regression check vs a baseline run). Pure and
// deterministic (no Date/IO) so it is unit-tested without a live backend and
// can back a CI ship-gate later (PR-2.3).
//
// Semantics:
//  - retrievalAccuracy / citationSupport / factCoverage / abstainRate are
//    "higher is better" → each must be >= its floor.
//  - hallucinationRate is "lower is better" → it must be <= its ceiling.
//  - A null metric (no applicable cases this run, e.g. no must_abstain cases)
//    is SKIPPED, never a violation — you can't fail a bar you didn't measure.
//  - Regression: with a baseline, a higher-is-better metric may not drop more
//    than `regressionTolerance` below baseline; hallucination may not rise more
//    than `regressionTolerance` above it.

import type { EvalMetrics } from "./types";

export interface EvalThresholds {
  /** Minimum acceptable retrieval accuracy (expected source in retrieved set). */
  retrievalAccuracy: number;
  /** Minimum acceptable citation support. */
  citationSupport: number;
  /** Minimum acceptable fact coverage. */
  factCoverage: number;
  /** Minimum acceptable abstain rate on must_abstain cases. */
  abstainRate: number;
  /** Maximum acceptable hallucination rate (lower is better). */
  hallucinationRate: number;
  /**
   * Allowed slip vs a baseline before it counts as a regression, as an absolute
   * rate delta (0.05 = a 5-percentage-point move in the wrong direction is OK).
   */
  regressionTolerance: number;
}

/** Master-plan floors: retrieval@k ≥ 0.8, abstain ≥ 0.9, hallucination ≤ 0.05. */
export const DEFAULT_THRESHOLDS: EvalThresholds = {
  retrievalAccuracy: 0.8,
  citationSupport: 0.8,
  factCoverage: 0.7,
  abstainRate: 0.9,
  hallucinationRate: 0.05,
  regressionTolerance: 0.05,
};

export type ThresholdMetric =
  | "retrievalAccuracy"
  | "citationSupport"
  | "factCoverage"
  | "abstainRate"
  | "hallucinationRate";

export type ViolationKind = "floor" | "ceiling" | "regression";

export interface ThresholdViolation {
  metric: ThresholdMetric;
  kind: ViolationKind;
  /** Observed value for the metric. */
  actual: number;
  /** The bound that was breached (floor, ceiling, or baseline-derived bound). */
  limit: number;
  message: string;
}

export interface ThresholdCheckResult {
  passed: boolean;
  violations: ThresholdViolation[];
}

/** Higher-is-better metrics share floor + downward-regression logic. */
const HIGHER_IS_BETTER: ThresholdMetric[] = [
  "retrievalAccuracy",
  "citationSupport",
  "factCoverage",
  "abstainRate",
];

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function checkThresholds(
  metrics: EvalMetrics,
  thresholds: EvalThresholds = DEFAULT_THRESHOLDS,
  baseline?: EvalMetrics | null,
): ThresholdCheckResult {
  const violations: ThresholdViolation[] = [];

  for (const metric of HIGHER_IS_BETTER) {
    const actual = metrics[metric];
    if (!isNum(actual)) continue; // not applicable this run → skip
    const floor = thresholds[metric];
    if (actual < floor) {
      violations.push({
        metric,
        kind: "floor",
        actual,
        limit: floor,
        message: `${metric} ${pct(actual)} is below floor ${pct(floor)}`,
      });
    }
    const base = baseline ? baseline[metric] : null;
    if (isNum(base)) {
      const bound = base - thresholds.regressionTolerance;
      if (actual < bound) {
        violations.push({
          metric,
          kind: "regression",
          actual,
          limit: bound,
          message:
            `${metric} ${pct(actual)} regressed vs baseline ${pct(base)} ` +
            `(allowed ≥ ${pct(bound)})`,
        });
      }
    }
  }

  // hallucinationRate — lower is better (ceiling + upward-regression).
  const h = metrics.hallucinationRate;
  if (isNum(h)) {
    const ceiling = thresholds.hallucinationRate;
    if (h > ceiling) {
      violations.push({
        metric: "hallucinationRate",
        kind: "ceiling",
        actual: h,
        limit: ceiling,
        message: `hallucinationRate ${pct(h)} exceeds ceiling ${pct(ceiling)}`,
      });
    }
    const base = baseline ? baseline.hallucinationRate : null;
    if (isNum(base)) {
      const bound = base + thresholds.regressionTolerance;
      if (h > bound) {
        violations.push({
          metric: "hallucinationRate",
          kind: "regression",
          actual: h,
          limit: bound,
          message:
            `hallucinationRate ${pct(h)} regressed vs baseline ${pct(base)} ` +
            `(allowed ≤ ${pct(bound)})`,
        });
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
