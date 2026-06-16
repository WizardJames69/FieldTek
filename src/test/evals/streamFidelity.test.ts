import { describe, it, expect } from "vitest";

// Stream-fidelity: prove the eval client's SSE parser reconstructs assistant
// content EXACTLY. The first live baseline showed corrupted answers (mangled
// [Source:] markers, dropped tokens/spaces). These offline tests localize the
// eval-client parser: if they pass, the eval parser is NOT the source of the
// loss (so it is upstream/server), and they guard against a future parser
// regression. Pure → no backend, no OpenAI.
import { parseFieldAssistantSSE } from "../../../e2e/helpers/ai-api-client";
import { buildSSEBody, CARRIER_DELTAS, CARRIER_ANSWER } from "./fixtures/sse-fixtures";

describe("parseFieldAssistantSSE — content fidelity", () => {
  it("reconstructs the exact answer from adversarially split deltas", () => {
    const body = buildSSEBody(CARRIER_DELTAS, { done: true });
    expect(parseFieldAssistantSSE(body).streamedContent).toBe(CARRIER_ANSWER);
  });

  it("preserves the [Source:] citation marker exactly", () => {
    const body = buildSSEBody(["Answer. ", "[", "Source", ": ", "HVAC Maintenance Best Practices", "]"]);
    expect(parseFieldAssistantSSE(body).streamedContent).toContain(
      "[Source: HVAC Maintenance Best Practices]",
    );
  });

  it("preserves degree symbols, numbers, model numbers, and the literal '90'", () => {
    const body = buildSSEBody(["65", "°F", " ", "85", "°F ", "24", "ACC", "636 ", "90", " days"]);
    expect(parseFieldAssistantSSE(body).streamedContent).toBe("65°F 85°F 24ACC636 90 days");
  });

  it("does not drop a standalone whitespace delta", () => {
    const body = buildSSEBody(["Carrier", " ", "24ACC636"]);
    expect(parseFieldAssistantSSE(body).streamedContent).toBe("Carrier 24ACC636");
  });

  it("preserves newlines inside content (escaped in JSON, restored on parse)", () => {
    const multiline = "Replace standard filters every 90 days.\n\n- Check the filter monthly.";
    const body = buildSSEBody([multiline]);
    expect(parseFieldAssistantSSE(body).streamedContent).toBe(multiline);
  });

  it("handles CRLF line endings", () => {
    const body = buildSSEBody(CARRIER_DELTAS, { eol: "\r\n" });
    expect(parseFieldAssistantSSE(body).streamedContent).toBe(CARRIER_ANSWER);
  });

  it("extracts metadata + correlation_id and keeps it out of the content", () => {
    const body = buildSSEBody(["Hello world"], {
      metadata: { correlation_id: "corr-123", sources: [{ document_name: "Doc A" }] },
    });
    const r = parseFieldAssistantSSE(body);
    expect(r.correlationId).toBe("corr-123");
    expect(r.streamedContent).toBe("Hello world");
    expect((r.metadata?.sources as unknown[])?.length).toBe(1);
  });

  it("stops at [DONE] and ignores any trailing event", () => {
    const body =
      `data: ${JSON.stringify({ choices: [{ delta: { content: "A" } }] })}\n\n` +
      `data: [DONE]\n\n` +
      `data: ${JSON.stringify({ choices: [{ delta: { content: "SHOULD-NOT-APPEAR" } }] })}\n\n`;
    expect(parseFieldAssistantSSE(body).streamedContent).toBe("A");
  });

  it("skips a non-JSON data line without throwing or losing other content", () => {
    const body =
      `data: not-json-garbage\n\n` +
      `data: ${JSON.stringify({ choices: [{ delta: { content: "kept" } }] })}\n\n`;
    expect(parseFieldAssistantSSE(body).streamedContent).toBe("kept");
  });

  it("returns an empty result for an empty body", () => {
    expect(parseFieldAssistantSSE("")).toEqual({
      streamedContent: "",
      metadata: undefined,
      correlationId: undefined,
    });
  });
});
