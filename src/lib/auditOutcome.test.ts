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

  it("grounded_pass — judge never ran but an answer was delivered (unjudged)", () => {
    expect(classifyAuditOutcome(row({ judge_verdict: null }))).toBe("grounded_pass");
    expect(classifyAuditOutcome(row({ judge_verdict: "none" }))).toBe("grounded_pass");
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
});
