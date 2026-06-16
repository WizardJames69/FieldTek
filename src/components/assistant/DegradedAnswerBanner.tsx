import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export type DegradedReason = "retrieval_unavailable" | "indexing_incomplete";

const DESCRIPTIONS: Record<DegradedReason, string> = {
  indexing_incomplete:
    "Your documents are still being indexed, so this answer was drawn from your full documents rather than a targeted search. It may be less precise — verify it against the source before relying on it.",
  // Covers every "retrieval did not run" cause uniformly (search outage, adapter
  // error, or a query too short to search), so the wording stays accurate
  // without claiming a specific cause.
  retrieval_unavailable:
    "This answer was drawn from your full documents rather than a targeted search, so it may be less precise. Verify it against the source before relying on it.",
};

/**
 * Shown when an assistant answer came from the full-document fallback instead of
 * targeted retrieval (see field-assistant/degradation.ts, PR-1.5a). Keeps a
 * degraded answer from being mistaken for a retrieval-grounded one.
 */
export function DegradedAnswerBanner({ reason }: { reason: DegradedReason }) {
  return (
    <Alert
      data-testid="degraded-answer-banner"
      className="bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Answered without targeted document search</AlertTitle>
      <AlertDescription>{DESCRIPTIONS[reason]}</AlertDescription>
    </Alert>
  );
}
