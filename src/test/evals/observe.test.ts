import { describe, it, expect } from "vitest";
import { interpretResponse, extractCitedDocNames } from "../../../evals/observe";

// interpretResponse maps a field-assistant transport response (SSE stream OR
// structured JSON: abstain gate / compliance block / plain response) into the
// answered/abstained/answerText signals the scorer needs. Pure → unit tested.

describe("interpretResponse", () => {
  it("treats streamed SSE content as an answer", () => {
    const r = interpretResponse({
      status: 200,
      body: "",
      streamedContent: "Use R-410A refrigerant. [Source: Carrier Manual p.7]",
    });
    expect(r.answered).toBe(true);
    expect(r.abstained).toBe(false);
    expect(r.answerText).toContain("R-410A");
  });

  it("treats the abstain-gate JSON as an abstain (not an answer)", () => {
    const r = interpretResponse({
      status: 200,
      body: JSON.stringify({
        response: "I cannot find this information in the uploaded documents.",
        abstained: true,
        abstainReason: "insufficient_retrieval_coverage",
      }),
      streamedContent: "",
    });
    expect(r.answered).toBe(false);
    expect(r.abstained).toBe(true);
  });

  it("treats a compliance block as neither answered nor abstained", () => {
    const r = interpretResponse({
      status: 200,
      body: JSON.stringify({ compliance_blocked: true }),
      streamedContent: "",
    });
    expect(r.answered).toBe(false);
    expect(r.abstained).toBe(false);
  });

  it("treats a plain JSON response as an answer", () => {
    const r = interpretResponse({
      status: 200,
      body: JSON.stringify({ response: "The filter is replaced every 90 days." }),
      streamedContent: "",
    });
    expect(r.answered).toBe(true);
    expect(r.abstained).toBe(false);
    expect(r.answerText).toContain("90 days");
  });

  it("treats an empty body with no stream as neither", () => {
    const r = interpretResponse({ status: 200, body: "", streamedContent: "" });
    expect(r.answered).toBe(false);
    expect(r.abstained).toBe(false);
  });
});

describe("extractCitedDocNames", () => {
  it("returns distinct document names from the sources list", () => {
    const names = extractCitedDocNames([
      { document_name: "Carrier 24ACC636 Installation Manual", page_number: 3 },
      { document_name: "Carrier 24ACC636 Installation Manual", page_number: 7 },
      { document_name: "HVAC Maintenance Best Practices" },
    ]);
    expect(names).toContain("Carrier 24ACC636 Installation Manual");
    expect(names).toContain("HVAC Maintenance Best Practices");
    expect(names).toHaveLength(2);
  });

  it("tolerates non-array / malformed sources", () => {
    expect(extractCitedDocNames(undefined)).toEqual([]);
    expect(extractCitedDocNames("nope")).toEqual([]);
    expect(extractCitedDocNames([{ page_number: 1 }, null, 5])).toEqual([]);
  });
});
