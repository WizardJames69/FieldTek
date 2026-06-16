// ============================================================
// Field Assistant — content-preserving SSE accumulator
// ============================================================
// The streaming handler reads the upstream chat-completion SSE stream for two
// independent purposes: (1) it replays the RAW upstream bytes to the client
// verbatim, and (2) it accumulates the assistant text to drive validation +
// the audit log (ai_audit_logs.ai_response).
//
// The previous accumulator did `decoder.decode(value).split("\n")` on EACH
// network read with no cross-chunk buffer. SSE `data:` lines routinely straddle
// network (TCP) boundaries, so a split line was handed to JSON.parse in two
// invalid halves; the `catch` then silently dropped that delta. The result was
// a lossy `accumulatedContent` that (a) corrupted the audited response and (b)
// fed validation/citation detection a mangled `[Source: …]` marker — making a
// correctly-grounded answer look uncited, so the server replaced it with a
// canned abstain. (Localized by the enriched eval baseline: the client relay
// was clean while ai_audit_logs.ai_response was corrupted.)
//
// This accumulator is the server-side analogue of the eval client's
// parseFieldAssistantSSE: it buffers incomplete lines across pushes, follows the
// SSE line protocol (strip one optional space after `data:`, join multi-line
// `data:` fields with "\n", dispatch on a blank line), tolerates LF and CRLF,
// ignores `[DONE]` and non-`data:` fields, never trims content-bearing
// payloads, and uses a single streaming TextDecoder so a multi-byte char (e.g.
// the `°` in `65°F`) split across a byte boundary is decoded intact. The
// accumulated text therefore matches the bytes relayed to the client.
//
// Side-effect-free (no IO, no server) so it is unit-tested for real in
// sse.test.ts — the same convention as degradation.ts.

export interface SSEContentAccumulator {
  /** Feed one network chunk of raw bytes from the upstream stream. */
  push(bytes: Uint8Array): void;
  /** Flush any buffered tail and return the full accumulated assistant text. */
  finish(): string;
}

/** Pull `choices[0].delta.content` from one parsed chat-completion event. */
function deltaContentOf(parsed: unknown): string {
  const content = (parsed as { choices?: Array<{ delta?: { content?: unknown } }> })
    ?.choices?.[0]?.delta?.content;
  return typeof content === "string" ? content : "";
}

export function createSSEContentAccumulator(): SSEContentAccumulator {
  const decoder = new TextDecoder();
  let buffer = ""; // decoded text not yet split into complete lines
  let content = ""; // accumulated assistant delta content
  let dataLines: string[] = []; // `data:` fields of the in-progress event

  function dispatchEvent(): void {
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    dataLines = [];
    if (payload === "[DONE]") return; // stream sentinel — carries no content
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return; // malformed/partial JSON — skip WITHOUT dropping other events
    }
    content += deltaContentOf(parsed);
  }

  function processLine(rawLine: string): void {
    // Strip a single trailing CR so LF and CRLF framing behave identically.
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line === "") {
      dispatchEvent(); // a blank line terminates the current event
      return;
    }
    if (line.startsWith("data:")) {
      let value = line.slice(5);
      if (value.startsWith(" ")) value = value.slice(1); // strip ONE optional space (SSE rule)
      dataLines.push(value); // do NOT trim — content whitespace is significant
    }
    // Comment (":"), `event:`, `id:`, `retry:` etc. carry no assistant content.
  }

  function drainCompleteLines(): void {
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const rawLine = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      processLine(rawLine);
    }
  }

  return {
    push(bytes: Uint8Array): void {
      // stream:true keeps a partial multi-byte char buffered across pushes.
      buffer += decoder.decode(bytes, { stream: true });
      drainCompleteLines();
    },
    finish(): string {
      buffer += decoder.decode(); // flush any pending multi-byte sequence
      drainCompleteLines();
      // A final line with no trailing newline (stream ended mid/post line).
      if (buffer.length > 0) {
        const rawLine = buffer;
        buffer = "";
        processLine(rawLine);
      }
      // A final event with no terminating blank line must still dispatch.
      dispatchEvent();
      return content;
    },
  };
}
