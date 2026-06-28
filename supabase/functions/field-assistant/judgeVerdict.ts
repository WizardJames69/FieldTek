// ============================================================
// Field Assistant — Blocking-Judge Verdict Decision (pure)
// ============================================================
// Side-effect-free (no top-level I/O, no runtime imports) so it can be imported
// directly by judgeVerdict.test.ts for real Deno unit coverage — the same
// pattern as degradation.ts. index.ts imports decideJudgeVerdict to map a
// synchronous blocking-judge result + the two judge feature flags to a verdict
// and the effect drivers it applies, instead of an inline if/else chain.
//
// The thresholds here mirror the previous inline logic EXACTLY:
//   - no active blocking flag                                  → "none"
//   - grounded result                                          → "pass"
//   - ungrounded, confidence < 4                               → "pass"
//   - ungrounded, confidence >= 4                              → "warn_appended"
//   - ungrounded, confidence >= 5 AND full blocking enabled    → "blocked"
//   - full blocking takes precedence when both flags are on
//   - null / failed judge result                               → "none" (fail-open)
// contradiction_detected does NOT affect the verdict (preserved behavior).

import type { JudgeResult } from "./judge.ts";

export type JudgeVerdict = "none" | "pass" | "warn_appended" | "blocked";

export interface JudgeVerdictDecision {
  /** The verdict persisted to ai_audit_logs.judge_verdict (when != "none"). */
  verdict: JudgeVerdict;
  /** Append the ungrounded-warning disclaimer to the served answer. */
  shouldWarn: boolean;
  /** Replace the answer with the safe fallback and mark the response failed. */
  shouldBlock: boolean;
}

export interface JudgeBlockingFlags {
  /** judge_blocking_mode — warn-append on ungrounded + confidence >= 4. */
  blockingEnabled: boolean;
  /** judge_full_blocking — hard-block on ungrounded + confidence >= 5. */
  fullBlockingEnabled: boolean;
}

/** Confidence at/above which an ungrounded answer earns a warning disclaimer. */
export const JUDGE_WARN_MIN_CONFIDENCE = 4;
/** Confidence at/above which an ungrounded answer is hard-blocked (full mode). */
export const JUDGE_BLOCK_MIN_CONFIDENCE = 5;

/**
 * The exact text the answer is replaced with when full blocking fires. Sourced
 * here (not inline) so judgeVerdict.test.ts can pin it — preserving the wording.
 */
export const JUDGE_FULL_BLOCK_FALLBACK =
  "I don't have enough verified information in the available documentation to answer this question confidently. Please consult the equipment documentation directly or contact your supervisor for guidance.";

/**
 * The exact disclaimer appended (as an SSE chunk) on a warn_appended verdict.
 * Sourced here so the test pins the wording; byte-identical to the prior inline
 * literal, including the leading "\n\n---\n".
 */
export const JUDGE_WARNING_NOTICE =
  "\n\n---\n**Notice:** This response may contain information not fully supported by the available documentation. Please verify critical details with authoritative sources or contact your supervisor.";

const NONE: JudgeVerdictDecision = { verdict: "none", shouldWarn: false, shouldBlock: false };
const PASS: JudgeVerdictDecision = { verdict: "pass", shouldWarn: false, shouldBlock: false };

/**
 * Decide the blocking-judge verdict + effect drivers. Pure — no side effects.
 * Returns "none" (fail-open) when no blocking flag is active or the judge result
 * is absent/failed, exactly matching the prior inline behavior in index.ts.
 */
export function decideJudgeVerdict(
  result: JudgeResult | null | undefined,
  flags: JudgeBlockingFlags,
): JudgeVerdictDecision {
  // No usable judge result → fail open (answer served, verdict "none").
  if (!result) return NONE;

  // Neither blocking flag active → the blocking judge is not consulted.
  if (!flags.blockingEnabled && !flags.fullBlockingEnabled) return NONE;

  // Grounded answers always pass.
  if (result.grounded) return PASS;

  // Ungrounded + high confidence + full blocking → hard block (precedence).
  if (flags.fullBlockingEnabled && result.confidence >= JUDGE_BLOCK_MIN_CONFIDENCE) {
    return { verdict: "blocked", shouldWarn: false, shouldBlock: true };
  }

  // Ungrounded + confidence >= warn threshold → append disclaimer.
  if (result.confidence >= JUDGE_WARN_MIN_CONFIDENCE) {
    return { verdict: "warn_appended", shouldWarn: true, shouldBlock: false };
  }

  // Ungrounded but low confidence → serve as-is.
  return PASS;
}
