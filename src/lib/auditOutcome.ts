// Pure outcome classifier for Sentinel AI audit rows (ai_audit_logs).
//
// This module is intentionally side-effect free and React-free so it can be
// unit-tested in CI without a backend or a DOM (mirrors the lessonReview.ts
// convention). The admin AI-audit console uses it to turn the raw, low-level
// audit columns into a single human-readable outcome plus a badge, so a
// reviewer can triage Grounding-Trust outcomes (warn_appended / judge blocks /
// deterministic escalations / abstains) at a glance.
//
// Scope guard: this is read-only over already-persisted audit fields. It changes
// no pipeline behavior, no flags, and no data — it only interprets what the
// field-assistant edge function already wrote.
//
// ── Enforcement-rule source of truth ──────────────────────────────────────
// The string constants below MIRROR the literals written by the field-assistant
// edge function. If those are ever renamed, update them here too:
//   supabase/functions/field-assistant/index.ts
//     - "RETRIEVAL_UNAVAILABLE" / "INSUFFICIENT_RETRIEVAL_COVERAGE"  (~L1156-1157, abstain gate)
//     - `DEGRADED_RETRIEVAL_FALLBACK:<reason>`                       (~L1449, degraded answer fallback)
// These are persisted into ai_audit_logs.enforcement_rules_triggered (text[]).

/** Abstain because retrieval/embeddings never ran (outage / unavailable). */
export const RETRIEVAL_UNAVAILABLE = "RETRIEVAL_UNAVAILABLE";
/** Abstain because retrieval ran but found too few relevant chunks. */
export const INSUFFICIENT_RETRIEVAL_COVERAGE = "INSUFFICIENT_RETRIEVAL_COVERAGE";
/** Prefix for the "answered, but with a degraded full-doc fallback" rule. The
 *  full value carries a reason suffix, e.g. "DEGRADED_RETRIEVAL_FALLBACK:embedding_failed". */
export const DEGRADED_RETRIEVAL_FALLBACK = "DEGRADED_RETRIEVAL_FALLBACK";

export type AuditOutcome =
  | "degraded_or_retrieval_unavailable"
  | "grounded_refusal"
  | "abstain"
  | "deterministic_block_or_escalation"
  | "judge_blocked"
  | "warn_appended"
  | "grounded_pass"
  | "unknown";

export const AUDIT_OUTCOMES: readonly AuditOutcome[] = [
  "degraded_or_retrieval_unavailable",
  "grounded_refusal",
  "abstain",
  "deterministic_block_or_escalation",
  "judge_blocked",
  "warn_appended",
  "grounded_pass",
  "unknown",
];

// Only the fields the classifier actually reads. Kept loose (nullable) because
// judge_* columns are populated asynchronously and older rows have NULLs.
export interface AuditOutcomeRow {
  judge_verdict?: string | null;
  abstain_flag?: boolean | null;
  enforcement_rules_triggered?: string[] | null;
  response_blocked?: boolean | null;
  human_review_required?: boolean | null;
  ai_response?: string | null;
}

/**
 * Classify a single audit row into exactly one outcome. First match wins.
 *
 * Ordering rationale (see the two required regressions):
 *  - An explicit judge `blocked` verdict is checked FIRST so a critical judge
 *    block is never hidden — even if response_blocked were also true on the same
 *    row (judge currently does not drive response_blocked while judge_full_blocking
 *    is OFF, but this keeps the signal authoritative if that ever changes).
 *  - A deterministic block / human-review escalation (response_blocked=true or
 *    human_review_required=true, judge_verdict null) is therefore classified as
 *    deterministic_block_or_escalation, never judge_blocked.
 */
export function classifyAuditOutcome(row: AuditOutcomeRow): AuditOutcome {
  const rules = row.enforcement_rules_triggered ?? [];
  const hasDegradedFallback = rules.some((r) => r.startsWith(DEGRADED_RETRIEVAL_FALLBACK));

  // 0. Explicit judge block — authoritative, never masked.
  if (row.judge_verdict === "blocked") return "judge_blocked";

  // 1-3. Abstain family (pre-LLM gate: no answer was generated). Specific
  // abstain reasons classify before the generic abstain bucket.
  if (row.abstain_flag === true) {
    if (rules.includes(RETRIEVAL_UNAVAILABLE) || hasDegradedFallback) {
      return "degraded_or_retrieval_unavailable";
    }
    if (rules.includes(INSUFFICIENT_RETRIEVAL_COVERAGE)) return "grounded_refusal";
    return "abstain";
  }

  // A degraded fallback can also appear on an ANSWERED row (abstain_flag=false):
  // it answered, but only via the degraded full-doc fallback. Surface that too.
  if (hasDegradedFallback) return "degraded_or_retrieval_unavailable";

  // 4. Deterministic validation block or human-review escalation.
  if (row.response_blocked === true || row.human_review_required === true) {
    return "deterministic_block_or_escalation";
  }

  // 5. Judge appended a warning (warn-append mode).
  if (row.judge_verdict === "warn_appended") return "warn_appended";

  // 6-7. Passed: judge said pass, OR judge never ran but an answer was delivered.
  if (row.judge_verdict === "pass") return "grounded_pass";
  if (
    (row.judge_verdict == null || row.judge_verdict === "none") &&
    typeof row.ai_response === "string" &&
    row.ai_response.trim().length > 0
  ) {
    return "grounded_pass";
  }

  // 8. No response and no recognizable signal (data gap / in-flight).
  return "unknown";
}

export interface AuditOutcomeBadge {
  label: string;
  /** Tailwind classes, in the same style as lessonReview.statusBadge. */
  className: string;
  /** Stable icon key the UI maps to a lucide-react icon component. */
  icon: AuditOutcomeIcon;
}

export type AuditOutcomeIcon = "check" | "warn" | "block" | "shield" | "slash" | "help";

const OUTCOME_BADGE: Record<AuditOutcome, AuditOutcomeBadge> = {
  grounded_pass: {
    label: "Grounded pass",
    className: "bg-green-100 text-green-700",
    icon: "check",
  },
  warn_appended: {
    label: "Warn appended",
    className: "bg-amber-100 text-amber-800",
    icon: "warn",
  },
  judge_blocked: {
    label: "Judge blocked",
    className: "bg-red-100 text-red-700",
    icon: "block",
  },
  deterministic_block_or_escalation: {
    label: "Deterministic / human review",
    className: "bg-orange-100 text-orange-800",
    icon: "shield",
  },
  grounded_refusal: {
    label: "Grounded refusal",
    className: "bg-slate-100 text-slate-700",
    icon: "slash",
  },
  abstain: {
    label: "Abstain",
    className: "bg-slate-100 text-slate-600",
    icon: "slash",
  },
  degraded_or_retrieval_unavailable: {
    label: "Degraded / retrieval unavailable",
    className: "bg-yellow-100 text-yellow-800",
    icon: "warn",
  },
  unknown: {
    label: "Unknown",
    className: "bg-gray-100 text-gray-600",
    icon: "help",
  },
};

export function auditOutcomeBadge(outcome: AuditOutcome): AuditOutcomeBadge {
  return OUTCOME_BADGE[outcome] ?? OUTCOME_BADGE.unknown;
}
