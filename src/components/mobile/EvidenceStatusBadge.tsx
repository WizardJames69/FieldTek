import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

type VerificationStatus = "pending" | "verified" | "failed" | "flagged";

interface EvidenceStatusBadgeProps {
  status: VerificationStatus;
  className?: string;
}

const config: Record<
  VerificationStatus,
  { icon: typeof CheckCircle2; label: string; color: string; bg: string }
> = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
  verified: {
    icon: CheckCircle2,
    label: "Verified",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
  },
  flagged: {
    icon: AlertTriangle,
    label: "Flagged",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
};

export function EvidenceStatusBadge({ status, className = "" }: EvidenceStatusBadgeProps) {
  const c = config[status] ?? config.pending;
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold ${c.color} ${c.bg} ${className}`}
      data-testid="evidence-status-badge"
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}
