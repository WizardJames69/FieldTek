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
