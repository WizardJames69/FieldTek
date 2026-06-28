import { describe, it, expect } from "vitest";
import {
  isJudgeObservationComplete,
  shouldWaitForJudge,
  pollUntilJudgeComplete,
  describeJudgeWait,
} from "../../../evals/observe";

// The async advisory judge (rag_judge) updates the ai_audit_logs row ~1s AFTER
// the row is first inserted, so `waitForAuditLog` (returns on first existence)
// observes judge_grounded=null and the --judge-check probe wrongly reports
// judgeRan=false. These pure helpers let the judge probe poll the SAME row until
// the judge fields reach a terminal state (or a bounded timeout), without
// touching the default 11-case path. No I/O — effects are injected, so the
// polling loop is unit-tested with a fake clock.

describe("isJudgeObservationComplete — terminal judge state (strict, no truthiness)", () => {
  it("judge_grounded=true is terminal", () => {
    expect(isJudgeObservationComplete({ judge_grounded: true })).toBe(true);
  });

  it("judge_grounded=false is terminal (a real, non-truthy boolean)", () => {
    expect(isJudgeObservationComplete({ judge_grounded: false })).toBe(true);
  });

  it("judge_grounded=null is NOT terminal — keep polling", () => {
    expect(isJudgeObservationComplete({ judge_grounded: null })).toBe(false);
  });

  it("an advisory judge with judge_verdict=null can still complete on grounded", () => {
    // Advisory mode never sets judge_verdict; grounding alone is terminal.
    expect(isJudgeObservationComplete({ judge_grounded: true, judge_verdict: null })).toBe(true);
  });

  it("all judge fields null/absent is NOT terminal", () => {
    expect(isJudgeObservationComplete({})).toBe(false);
    expect(isJudgeObservationComplete(null)).toBe(false);
    expect(isJudgeObservationComplete(undefined)).toBe(false);
    expect(isJudgeObservationComplete({ judge_grounded: null, judge_verdict: null })).toBe(false);
  });

  it("preserves future blocking-mode support: a real verdict is terminal even without grounded", () => {
    expect(isJudgeObservationComplete({ judge_verdict: "blocked" })).toBe(true);
    expect(isJudgeObservationComplete({ judge_verdict: "warn_appended" })).toBe(true);
    expect(isJudgeObservationComplete({ judge_verdict: "pass" })).toBe(true);
    // "none" is the not-yet-run placeholder — not terminal on its own.
    expect(isJudgeObservationComplete({ judge_verdict: "none" })).toBe(false);
  });
});

describe("shouldWaitForJudge — only judge probes pay the polling cost", () => {
  it("waits when --judge-check is active", () => {
    expect(shouldWaitForJudge({ judgeCheckActive: true, caseHasExpectedJudge: false })).toBe(true);
  });

  it("waits when the case carries an expectedJudge assertion", () => {
    expect(shouldWaitForJudge({ judgeCheckActive: false, caseHasExpectedJudge: true })).toBe(true);
  });

  it("does NOT wait for an ordinary 11-case observation (no extra polling latency)", () => {
    expect(shouldWaitForJudge({ judgeCheckActive: false, caseHasExpectedJudge: false })).toBe(false);
  });
});

// Deterministic fake clock: sleep advances virtual time; now() reads it. Lets us
// drive the bounded poll loop with no real delay and assert poll counts/timeout.
function fakeClock(startMs = 0) {
  let t = startMs;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

describe("pollUntilJudgeComplete — re-poll the same row until judge lands or timeout", () => {
  it("returns immediately when the initial row is already complete (no polling)", async () => {
    const clock = fakeClock();
    let fetches = 0;
    const result = await pollUntilJudgeComplete(
      { judge_grounded: true },
      async () => {
        fetches++;
        return { judge_grounded: true };
      },
      clock,
      { judgeTimeoutMs: 10000, pollIntervalMs: 500 },
    );
    expect(result.judgeComplete).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.polls).toBe(0);
    expect(fetches).toBe(0);
  });

  it("polls until a LATER judge update lands, then completes", async () => {
    const clock = fakeClock();
    // Row exists but judge has not run yet; the async judge lands on the 3rd poll.
    const rows: Array<Record<string, unknown>> = [
      { judge_grounded: null },
      { judge_grounded: null },
      { judge_grounded: true, judge_confidence: 5, judge_contradiction: false },
    ];
    let i = 0;
    const result = await pollUntilJudgeComplete(
      { judge_grounded: null },
      async () => rows[Math.min(i++, rows.length - 1)],
      clock,
      { judgeTimeoutMs: 10000, pollIntervalMs: 500 },
    );
    expect(result.judgeComplete).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.polls).toBe(3);
    expect(result.log).toMatchObject({ judge_grounded: true, judge_confidence: 5 });
  });

  it("times out CLEARLY when judge fields never populate — no hang, no silent pass", async () => {
    const clock = fakeClock();
    let fetches = 0;
    const result = await pollUntilJudgeComplete(
      { judge_grounded: null },
      async () => {
        fetches++;
        return { judge_grounded: null };
      },
      clock,
      { judgeTimeoutMs: 10000, pollIntervalMs: 500 },
    );
    expect(result.judgeComplete).toBe(false);
    expect(result.timedOut).toBe(true);
    // Bounded: ~timeout/interval polls, not infinite.
    expect(result.polls).toBe(20);
    expect(fetches).toBe(20);
    // The last observed row is preserved so the failure is diagnosable.
    expect(result.log).toMatchObject({ judge_grounded: null });
  });

  it("tolerates a transient null fetch (row briefly unreadable) and keeps polling", async () => {
    const clock = fakeClock();
    const rows: Array<Record<string, unknown> | null> = [
      null,
      { judge_grounded: null },
      { judge_grounded: false },
    ];
    let i = 0;
    const result = await pollUntilJudgeComplete(
      { judge_grounded: null },
      async () => rows[Math.min(i++, rows.length - 1)],
      clock,
      { judgeTimeoutMs: 10000, pollIntervalMs: 500 },
    );
    expect(result.judgeComplete).toBe(true);
    expect(result.polls).toBe(3);
    expect(result.log).toMatchObject({ judge_grounded: false });
  });
});

describe("describeJudgeWait — clear diagnostic for the probe log", () => {
  it("reports completion with the poll count", () => {
    const msg = describeJudgeWait("corr-123", {
      log: { judge_grounded: true },
      judgeComplete: true,
      timedOut: false,
      polls: 3,
      waitedMs: 1500,
    });
    expect(msg).toContain("corr-123");
    expect(msg.toLowerCase()).toContain("judge");
    expect(msg).toMatch(/complete|grounded/i);
  });

  it("reports a clear 'did not populate' diagnostic on timeout", () => {
    const msg = describeJudgeWait("corr-456", {
      log: { judge_grounded: null },
      judgeComplete: false,
      timedOut: true,
      polls: 20,
      waitedMs: 10000,
    });
    expect(msg).toContain("corr-456");
    expect(msg).toMatch(/did not populate/i);
  });
});
