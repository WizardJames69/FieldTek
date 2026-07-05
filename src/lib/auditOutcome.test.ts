import { describe, it, expect } from "vitest";
import {
  classifyAuditOutcome,
  auditOutcomeBadge,
  AUDIT_OUTCOMES,
  RETRIEVAL_UNAVAILABLE,
  INSUFFICIENT_RETRIEVAL_COVERAGE,
  DEGRADED_RETRIEVAL_FALLBACK,
  type AuditOutcomeRow,
  type AuditOutcome,
} from "./auditOutcome";

// Factory: a baseline "plain delivered answer, judge never ran" row. Tests
// override only the fields relevant to the case (mirrors lessonReview.test.ts).
function row(overrides: Partial<AuditOutcomeRow> = {}): AuditOutcomeRow {
  return {
    judge_verdict: null,
    abstain_flag: false,
    enforcement_rules_triggered: null,
    response_blocked: false,
    human_review_required: false,
    ai_response: "Here is a grounded answer.",
    ...overrides,
  };
}

describe("classifyAuditOutcome", () => {
  it("grounded_pass — judge said pass", () => {
    expect(classifyAuditOutcome(row({ judge_verdict: "pass" }))).toBe("grounded_pass");
  });

  it("unjudged_no_verdict — served answer with a null judge verdict (fail-open)", () => {
    // The P5 shape: a served, non-empty, non-abstained, non-blocked answer whose
    // blocking judge produced no result. It must NOT read as a grounded pass.
    expect(classifyAuditOutcome(row({ judge_verdict: null }))).toBe("unjudged_no_verdict");
  });

  it("unjudged_no_verdict — served answer with the 'none' sentinel verdict", () => {
    expect(classifyAuditOutcome(row({ judge_verdict: "none" }))).toBe("unjudged_no_verdict");
  });

  it("unjudged_no_verdict — served answer with an undefined or empty verdict", () => {
    expect(classifyAuditOutcome(row({ judge_verdict: undefined }))).toBe("unjudged_no_verdict");
    expect(classifyAuditOutcome(row({ judge_verdict: "" }))).toBe("unjudged_no_verdict");
    expect(classifyAuditOutcome(row({ judge_verdict: "   " }))).toBe("unjudged_no_verdict");
  });

  it("P5 regression — exact fail-open shape classifies as unjudged_no_verdict", () => {
    // correlation_id 79dfbb96-c5c4-494e-99d8-740bd421bf11: served answer carrying
    // an unsupported claim, judge verdict/grounded/confidence/explanation all null,
    // response_blocked=false, abstain_flag=false → must surface as unjudged.
    expect(
      classifyAuditOutcome(
        row({
          judge_verdict: null,
          abstain_flag: false,
          response_blocked: false,
          ai_response:
            "According to the HVAC Maintenance Best Practices manual, the recommended " +
            "quarterly maintenance service includes inspecting and replacing air filters, " +
            "checking belt tension, and cleaning the condenser coil, in addition to flushing " +
            "the condensate drain trap [Source: HVAC Maintenance Best Practices].",
        }),
      ),
    ).toBe("unjudged_no_verdict");
  });

  it("abstain with a null verdict stays in the abstain family, NOT unjudged", () => {
    // The abstain gate is checked before the unjudged gate, so a null-verdict
    // abstain is grounded_refusal/abstain/degraded — never unjudged_no_verdict.
    expect(
      classifyAuditOutcome(
        row({
          abstain_flag: true,
          judge_verdict: null,
          ai_response: "I couldn't find enough grounded context…",
          enforcement_rules_triggered: [INSUFFICIENT_RETRIEVAL_COVERAGE],
        }),
      ),
    ).toBe("grounded_refusal");
  });

  it("deterministic block with a null verdict stays deterministic, NOT unjudged", () => {
    expect(
      classifyAuditOutcome(
        row({ response_blocked: true, judge_verdict: null, ai_response: "This question requires human review." }),
      ),
    ).toBe("deterministic_block_or_escalation");
  });

  it("warn_appended — judge appended a warning", () => {
    expect(classifyAuditOutcome(row({ judge_verdict: "warn_appended" }))).toBe("warn_appended");
  });

  it("judge_blocked — judge blocked, response not deterministically blocked", () => {
    expect(
      classifyAuditOutcome(row({ judge_verdict: "blocked", response_blocked: false })),
    ).toBe("judge_blocked");
  });

  it("judge_blocked — judge block is authoritative even if response_blocked is also true", () => {
    expect(
      classifyAuditOutcome(row({ judge_verdict: "blocked", response_blocked: true })),
    ).toBe("judge_blocked");
  });

  it("deterministic_block_or_escalation — response_blocked=true with judge_verdict=null", () => {
    expect(
      classifyAuditOutcome(row({ response_blocked: true, judge_verdict: null })),
    ).toBe("deterministic_block_or_escalation");
  });

  it("deterministic_block_or_escalation — human_review_required with judge_verdict=null", () => {
    expect(
      classifyAuditOutcome(
        row({
          human_review_required: true,
          response_blocked: true,
          judge_verdict: null,
          enforcement_rules_triggered: ["ESCALATION_INSUFFICIENT_CHUNKS"],
        }),
      ),
    ).toBe("deterministic_block_or_escalation");
  });

  it("degraded_or_retrieval_unavailable — abstain with RETRIEVAL_UNAVAILABLE rule", () => {
    expect(
      classifyAuditOutcome(
        row({
          abstain_flag: true,
          ai_response: "",
          enforcement_rules_triggered: [RETRIEVAL_UNAVAILABLE],
        }),
      ),
    ).toBe("degraded_or_retrieval_unavailable");
  });

  it("degraded_or_retrieval_unavailable — answered-degraded row via DEGRADED_RETRIEVAL_FALLBACK prefix", () => {
    expect(
      classifyAuditOutcome(
        row({
          abstain_flag: false,
          enforcement_rules_triggered: [`${DEGRADED_RETRIEVAL_FALLBACK}:embedding_failed`],
        }),
      ),
    ).toBe("degraded_or_retrieval_unavailable");
  });

  it("grounded_refusal — abstain with INSUFFICIENT_RETRIEVAL_COVERAGE rule", () => {
    expect(
      classifyAuditOutcome(
        row({
          abstain_flag: true,
          ai_response: "",
          enforcement_rules_triggered: [INSUFFICIENT_RETRIEVAL_COVERAGE],
        }),
      ),
    ).toBe("grounded_refusal");
  });

  it("abstain — abstain_flag true with an unrecognized reason (generic fallback)", () => {
    expect(
      classifyAuditOutcome(
        row({ abstain_flag: true, ai_response: "", enforcement_rules_triggered: ["SOME_FUTURE_REASON"] }),
      ),
    ).toBe("abstain");
    expect(
      classifyAuditOutcome(row({ abstain_flag: true, ai_response: "", enforcement_rules_triggered: null })),
    ).toBe("abstain");
  });

  it("abstain reasons classify before the generic abstain bucket", () => {
    // RETRIEVAL_UNAVAILABLE present alongside another rule still resolves to degraded.
    expect(
      classifyAuditOutcome(
        row({
          abstain_flag: true,
          ai_response: "",
          enforcement_rules_triggered: ["SOMETHING_ELSE", RETRIEVAL_UNAVAILABLE],
        }),
      ),
    ).toBe("degraded_or_retrieval_unavailable");
  });

  it("unknown — no response and no recognizable signal", () => {
    expect(
      classifyAuditOutcome(row({ judge_verdict: null, ai_response: "" })),
    ).toBe("unknown");
    expect(
      classifyAuditOutcome(row({ judge_verdict: "none", ai_response: null })),
    ).toBe("unknown");
  });

  // P3b: lexical-rescue rows carry LEXICAL_RESCUE:* / SINGLE_CHUNK_LEXICAL_ANSWER:*
  // enforcement tags (written by field-assistant index.ts). They are
  // informational — an answered rescue row must classify exactly like any
  // other served-but-unjudged answer, never as blocked/degraded/refusal.
  it("answered lexical-rescue row classifies as unjudged_no_verdict (tags are informational)", () => {
    expect(
      classifyAuditOutcome(
        row({
          abstain_flag: false,
          ai_response: "The nominal airflow is 1200 CFM. [Source: FT-Pilot Air Handler Service Guide]",
          enforcement_rules_triggered: [
            "LEXICAL_RESCUE:n=1,rank=0.090,cos=0.58",
            "SINGLE_CHUNK_LEXICAL_ANSWER:rank=0.090,cos=0.58,len=2143",
          ],
        }),
      ),
    ).toBe("unjudged_no_verdict");
  });

  it("abstained row with a lexical-rescue tag still resolves by its abstain reason", () => {
    // A rescue that fired but still ended under the coverage minimum keeps the
    // grounded_refusal classification driven by INSUFFICIENT_RETRIEVAL_COVERAGE.
    expect(
      classifyAuditOutcome(
        row({
          abstain_flag: true,
          ai_response: "",
          enforcement_rules_triggered: [
            "LEXICAL_RESCUE:n=1,rank=0.090,cos=0.58",
            INSUFFICIENT_RETRIEVAL_COVERAGE,
          ],
        }),
      ),
    ).toBe("grounded_refusal");
  });
});

describe("auditOutcomeBadge", () => {
  it("returns a defined badge for every outcome (mapper is total)", () => {
    for (const outcome of AUDIT_OUTCOMES) {
      const badge = auditOutcomeBadge(outcome);
      expect(badge).toBeDefined();
      expect(badge.label.length).toBeGreaterThan(0);
      expect(badge.className.length).toBeGreaterThan(0);
      expect(badge.icon.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the unknown badge for an unexpected value", () => {
    const badge = auditOutcomeBadge("not_a_real_outcome" as AuditOutcome);
    expect(badge.label).toBe("Unknown");
  });

  it("unjudged_no_verdict badge is distinct from grounded_pass (not a success style)", () => {
    const unjudged = auditOutcomeBadge("unjudged_no_verdict");
    const pass = auditOutcomeBadge("grounded_pass");
    expect(unjudged.label).toBe("Unjudged / no verdict");
    expect(unjudged.icon).toBe("unverified");
    // Must not reuse the green "success" styling or the check icon.
    expect(unjudged.className).not.toContain("green");
    expect(unjudged.icon).not.toBe(pass.icon);
    expect(unjudged.className).not.toBe(pass.className);
  });
});
