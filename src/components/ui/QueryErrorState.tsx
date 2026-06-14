import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * QueryErrorState — a small, reusable "this data failed to load" panel.
 *
 * Use it wherever a fetch can fail so a failed request is visibly distinct from
 * a successful-but-empty result (which should keep its own empty state). Renders
 * a clear title, friendly copy, and a text "Try again" button when an `onRetry`
 * callback is provided.
 *
 * Deliberately does NOT surface raw error messages by default (they're logged /
 * toasted elsewhere) — pilot users get an actionable, non-technical message.
 */
export interface QueryErrorStateProps {
  /** Headline. Defaults to a generic, friendly message. */
  title?: string;
  /** Short supporting copy under the title. */
  description?: string;
  /** When provided, renders a "Try again" button that calls this. */
  onRetry?: () => void;
  /** Show the retry button in a spinning/disabled state while a retry runs. */
  retrying?: boolean;
  /** `card`: bordered panel for replacing a whole section. `inline`: bare, for
   *  dropping inside an existing Card/CardContent. */
  variant?: "card" | "inline";
  className?: string;
  /** Optional test hook applied to the root element. */
  testId?: string;
}

export function QueryErrorState({
  title = "Couldn't load this data",
  description = "Check your connection and try again.",
  onRetry,
  retrying = false,
  variant = "card",
  className,
  testId,
}: QueryErrorStateProps) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        variant === "card"
          ? "rounded-2xl border border-border/60 bg-muted/20 px-6 py-10"
          : "py-8",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/20">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
          className="mt-1"
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
            aria-hidden="true"
          />
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      )}
    </div>
  );
}
