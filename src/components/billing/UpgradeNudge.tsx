import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useTenant } from "@/contexts/TenantContext";
import { TIER_CONFIG, SubscriptionTier, UPGRADE_PATH } from "@/config/pricing";
import { useState, useEffect } from "react";

interface UpgradeNudgeProps {
  /** Where this nudge is being shown - affects messaging */
  context?: "jobs" | "team" | "equipment" | "invoices" | "analytics" | "storage" | "general";
  /** Allow user to dismiss */
  dismissible?: boolean;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Custom class */
  className?: string;
}

export function UpgradeNudge({ 
  context = "general", 
  dismissible = true,
  compact = false,
  className 
}: UpgradeNudgeProps) {
  const { tenant } = useTenant();
  const { thresholds, percentages, limits, stats } = useUsageStats();
  const [dismissed, setDismissed] = useState(false);
  const [dismissKey, setDismissKey] = useState("");

  const currentTier = (tenant?.subscription_tier as SubscriptionTier) || "trial";

  // Generate a storage key for dismissal
  useEffect(() => {
    const key = `upgrade-nudge-${context}-${currentTier}-dismissed`;
    setDismissKey(key);
    const wasDismissed = sessionStorage.getItem(key);
    if (wasDismissed) {
      setDismissed(true);
    }
  }, [context, currentTier]);

  const handleDismiss = () => {
    setDismissed(true);
    if (dismissKey) {
      sessionStorage.setItem(dismissKey, "true");
    }
  };

  // Don't show for top-tier users
  if (currentTier === "professional" || currentTier === "enterprise") {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Get next tier
  const currentIndex = UPGRADE_PATH.indexOf(currentTier);
  const nextTier = UPGRADE_PATH[currentIndex + 1] as SubscriptionTier | undefined;
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;

  // Determine urgency and message based on context and thresholds
  let urgency: "low" | "medium" | "high" = "low";
  let message = "";
  let subMessage = "";

  switch (context) {
    case "jobs":
      if (thresholds.jobs === "critical") {
        urgency = "high";
        message = "You're almost at your job limit";
        subMessage = `${stats?.jobsThisMonth || 0}/${limits.jobsLimit} jobs used. Upgrade for unlimited scheduling.`;
      } else if (thresholds.jobs === "warning") {
        urgency = "medium";
        message = "Running low on job capacity";
        subMessage = `${Math.round(percentages.jobs)}% of monthly jobs used. Plan ahead with an upgrade.`;
      } else {
        return null; // No nudge needed
      }
      break;

    case "team":
      if (thresholds.techs === "critical") {
        urgency = "high";
        message = "Technician limit reached";
        subMessage = `Add more team members by upgrading to ${nextTierConfig?.name || "a higher plan"}.`;
      } else if (thresholds.techs === "warning") {
        urgency = "medium";
        message = "Your team is growing";
        subMessage = `${stats?.technicians}/${limits.techsLimit} seats used. Upgrade for more capacity.`;
      } else {
        return null;
      }
      break;

    case "equipment":
      if (currentTier === "starter") {
        urgency = "low";
        message = "Unlock Equipment Tracking";
        subMessage = "Track service history, warranties, and maintenance schedules.";
      } else {
        return null;
      }
      break;

    case "invoices":
      if (currentTier === "starter") {
        urgency = "low";
        message = "Unlock Full Invoicing";
        subMessage = "Create professional invoices and accept online payments.";
      } else {
        return null;
      }
      break;

    case "analytics":
      if (currentTier === "starter" || currentTier === "trial") {
        urgency = "low";
        message = "Unlock Advanced Analytics";
        subMessage = "Get deeper insights into your business performance.";
      } else {
        return null;
      }
      break;

    default:
      if (currentTier === "trial") {
        urgency = "low";
        message = "Enjoying your trial?";
        subMessage = "Upgrade to keep all your data and unlock more features.";
      } else if (thresholds.jobs === "critical" || thresholds.techs === "critical") {
        urgency = "high";
        message = "You're approaching plan limits";
        subMessage = "Upgrade to continue growing your business.";
      } else if (thresholds.jobs === "warning" || thresholds.techs === "warning") {
        urgency = "medium";
        message = "Room to grow?";
        subMessage = `Upgrade to ${nextTierConfig?.name || "the next tier"} for more capacity.`;
      } else {
        return null;
      }
  }

  const urgencyStyles = {
    high: "bg-destructive/10 border-destructive/30 text-destructive",
    medium: "bg-warning/10 border-warning/30 text-warning",
    low: "bg-primary/5 border-primary/20 text-primary",
  };

  const iconStyles = {
    high: "text-destructive",
    medium: "text-warning",
    low: "text-primary",
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
        urgencyStyles[urgency],
        className
      )}>
        {urgency === "high" && <AlertTriangle className={cn("h-4 w-4 shrink-0", iconStyles[urgency])} />}
        {urgency === "medium" && <TrendingUp className={cn("h-4 w-4 shrink-0", iconStyles[urgency])} />}
        {urgency === "low" && <Sparkles className={cn("h-4 w-4 shrink-0", iconStyles[urgency])} />}
        <span className="flex-1 font-medium">{message}</span>
        <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
          <Link to="/settings?tab=billing">
            Upgrade
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative p-4 rounded-lg border",
      urgencyStyles[urgency],
      className
    )}>
      {dismissible && (
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-full bg-background/50", iconStyles[urgency])}>
          {urgency === "high" && <AlertTriangle className="h-5 w-5" />}
          {urgency === "medium" && <TrendingUp className="h-5 w-5" />}
          {urgency === "low" && <Zap className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="font-semibold">{message}</p>
          <p className="text-sm mt-0.5 opacity-80">{subMessage}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" asChild>
              <Link to="/settings?tab=billing">
                <Zap className="h-4 w-4 mr-1" />
                {nextTierConfig ? `Upgrade to ${nextTierConfig.name}` : "View Plans"}
              </Link>
            </Button>
            {nextTierConfig?.monthlyPrice && (
              <span className="text-sm opacity-70">
                From ${nextTierConfig.monthlyPrice}/mo
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A minimal inline upgrade prompt for use in feature-locked states
 */
export function InlineUpgradePrompt({ 
  feature, 
  requiredTier 
}: { 
  feature: string; 
  requiredTier: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="h-4 w-4 text-primary" />
      <span>
        {feature} requires the{" "}
        <Link to="/settings?tab=billing" className="font-medium text-primary hover:underline">
          {requiredTier} plan
        </Link>
      </span>
    </div>
  );
}
