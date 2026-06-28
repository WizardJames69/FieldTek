import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  decideJudgeVerdict,
  JUDGE_FULL_BLOCK_FALLBACK,
  JUDGE_WARNING_NOTICE,
  type JudgeVerdictDecision,
} from "./judgeVerdict.ts";
import type { JudgeResult } from "./judge.ts";

// Pure, deterministic mapping of a blocking-judge result + flag state to a
// verdict ("none" | "pass" | "warn_appended" | "blocked") and the two effect
// drivers (shouldWarn / shouldBlock) that index.ts applies. No model, no I/O —
// run via `deno test --allow-env`. This is the deterministic core of the
// blocking-judge proof: it preserves the inline index.ts thresholds exactly
// (>=4 warn, >=5 full-block) without enabling any flag or hitting OpenAI.

function res(
  grounded: boolean,
  confidence: number,
  contradiction = false,
): JudgeResult {
  return { grounded, confidence, contradiction_detected: contradiction, explanation: "x" };
}

const BLOCKING = { blockingEnabled: true, fullBlockingEnabled: false };
const FULL = { blockingEnabled: false, fullBlockingEnabled: true };
const BOTH = { blockingEnabled: true, fullBlockingEnabled: true };
const NEITHER = { blockingEnabled: false, fullBlockingEnabled: false };

function expect(d: JudgeVerdictDecision, verdict: string, warn: boolean, block: boolean) {
  assertEquals(d.verdict, verdict);
  assertEquals(d.shouldWarn, warn);
  assertEquals(d.shouldBlock, block);
}

// ── Verdict matrix (mirrors the §6 plan table) ──────────────────────────────

Deno.test("grounded + confidence 5, blocking only → pass", () => {
  expect(decideJudgeVerdict(res(true, 5), BLOCKING), "pass", false, false);
});

Deno.test("grounded + confidence 5, full blocking → pass", () => {
  expect(decideJudgeVerdict(res(true, 5), FULL), "pass", false, false);
});

Deno.test("ungrounded + confidence 3 → pass (below warn threshold)", () => {
  expect(decideJudgeVerdict(res(false, 3), BOTH), "pass", false, false);
});

Deno.test("ungrounded + confidence 4, blocking → warn_appended", () => {
  expect(decideJudgeVerdict(res(false, 4), BLOCKING), "warn_appended", true, false);
});

Deno.test("ungrounded + confidence 5, blocking only → warn_appended (no full-block flag)", () => {
  expect(decideJudgeVerdict(res(false, 5), BLOCKING), "warn_appended", true, false);
});

Deno.test("ungrounded + confidence 4, full blocking → warn_appended (>=4 warns even under full flag)", () => {
  expect(decideJudgeVerdict(res(false, 4), FULL), "warn_appended", true, false);
});

Deno.test("ungrounded + confidence 5, full blocking → blocked", () => {
  expect(decideJudgeVerdict(res(false, 5), FULL), "blocked", false, true);
});

Deno.test("both flags + ungrounded confidence 5 → blocked (full blocking precedence)", () => {
  expect(decideJudgeVerdict(res(false, 5), BOTH), "blocked", false, true);
});

Deno.test("both flags disabled → none (judge not consulted)", () => {
  expect(decideJudgeVerdict(res(false, 5), NEITHER), "none", false, false);
});

Deno.test("null / failed judge result → none, fail-open", () => {
  expect(decideJudgeVerdict(null, BOTH), "none", false, false);
  expect(decideJudgeVerdict(null, BLOCKING), "none", false, false);
});

// ── Exact confidence boundaries ─────────────────────────────────────────────

Deno.test("confidence boundary 4 is the warn threshold; 3 stays pass", () => {
  expect(decideJudgeVerdict(res(false, 3), BLOCKING), "pass", false, false);
  expect(decideJudgeVerdict(res(false, 4), BLOCKING), "warn_appended", true, false);
});

Deno.test("confidence boundary 5 is the full-block threshold; 4 stays warn under full flag", () => {
  expect(decideJudgeVerdict(res(false, 4), FULL), "warn_appended", true, false);
  expect(decideJudgeVerdict(res(false, 5), FULL), "blocked", false, true);
});

// ── Contradiction must NOT alter the grounded/confidence mapping ─────────────

Deno.test("contradiction_detected does not change a grounded pass", () => {
  expect(decideJudgeVerdict(res(true, 5, true), BOTH), "pass", false, false);
});

Deno.test("contradiction_detected does not change an ungrounded warn/block", () => {
  expect(decideJudgeVerdict(res(false, 4, true), BLOCKING), "warn_appended", true, false);
  expect(decideJudgeVerdict(res(false, 5, true), FULL), "blocked", false, true);
});

// ── Index-level application: the texts index.ts applies are pinned here so an
//    accidental future edit to the fallback/warning wording fails this test. ──

Deno.test("blocked replaces the answer with the exact existing safe fallback", () => {
  assertEquals(
    JUDGE_FULL_BLOCK_FALLBACK,
    "I don't have enough verified information in the available documentation to answer this question confidently. Please consult the equipment documentation directly or contact your supervisor for guidance.",
  );
  // The blocked decision is the only one that drives the fallback replacement.
  assert(decideJudgeVerdict(res(false, 5), FULL).shouldBlock);
});

Deno.test("warn_appended preserves the answer and adds the exact existing notice", () => {
  assertEquals(
    JUDGE_WARNING_NOTICE,
    "\n\n---\n**Notice:** This response may contain information not fully supported by the available documentation. Please verify critical details with authoritative sources or contact your supervisor.",
  );
  // The warn decision drives the disclaimer append without blocking.
  const d = decideJudgeVerdict(res(false, 4), BLOCKING);
  assert(d.shouldWarn);
  assert(!d.shouldBlock);
});

Deno.test("pass and none drive neither warn nor block (answer unchanged / fail-open)", () => {
  const pass = decideJudgeVerdict(res(true, 5), BLOCKING);
  assert(!pass.shouldWarn && !pass.shouldBlock);
  const none = decideJudgeVerdict(res(false, 5), NEITHER);
  assert(!none.shouldWarn && !none.shouldBlock);
});
