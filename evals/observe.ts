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
