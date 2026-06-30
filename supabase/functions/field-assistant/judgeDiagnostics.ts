// ============================================================
// Judge Diagnostics — Fail-Open Observability (pure helpers)
// ============================================================
// When the synchronous blocking judge produces no usable verdict
// (gateway timeout / error / empty body / unparseable JSON), the
// pipeline FAILS OPEN: the answer is served unmodified. That is the
// intended safety posture, but it was previously SILENT — the audit
// row had every judge_* field null with no reason attached, so a
// fail-open looked identical to "judge off" (see P5, correlation_id
// 79dfbb96-c5c4-494e-99d8-740bd421bf11).
//
// These pure helpers attach a machine-readable REASON so the fail-open
// base rate becomes measurable in /admin/ai-audit and the eval audit
// query, WITHOUT changing fail-open behavior. They are side-effect-free
// (no model, no I/O) and unit-tested via `deno test --allow-env`,
// mirroring the judgeVerdict.ts convention.
// ============================================================

/** Marker prefix written into ai_audit_logs.validation_patterns_matched
 *  (the same text[] column that already carries JUDGE_FULL_BLOCK and
 *  JUDGE_UNGROUNDED_WARNING). The full entry is `JUDGE_UNAVAILABLE:<reason>`. */
export const JUDGE_UNAVAILABLE_PREFIX = "JUDGE_UNAVAILABLE";

/** Why the blocking judge produced no usable verdict on a served answer.
 *  - timeout        : gateway AbortController fired (or the error said "aborted")
 *  - gateway_error  : gateway responded non-OK (HTTP !ok)
 *  - empty_response : gateway responded OK but with no message content
 *  - invalid_json   : the judge body could not be JSON-parsed
 *  - error          : any other / unknown failure (catch-all) */
export type JudgeUnavailableReason =
  | "timeout"
  | "gateway_error"
  | "empty_response"
  | "invalid_json"
  | "error";

/**
 * Map a thrown transport/parse error to a JudgeUnavailableReason.
 *
 * Only handles the cases that surface in a thrown error: an aborted fetch
 * (timeout) and a JSON parse failure (invalid_json). `gateway_error` and
 * `empty_response` are non-throwing branches detected inline at the judge
 * call site, so they are NOT produced here. Anything else → "error".
 */
export function classifyJudgeUnavailableReason(err: unknown): JudgeUnavailableReason {
  if (err && typeof err === "object") {
    const name = (err as { name?: unknown }).name;
    const message = (err as { message?: unknown }).message;
    const msg = typeof message === "string" ? message.toLowerCase() : "";
    if (name === "AbortError" || msg.includes("abort")) return "timeout";
    if (name === "SyntaxError") return "invalid_json";
  }
  return "error";
}

/** Build the `JUDGE_UNAVAILABLE:<reason>` marker for validation_patterns_matched. */
export function buildJudgeUnavailableMarker(reason: JudgeUnavailableReason): string {
  return `${JUDGE_UNAVAILABLE_PREFIX}:${reason}`;
}
