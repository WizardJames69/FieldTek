import { describe, it, expect } from "vitest";

// The enriched per-case report makes a failed eval run self-diagnosing (the first
// baseline review had to spelunk the DB because the report stored only booleans).
// buildCaseReport + redactSecrets are pure → unit-tested offline.
import { buildCaseReport, redactSecrets } from "../../../evals/report";
import { scoreCase } from "../../../evals/scoring";
import { extractCitedDocNamesFromText, mergeCitedDocNames } from "../../../evals/observe";
import type { EvalCase, EvalObservation } from "../../../evals/types";

function obs(partial: Partial<EvalObservation>): EvalObservation {
  return {
    caseId: "c",
    answered: true,
    abstained: false,
    answerText: "",
    retrievedChunkCount: 0,
    retrievedDocNames: [],
    retrievedChunkTexts: [],
    citedDocNames: [],
    hadCitations: false,
    judgeGrounded: null,
    judgeVerdict: null,
    ...partial,
  };
}

const manualCase: EvalCase = {
  id: "EV-M-001",
  type: "manual",
  question: "What is the startup procedure for the Carrier 24ACC636?",
  expectedSources: {
    documentNames: ["Carrier 24ACC636 Installation Manual"],
    chunkIncludes: ["startup"],
  },
  expectedFacts: ["thermostat", "disconnect"],
};

describe("redactSecrets", () => {
  it("masks JWTs, sb_ keys, and bearer tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpM";
    expect(redactSecrets(`token=${jwt}`)).not.toContain(jwt);
    expect(redactSecrets("key sb_secret_abcd1234efgh")).toContain("[REDACTED_KEY]");
    expect(redactSecrets("Authorization: Bearer abcdef123456789")).toContain("Bearer [REDACTED]");
  });

  it("leaves normal HVAC answer text untouched", () => {
    const t = "Operate between 65°F and 85°F. [Source: Carrier 24ACC636 Installation Manual]";
    expect(redactSecrets(t)).toBe(t);
  });
});

describe("buildCaseReport — self-contained, diagnosable case row", () => {
  const result = scoreCase(manualCase, obs({ answerText: "x", hadCitations: false }));
  const report = buildCaseReport(
    manualCase,
    obs({
      answered: true,
      answerText: "Operate between 65°F and 85°F.\n\n[Source: Carrier 24ACC636 Installation Manual]",
      retrievedDocNames: ["Carrier 24ACC636 Installation Manual"],
      citedDocNames: ["Carrier 24ACC636 Installation Manual"],
      citedDocNamesFromMetadata: [],
      citedDocNamesFromText: ["Carrier 24ACC636 Installation Manual"],
      hadCitations: true,
      citationDensity: 3.97,
      abstainFlag: true,
      degraded: false,
      degradedReason: null,
      enforcementRulesTriggered: ["SINGLE_CHUNK_WEAK"],
      similarityScores: [0.81, 0.61],
      auditLogId: "audit-1",
      correlationId: "corr-1",
      error: null,
    }),
    result,
  );

  it("carries the case definition + scored booleans + diagnostic fields", () => {
    expect(report.caseId).toBe("EV-M-001");
    expect(report.question).toContain("startup procedure");
    expect(report.expectedFacts).toEqual(["thermostat", "disconnect"]);
    expect(report.passed).toBe(result.passed);
    expect(report.retrievalHit).toBe(result.retrievalHit);
    expect(report.hadCitations).toBe(true);
    expect(report.citationDensity).toBe(3.97);
    expect(report.abstainFlag).toBe(true);
    expect(report.enforcementRulesTriggered).toEqual(["SINGLE_CHUNK_WEAK"]);
    expect(report.similarityScores).toEqual([0.81, 0.61]);
    expect(report.auditLogId).toBe("audit-1");
    expect(report.correlationId).toBe("corr-1");
  });

  it("preserves the answer text EXACTLY through JSON serialization", () => {
    const round = JSON.parse(JSON.stringify(report));
    expect(round.answerText).toBe(report.answerText);
    expect(round.answerText).toContain("65°F and 85°F");
    expect(round.answerText).toContain("[Source: Carrier 24ACC636 Installation Manual]");
  });

  it("distinguishes 'cited but metadata stripped' from 'no citation emitted'", () => {
    expect(report.citedDocNamesFromMetadata).toEqual([]);
    expect(report.citedDocNamesFromText).toEqual(["Carrier 24ACC636 Installation Manual"]);

    const noCite = buildCaseReport(
      manualCase,
      obs({ hadCitations: false, citedDocNamesFromMetadata: [], citedDocNamesFromText: [] }),
      result,
    );
    expect(noCite.hadCitations).toBe(false);
    expect(noCite.citedDocNamesFromText).toEqual([]);
  });

  it("redacts secrets that leak into answerText or error", () => {
    const r = buildCaseReport(
      manualCase,
      obs({ answerText: "leak eyJxxxx.yyyyy.zzzzz here", error: "Bearer abcdef123456 failed" }),
      result,
    );
    expect(r.answerText).not.toContain("eyJxxxx.yyyyy.zzzzz");
    expect(r.error).toContain("Bearer [REDACTED]");
  });
});

// The runner now feeds the scorer the UNION of metadata.sources + text-parsed
// citations. This recovers a real citation the server stripped (validationFailed
// empties metadata.sources) WITHOUT masking loss: a corruption-mangled marker
// never parses, so the case stays failed.
describe("citation recovery — text-parsed citation feeds the scorer (non-masking)", () => {
  const manual: EvalCase = {
    id: "EV-M-X",
    type: "manual",
    question: "What refrigerant does the 24ACC6 use?",
    expectedSources: { documentNames: ["Carrier 24ACC6 Manual"], chunkIncludes: ["refrigerant"] },
    expectedFacts: ["R-410A"],
  };

  it("recovers citationSupported when the text cites the expected doc but metadata.sources was empty", () => {
    const answer = "Use R-410A. [Source: Carrier 24ACC6 Manual p.12]";
    const cited = mergeCitedDocNames([], extractCitedDocNamesFromText(answer)); // metadata stripped
    expect(cited).toEqual(["Carrier 24ACC6 Manual"]);
    const r = scoreCase(
      manual,
      obs({
        answerText: answer,
        hadCitations: true,
        citedDocNames: cited,
        retrievedDocNames: ["Carrier 24ACC6 Manual"],
        retrievedChunkTexts: ["the refrigerant charge is 6 lb 4 oz"],
      }),
    );
    expect(r.citationSupported).toBe(true);
  });

  it("does NOT recover a corruption-mangled marker (missing colon) — stays false", () => {
    const answer = "Use R-410A. [Source Carrier 24ACC6 Manual]"; // colon dropped by corruption
    const cited = mergeCitedDocNames([], extractCitedDocNamesFromText(answer));
    expect(cited).toEqual([]);
    const r = scoreCase(
      manual,
      obs({
        answerText: answer,
        hadCitations: false,
        citedDocNames: cited,
        retrievedDocNames: ["Carrier 24ACC6 Manual"],
        retrievedChunkTexts: ["the refrigerant charge is 6 lb 4 oz"],
      }),
    );
    expect(r.citationSupported).toBe(false);
  });
});
