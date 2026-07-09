import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — one token for job / invoice / request status pills across the app.
 *
 * Before this, the same statuses were rendered four different ways (semantic
 * tokens on the dashboard, explicit blue/amber/green on Jobs, `text-blue-700`
 * with NO dark variant on Invoices — which failed WCAG on light and was
 * unreadable on dark, and raw `bg-blue-500/10` in global search). This encodes
 * the WCAG-checked light/dark split once (from the Jobs page, the audited
 * reference) so every surface reads correctly in both themes.
 *
 * Colours are deliberately the explicit -500/-700/-300 scale, not the
 * `--success/--warning/--info` semantic tokens: those tokens are mid-lightness
 * and wash out on the near-white content background (e.g. in_progress ~1.86:1).
 */

type StatusStyle = { label: string; className: string };

const NEUTRAL = "bg-muted text-foreground/80";
const BLUE = "bg-blue-500/15 text-blue-700 dark:text-blue-300";
const AMBER = "bg-amber-500/15 text-amber-700 dark:text-amber-300";
const GREEN = "bg-green-500/15 text-green-700 dark:text-green-300";
const RED = "bg-red-500/15 text-red-700 dark:text-red-300";

const STATUS_STYLES: Record<string, StatusStyle> = {
  // Jobs
  pending: { label: "Pending", className: NEUTRAL },
  scheduled: { label: "Scheduled", className: BLUE },
  in_progress: { label: "In progress", className: AMBER },
  completed: { label: "Completed", className: GREEN },
  cancelled: { label: "Cancelled", className: NEUTRAL },
  // Invoices
  draft: { label: "Draft", className: NEUTRAL },
  sent: { label: "Sent", className: BLUE },
  paid: { label: "Paid", className: GREEN },
  overdue: { label: "Overdue", className: RED },
  // Service requests
  new: { label: "New", className: BLUE },
  reviewing: { label: "Reviewing", className: AMBER },
  reviewed: { label: "Reviewed", className: AMBER },
  converted: { label: "Converted", className: GREEN },
  rejected: { label: "Rejected", className: RED },
  approved: { label: "Approved", className: GREEN },
};

const humanize = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export interface StatusBadgeProps {
  status: string | null | undefined;
  /** Overrides the built-in label (e.g. a terminology-mapped string). */
  label?: string;
  /** Optional leading icon (e.g. the invoice status icon). */
  icon?: ReactNode;
  className?: string;
}

export function StatusBadge({ status, label, icon, className }: StatusBadgeProps) {
  const key = (status ?? "").toLowerCase();
  const style = STATUS_STYLES[key] ?? { label: humanize(key || "unknown"), className: NEUTRAL };
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        style.className,
        className
      )}
    >
      {icon}
      {label ?? style.label}
    </span>
  );
}
