// ============================================================
// Sentinel AI eval harness — response interpretation (PR-2.1)
// ============================================================
// Pure helpers that turn a field-assistant transport response into the
// answered/abstained/answerText signals the scorer needs, and extract cited
// document names from the streamed metadata. No I/O — unit tested in
// src/test/evals/observe.test.ts. The runner (run.ts) layers the audit-log
// retrieval data on top.

export interface ResponseInterpretation {
  answered: boolean;
  abstained: boolean;
  answerText: string;
}

/**
 * field-assistant answers either as an SSE stream (accumulated into
 * `streamedContent`) OR as a structured JSON 200:
 *   - abstain gate:      { response, abstained: true, abstainReason }
 *   - compliance block:  { compliance_blocked: true }
 *   - plain response:    { response }
 */
export function interpretResponse(res: {
  status: number;
  body: string;
  streamedContent: string;
}): ResponseInterpretation {
  if (res.streamedContent && res.streamedContent.trim().length > 0) {
    return { answered: true, abstained: false, answerText: res.streamedContent };
  }

  try {
    const json = JSON.parse(res.body) as Record<string, unknown>;
    if (json.abstained === true || typeof json.abstainReason === "string") {
      return {
        answered: false,
        abstained: true,
        answerText: typeof json.response === "string" ? json.response : "",
      };
    }
    if (json.compliance_blocked === true) {
      return { answered: false, abstained: false, answerText: "" };
    }
    if (typeof json.response === "string" && json.response.trim().length > 0) {
      return { answered: true, abstained: false, answerText: json.response };
    }
  } catch {
    // Not JSON — fall through.
  }

  return { answered: false, abstained: false, answerText: "" };
}

/** Distinct document names from the streamed metadata `sources` array. */
export function extractCitedDocNames(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  const names = new Set<string>();
  for (const s of sources) {
    if (s && typeof s === "object") {
      const n = (s as Record<string, unknown>).document_name;
      if (typeof n === "string" && n.trim().length > 0) names.add(n);
    }
  }
  return [...names];
}

/**
 * Distinct document names parsed directly from the answer text's `[Source: …]`
 * markers — the canonical citation format the prompt mandates and `field-assistant`
 * validation checks. This is INDEPENDENT of the streamed `metadata.sources` array,
 * which the server empties when validation fails (`!validationFailed ? buildSourceCitations(...) : []`),
 * so a validly-cited answer can arrive with no `sources`. Reading the text lets
 * the runner recover the real citation WITHOUT masking loss: a corruption-mangled
 * marker (no colon, or `[: …]`) simply does not match and yields no name. A
 * trailing page/section locator (` p.7`, `, page 3`) is stripped.
 */
export function extractCitedDocNamesFromText(answerText: unknown): string[] {
  if (typeof answerText !== "string" || answerText.length === 0) return [];
  const names = new Set<string>();
  for (const match of answerText.matchAll(/\[Source:\s*([^\]]+)\]/gi)) {
    const name = match[1].replace(/[\s,;]+(p\.?|pg\.?|page)\s*\.?\s*\d+\s*$/i, "").trim();
    if (name.length > 0) names.add(name);
  }
  return [...names];
}

/**
 * Union of cited-document-name lists (e.g. names from `metadata.sources` plus
 * names parsed from the answer text), de-duplicated and order-preserving. Gives
 * the scorer/report the most complete view of what the answer actually cited
 * without double-counting. Tolerant of null/undefined lists.
 */
export function mergeCitedDocNames(...lists: Array<string[] | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const n of list) {
      if (typeof n === "string" && n.trim().length > 0 && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  }
  return out;
}

// ── Async judge audit wait (judge-probe only) ───────────────────────────────
// The advisory judge (rag_judge) is a fire-and-forget update to the SAME
// ai_audit_logs row, landing ~1s AFTER the row is first inserted. `waitForAuditLog`
// returns on first existence, so the --judge-check probe would read judge_grounded=null
// and wrongly report judgeRan=false. These pure helpers let the probe re-poll the
// same row until the judge fields reach a terminal state (or a bounded timeout).
// Effects (clock/sleep/fetch) are injected, so the loop is unit-tested with a fake
// clock and never touches the default 11-case path.

/**
 * Has the async judge reached a terminal, observed state for this audit row?
 * Strict (no truthiness): `judge_grounded` is terminal only when it is the real
 * boolean `true` or `false` (both the advisory and blocking judge paths set it).
 * Advisory mode leaves `judge_verdict` null, so grounding alone is sufficient. A
 * populated blocking verdict (pass/warn_appended/blocked — anything but the
 * not-yet-run "none") is ALSO terminal, preserving future blocking-mode support
 * even if grounded were ever absent. All-null/absent → not terminal (keep polling).
 */
export function isJudgeObservationComplete(
  row: Record<string, unknown> | null | undefined,
): boolean {
  if (!row || typeof row !== "object") return false;
  const grounded = row.judge_grounded;
  if (grounded === true || grounded === false) return true;
  const verdict = row.judge_verdict;
  if (typeof verdict === "string" && verdict.length > 0 && verdict !== "none") return true;
  return false;
}

/**
 * Should this observation wait for the async judge to land? Only judge probes
 * pay the polling cost: when --judge-check is active OR the case carries an
 * `expectedJudge` assertion. Ordinary 11-case observations return false, so the
 * default path keeps its single existence wait and inherits no extra latency.
 */
export function shouldWaitForJudge(opts: {
  judgeCheckActive: boolean;
  caseHasExpectedJudge: boolean;
}): boolean {
  return opts.judgeCheckActive || opts.caseHasExpectedJudge;
}

export interface JudgeWaitDeps {
  /** Sleep `ms`; injected so tests advance a virtual clock instead of waiting. */
  sleep: (ms: number) => Promise<void>;
  /** Monotonic clock read in ms; injected for deterministic timeout tests. */
  now: () => number;
}

export interface JudgeWaitOptions {
  /** Bounded total wait for the judge fields, in ms. Default 10000. */
  judgeTimeoutMs?: number;
  /** Delay between polls of the same row, in ms. Default 500. */
  pollIntervalMs?: number;
}

export interface JudgeWaitResult {
  /** The latest observed row (initial or last re-poll); kept for diagnosis. */
  log: Record<string, unknown> | null;
  /** True once the judge reached a terminal state (grounded or a real verdict). */
  judgeComplete: boolean;
  /** True when the bounded timeout expired before the judge landed. */
  timedOut: boolean;
  /** Number of re-poll fetches performed (0 when the initial row was complete). */
  polls: number;
  /** Virtual/real ms spent re-polling (0 when the initial row was complete). */
  waitedMs: number;
}

/**
 * Re-poll the SAME audit row (already located by correlation id) until the async
 * judge reaches a terminal state or a bounded timeout expires. Pure control flow
 * over injected effects: `fetchRow` returns the freshest row (or null if briefly
 * unreadable — tolerated, we keep polling), `deps.sleep`/`deps.now` are injected.
 * Never hangs (bounded by judgeTimeoutMs) and never silently passes (returns
 * judgeComplete=false + timedOut=true with the last observed row on expiry).
 */
export async function pollUntilJudgeComplete(
  initialLog: Record<string, unknown> | null,
  fetchRow: () => Promise<Record<string, unknown> | null>,
  deps: JudgeWaitDeps,
  opts: JudgeWaitOptions = {},
): Promise<JudgeWaitResult> {
  const judgeTimeoutMs = opts.judgeTimeoutMs ?? 10000;
  const pollIntervalMs = opts.pollIntervalMs ?? 500;

  if (isJudgeObservationComplete(initialLog)) {
    return { log: initialLog, judgeComplete: true, timedOut: false, polls: 0, waitedMs: 0 };
  }

  let latest = initialLog;
  let polls = 0;
  const start = deps.now();
  while (deps.now() - start < judgeTimeoutMs) {
    await deps.sleep(pollIntervalMs);
    polls++;
    const row = await fetchRow();
    if (row) latest = row;
    if (isJudgeObservationComplete(latest)) {
      return { log: latest, judgeComplete: true, timedOut: false, polls, waitedMs: deps.now() - start };
    }
  }
  return { log: latest, judgeComplete: false, timedOut: true, polls, waitedMs: deps.now() - start };
}

/**
 * One-line diagnostic for the probe log so a judge-wait outcome is legible:
 * either the judge landed (with poll count) or a clear "did not populate" timeout
 * message naming the correlation id. Pure.
 */
export function describeJudgeWait(correlationId: string, result: JudgeWaitResult): string {
  if (result.judgeComplete) {
    const grounded = result.log?.judge_grounded;
    return `[eval] judge completed for ${correlationId} after ${result.polls} poll(s) ` +
      `(~${result.waitedMs}ms, judge_grounded=${grounded})`;
  }
  return `[eval] judge fields did not populate for ${correlationId} within ${result.waitedMs}ms ` +
    `(${result.polls} poll(s)) — async judge did not land; judge expectation will fail`;
}
