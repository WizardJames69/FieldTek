// ============================================================
// Sentinel AI eval harness — cost controls (PR-2.2)
// ============================================================
// A per-run token budget guard. Live eval runs call OpenAI (completion + judge
// + query embedding) through the deployed backend, so a runaway case set can
// quietly burn credits. The runner consumes each case's reported token usage
// (token_count_prompt + token_count_response from ai_audit_logs) and stops
// BEFORE starting another case once the budget is exhausted — logging exactly
// how many cases were skipped (no silent cap).
//
// Pure (no IO) so the "stop before overspending" semantics are unit-tested.

export interface CostTracker {
  /** Tokens consumed so far across recorded cases. */
  spent(): number;
  /** Remaining budget (Infinity when unbounded). */
  remaining(): number;
  /** True while there is budget left to start another case. */
  hasRoom(): boolean;
  /** Record tokens used by a completed case; returns the new running total. */
  record(tokens: number): number;
}

function clampNonNeg(v: number): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * @param maxTokens hard cap on total tokens for the run; null = unbounded.
 */
export function createCostTracker(maxTokens: number | null): CostTracker {
  let spent = 0;
  return {
    spent: () => spent,
    remaining: () => (maxTokens === null ? Infinity : Math.max(0, maxTokens - spent)),
    hasRoom: () => maxTokens === null || spent < maxTokens,
    record: (tokens: number) => {
      spent += clampNonNeg(tokens);
      return spent;
    },
  };
}

/** Sum token counts defensively, ignoring null/undefined/negative/non-finite. */
export function sumTokens(...values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + clampNonNeg(v as number), 0);
}
