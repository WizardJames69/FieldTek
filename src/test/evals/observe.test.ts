import { describe, it, expect } from "vitest";
import {
  interpretResponse,
  extractCitedDocNames,
  extractCitedDocNamesFromText,
  mergeCitedDocNames,
} from "../../../evals/observe";

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

// Parsing cited docs from the ANSWER TEXT (independent of metadata.sources, which
// the server empties when validation fails) — and merging the two views.

describe("extractCitedDocNamesFromText", () => {
  it("parses [Source: …] markers and strips the page locator", () => {
    expect(
      extractCitedDocNamesFromText("Use R-410A. [Source: Carrier 24ACC636 Installation Manual p.7]"),
    ).toEqual(["Carrier 24ACC636 Installation Manual"]);
  });

  it("returns distinct names across multiple markers", () => {
    const names = extractCitedDocNamesFromText(
      "A [Source: HVAC Maintenance Best Practices]. B [Source: HVAC Maintenance Best Practices]. " +
        "C [Source: Warranty Terms - Carrier Equipment].",
    );
    expect(names).toEqual(["HVAC Maintenance Best Practices", "Warranty Terms - Carrier Equipment"]);
  });

  it("does NOT match a corruption-mangled marker — never masks the loss", () => {
    // The first baseline corrupted "[Source:" → "[Source" (no colon) and "[:".
    expect(extractCitedDocNamesFromText("… [Source Carrier 24ACC636 Installation Manual]")).toEqual([]);
    expect(extractCitedDocNamesFromText("… [: HVAC Maintenance Best Practices]")).toEqual([]);
  });

  it("returns [] for no marker / empty / non-string", () => {
    expect(extractCitedDocNamesFromText("Plain answer, no citation.")).toEqual([]);
    expect(extractCitedDocNamesFromText("")).toEqual([]);
    expect(extractCitedDocNamesFromText(undefined)).toEqual([]);
  });
});

describe("mergeCitedDocNames — union of metadata + text-parsed citations", () => {
  it("dedupes and preserves order across sources", () => {
    expect(
      mergeCitedDocNames(
        ["Carrier 24ACC636 Installation Manual"],
        ["Carrier 24ACC636 Installation Manual", "HVAC Maintenance Best Practices"],
      ),
    ).toEqual(["Carrier 24ACC636 Installation Manual", "HVAC Maintenance Best Practices"]);
  });

  it("recovers a citation when metadata.sources was stripped but the text cited it", () => {
    expect(mergeCitedDocNames([], ["HVAC Maintenance Best Practices"])).toEqual([
      "HVAC Maintenance Best Practices",
    ]);
  });

  it("tolerates null / undefined / empty lists", () => {
    expect(mergeCitedDocNames(undefined, null, [], ["A"])).toEqual(["A"]);
  });
});
