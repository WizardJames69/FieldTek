// ============================================================
// Stream-fidelity fixtures — synthetic field-assistant SSE bodies
// ============================================================
// Deterministic, offline fixtures for the eval stream-fidelity tests. They let
// us prove that the eval client's SSE parser reconstructs assistant content
// EXACTLY — no dropped tokens, mangled [Source:] markers, or lost spaces — which
// is the failure mode the first live baseline exhibited (e.g. "[Source:" → "[:",
// "every 90 days" → "every  days", "24ACC636" → "24636"). No backend, no OpenAI.

/** Wrap one content delta as an OpenAI-style SSE chunk event (single `data:` line). */
function deltaEvent(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;
}

/**
 * Build a well-formed SSE body from a list of content deltas, optionally
 * preceded by a metadata event and followed by `[DONE]`. Events are separated by
 * a blank line (SSE spec). `eol` lets a test exercise CRLF framing.
 */
export function buildSSEBody(
  deltas: string[],
  opts: { metadata?: Record<string, unknown>; done?: boolean; eol?: "\n" | "\r\n" } = {},
): string {
  const eol = opts.eol ?? "\n";
  const sep = eol + eol;
  const events: string[] = [];
  if (opts.metadata) events.push(`data: ${JSON.stringify({ metadata: opts.metadata })}`);
  for (const d of deltas) events.push(deltaEvent(d));
  if (opts.done !== false) events.push("data: [DONE]");
  return events.join(sep) + sep;
}

/**
 * Deltas split at ADVERSARIAL points — inside the model number (`24`/`ACC`/`636`),
 * the degree symbols, the number `90`, and the `[Source:]` marker (`[`/`Source`/`:`)
 * — so a lossy parser would visibly corrupt them. Concatenated, they equal
 * CARRIER_ANSWER below.
 */
export const CARRIER_DELTAS: string[] = [
  "According to the Carrier ",
  "24",
  "ACC",
  "636",
  " Installation Manual:",
  " the unit operates between ",
  "65",
  "°F",
  " and ",
  "85",
  "°F",
  "; replace standard filters every ",
  "90",
  " days. Connect manifold gauges and verify ",
  "subcooling",
  " and ",
  "superheat",
  ".",
  " [",
  "Source",
  ": ",
  "Carrier 24ACC636 Installation Manual",
  "]",
];

/** The exact text CARRIER_DELTAS must reconstruct (derived — never hand-typed). */
export const CARRIER_ANSWER = CARRIER_DELTAS.join("");
