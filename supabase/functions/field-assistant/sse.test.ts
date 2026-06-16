import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

// The accumulator under test is side-effect-free (no server, no IO) so it is
// imported FOR REAL — same pattern as degradation.ts. The downstream citation
// validation is also imported for real (validation.ts + constants.ts) so the
// "validation no longer fails on a split marker" test exercises the deployed
// guardrail, not a mirror.
import { createSSEContentAccumulator } from "./sse.ts";
import { validateAIResponse } from "./validation.ts";
import { CITATION_PATTERN } from "./constants.ts";

const enc = new TextEncoder();

/** OpenAI-style single-delta chat-completion SSE event. */
function deltaEvent(content: string, eol = "\n"): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}${eol}${eol}`;
}

/** A well-formed SSE body from a list of content deltas (+ optional [DONE]). */
function buildBody(deltas: string[], opts: { done?: boolean; eol?: string } = {}): string {
  const eol = opts.eol ?? "\n";
  let body = "";
  for (const d of deltas) body += deltaEvent(d, eol);
  if (opts.done !== false) body += `data: [DONE]${eol}${eol}`;
  return body;
}

/**
 * Feed the body's BYTES to the accumulator in fixed-size byte chunks. A small
 * chunkSize (esp. 1) forces every `data:` line AND every multi-byte char (e.g.
 * the `°` in `65°F`, two bytes 0xC2 0xB0) to straddle a chunk boundary — the
 * exact failure the naive per-chunk `split("\n")` accumulator could not survive.
 */
function accumulateInByteChunks(body: string, chunkSize: number): string {
  const acc = createSSEContentAccumulator();
  const bytes = enc.encode(body);
  for (let i = 0; i < bytes.length; i += chunkSize) {
    acc.push(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return acc.finish();
}

// Deltas split at ADVERSARIAL points — inside the model number (24/ACC/636),
// the degree symbols, the number 90, and the [Source:] marker ([ / Source / :)
// — so any lossy parse visibly corrupts them. Concatenated, they equal the
// answer below (derived, never hand-typed).
const CARRIER_DELTAS = [
  "According to the Carrier ", "24", "ACC", "636", " Installation Manual: ",
  "the unit operates between ", "65", "°F", " and ", "85", "°F",
  "; replace standard filters every ", "90", " days.",
  " [", "Source", ": ", "Carrier 24ACC636 Installation Manual", "]",
];
const CARRIER_ANSWER = CARRIER_DELTAS.join("");

// ── Core fidelity ───────────────────────────────────────────

Deno.test("SSE accumulator - reconstructs the exact answer fed ONE BYTE AT A TIME", () => {
  // Most adversarial: every line and every multi-byte char crosses a boundary.
  assertEquals(accumulateInByteChunks(buildBody(CARRIER_DELTAS), 1), CARRIER_ANSWER);
});

Deno.test("SSE accumulator - accumulated content equals the exact concatenation of deltas (faithful to relayed bytes)", () => {
  for (const size of [1, 2, 3, 5, 8, 16, 64]) {
    assertEquals(accumulateInByteChunks(buildBody(CARRIER_DELTAS), size), CARRIER_DELTAS.join(""));
  }
});

Deno.test("SSE accumulator - [Source:] citation marker survives arbitrary chunk splits", () => {
  const body = buildBody([
    "The unit uses R-410A. ", "[", "Source", ": ", "Carrier 24ACC636 Installation Manual", "]",
  ]);
  for (const size of [1, 2, 3, 5, 7, 13]) {
    assertStringIncludes(
      accumulateInByteChunks(body, size),
      "[Source: Carrier 24ACC636 Installation Manual]",
    );
  }
});

Deno.test("SSE accumulator - 65°F and 85°F survive (multi-byte degree split across byte chunks)", () => {
  const body = buildBody(["operate between ", "65", "°F", " and ", "85", "°F"]);
  for (const size of [1, 2, 3, 4]) {
    assertStringIncludes(accumulateInByteChunks(body, size), "65°F and 85°F");
  }
});

Deno.test("SSE accumulator - 'every 90 days' survives (no lost inter-token space or number)", () => {
  const body = buildBody(["replace standard filters ", "every ", "90", " days"]);
  assertStringIncludes(accumulateInByteChunks(body, 1), "every 90 days");
});

Deno.test("SSE accumulator - model number 24ACC636 survives delta + chunk splits", () => {
  const body = buildBody(["Carrier ", "24", "ACC", "636", " manual"]);
  assertStringIncludes(accumulateInByteChunks(body, 1), "24ACC636");
});

// ── Framing edge cases ──────────────────────────────────────

Deno.test("SSE accumulator - handles CRLF event framing", () => {
  const body = buildBody(CARRIER_DELTAS, { eol: "\r\n" });
  assertEquals(accumulateInByteChunks(body, 1), CARRIER_ANSWER);
  assertEquals(accumulateInByteChunks(body, 3), CARRIER_ANSWER);
});

Deno.test("SSE accumulator - a data: line split across two network chunks is buffered, not dropped", () => {
  const acc = createSSEContentAccumulator();
  const bytes = enc.encode(deltaEvent("hello world"));
  const cut = Math.floor(bytes.length / 2); // mid-line cut (inside the JSON)
  acc.push(bytes.subarray(0, cut));
  acc.push(bytes.subarray(cut));
  assertEquals(acc.finish(), "hello world");
});

Deno.test("SSE accumulator - malformed JSON data line is skipped without dropping later content", () => {
  const acc = createSSEContentAccumulator();
  acc.push(enc.encode(`data: not-json-garbage\n\n` + deltaEvent("kept")));
  assertEquals(acc.finish(), "kept");
});

Deno.test("SSE accumulator - non-data lines (comments / event: / id:) are ignored without loss", () => {
  const acc = createSSEContentAccumulator();
  acc.push(enc.encode(`: keep-alive\n\nevent: ping\n\n` + deltaEvent("A") + `id: 7\n\n` + deltaEvent("B")));
  assertEquals(acc.finish(), "AB");
});

Deno.test("SSE accumulator - [DONE] sentinel contributes no content", () => {
  const acc = createSSEContentAccumulator();
  acc.push(enc.encode(deltaEvent("A") + "data: [DONE]\n\n"));
  assertEquals(acc.finish(), "A");
});

Deno.test("SSE accumulator - final event WITHOUT a trailing blank line is still flushed", () => {
  const acc = createSSEContentAccumulator();
  // stream ends right after the data line — no \n\n, no [DONE]
  acc.push(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "tail" } }] })}`));
  assertEquals(acc.finish(), "tail");
});

Deno.test("SSE accumulator - multi-line data: fields in one event are joined with \\n (SSE spec)", () => {
  // Two data: lines, one event. The split lands in a JSON whitespace position so
  // the joined value (`…"delta":\n{"content":"joined"}…`) stays valid JSON.
  const body = `data: {"choices":[{"delta":\ndata: {"content":"joined"}}]}\n\n`;
  const acc = createSSEContentAccumulator();
  acc.push(enc.encode(body));
  assertEquals(acc.finish(), "joined");
});

Deno.test("SSE accumulator - content-bearing payload whitespace is preserved (no trim)", () => {
  // Leading/trailing spaces and a newline inside content must survive verbatim.
  const acc = createSSEContentAccumulator();
  acc.push(enc.encode(deltaEvent("  indented line\n\n- bullet  ")));
  assertEquals(acc.finish(), "  indented line\n\n- bullet  ");
});

Deno.test("SSE accumulator - empty input yields empty content", () => {
  const acc = createSSEContentAccumulator();
  assertEquals(acc.finish(), "");
});

// ── Downstream validation fidelity (the actual bug) ─────────
// The lossy accumulator dropped tokens INSIDE the [Source:] marker, so the real
// CITATION_PATTERN / validateAIResponse saw an "uncited" technical answer and
// the server replaced it with a canned abstain. With faithful accumulation the
// marker is intact and the SAME production validation passes — without masking a
// genuinely missing citation.

Deno.test("validation fidelity - a [Source:] marker split across chunks still passes the REAL CITATION_PATTERN", () => {
  const body = buildBody([
    "The unit operates between ", "65", "°F", " and ", "85", "°F", ". ",
    "[", "Source", ": ", "Carrier 24ACC636 Installation Manual", "]",
  ]);
  const content = accumulateInByteChunks(body, 1);
  assert(CITATION_PATTERN.test(content), "citation marker must survive for the validator to see it");
});

Deno.test("validation fidelity - real validateAIResponse VALID for a cited technical answer reassembled from split chunks", () => {
  const body = buildBody([
    "The unit operates between ", "65", "°F", " and ", "85", "°F", ". ",
    "[", "Source", ": ", "Carrier 24ACC636 Installation Manual", "]",
  ]);
  const content = accumulateInByteChunks(body, 1);
  const result = validateAIResponse(content, true);
  assertEquals(result.valid, true);
});

Deno.test("validation fidelity - NON-MASKING: a genuinely uncited technical answer still fails validation", () => {
  // No [Source:] marker at all — faithful accumulation must NOT invent one.
  const body = buildBody(["The unit operates between ", "65", "°F", " and ", "85", "°F", "."]);
  const content = accumulateInByteChunks(body, 1);
  assertEquals(content.includes("[Source:"), false);
  assertEquals(validateAIResponse(content, true).valid, false);
});
