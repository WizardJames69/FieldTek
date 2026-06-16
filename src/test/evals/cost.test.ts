import { describe, it, expect } from "vitest";

// Pure per-run token budget guard for live eval runs — no IO, unit-tested so the
// "stop before overspending" semantics are pinned without a live backend.
import { createCostTracker, sumTokens } from "../../../evals/cost";

describe("createCostTracker — unlimited (null budget)", () => {
  it("always has room and reports Infinity remaining", () => {
    const t = createCostTracker(null);
    expect(t.hasRoom()).toBe(true);
    t.record(1_000_000);
    expect(t.hasRoom()).toBe(true);
    expect(t.remaining()).toBe(Infinity);
    expect(t.spent()).toBe(1_000_000);
  });
});

describe("createCostTracker — capped budget", () => {
  it("accumulates spend and computes remaining", () => {
    const t = createCostTracker(1000);
    expect(t.spent()).toBe(0);
    expect(t.remaining()).toBe(1000);
    t.record(300);
    expect(t.spent()).toBe(300);
    expect(t.remaining()).toBe(700);
  });

  it("has room while under budget and runs out once the cap is reached", () => {
    const t = createCostTracker(500);
    expect(t.hasRoom()).toBe(true);
    t.record(499);
    expect(t.hasRoom()).toBe(true); // still 1 token of room
    t.record(1);
    expect(t.hasRoom()).toBe(false); // exactly at cap → no room for another case
    expect(t.remaining()).toBe(0);
  });

  it("clamps remaining at zero after overshoot", () => {
    const t = createCostTracker(500);
    t.record(700); // a single case can overshoot; we still stop afterwards
    expect(t.hasRoom()).toBe(false);
    expect(t.remaining()).toBe(0);
    expect(t.spent()).toBe(700);
  });

  it("ignores negative / non-finite token records", () => {
    const t = createCostTracker(1000);
    t.record(-50);
    t.record(Number.NaN);
    t.record(Number.POSITIVE_INFINITY);
    expect(t.spent()).toBe(0);
  });
});

describe("sumTokens", () => {
  it("sums finite non-negative values and ignores the rest", () => {
    expect(sumTokens(100, 50)).toBe(150);
    expect(sumTokens(100, null, undefined, 25)).toBe(125);
    expect(sumTokens(-10, Number.NaN, 40)).toBe(40);
    expect(sumTokens()).toBe(0);
  });
});
