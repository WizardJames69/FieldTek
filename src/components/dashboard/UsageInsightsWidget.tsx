import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  Sparkles,
  Users,
  Briefcase,
  Zap,
  ChevronRight,
  Lightbulb
} from "lucide-react";
import { useUsageStats, UsageSuggestion } from "@/hooks/useUsageStats";
import { useTenant } from "@/contexts/TenantContext";
import { TIER_CONFIG, SubscriptionTier } from "@/config/pricing";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function UsageInsightsWidget() {
  const { tenant } = useTenant();
  const { stats, limits, percentages, thresholds, suggestions, isLoading } = useUsageStats();

  const currentTier = (tenant?.subscription_tier as SubscriptionTier) || "trial";
  const tierConfig = TIER_CONFIG[currentTier];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Don't show if no meaningful usage yet
  if (!stats || (stats.jobsThisMonth === 0 && suggestions.length === 0)) {
    return null;
  }

  const hasWarnings = thresholds.jobs !== "normal" || thresholds.techs !== "normal";
  const topSuggestions = suggestions.slice(0, 2);

  return (
    <Card className={cn(
      "transition-all",
      hasWarnings && "border-warning/50 bg-warning/5"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Usage Insights</CardTitle>
            {hasWarnings && (
              <Badge variant="outline" className="border-warning text-warning text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Attention Needed
              </Badge>
            )}
          </div>
          <Badge variant="secondary" className={cn(tierConfig.color, "text-xs")}>
            {tierConfig.name} Plan
          </Badge>
        </div>
        <CardDescription>
          Your current plan usage and recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Meters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Jobs Usage */}
          {limits.jobsLimit && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Jobs This Month
                </div>
                <span className={cn(
                  "text-sm font-semibold",
                  thresholds.jobs === "critical" && "text-destructive",
                  thresholds.jobs === "warning" && "text-warning"
                )}>
                  {stats.jobsThisMonth} / {limits.jobsLimit}
                </span>
              </div>
              <Progress 
                value={percentages.jobs} 
                className={cn(
                  "h-2",
                  thresholds.jobs === "warning" && "[&>div]:bg-warning",
                  thresholds.jobs === "critical" && "[&>div]:bg-destructive"
                )}
              />
              {thresholds.jobs === "critical" && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Almost at limit - upgrade to continue scheduling
                </p>
              )}
            </div>
          )}

          {/* Technicians Usage */}
          {limits.techsLimit && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Technicians
                </div>
                <span className={cn(
                  "text-sm font-semibold",
                  thresholds.techs === "critical" && "text-destructive",
                  thresholds.techs === "warning" && "text-warning"
                )}>
                  {stats.technicians} / {limits.techsLimit}
                </span>
              </div>
              <Progress 
                value={percentages.techs} 
                className={cn(
                  "h-2",
                  thresholds.techs === "warning" && "[&>div]:bg-warning",
                  thresholds.techs === "critical" && "[&>div]:bg-destructive"
                )}
              />
              {thresholds.techs === "critical" && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Add more seats to grow your team
                </p>
              )}
            </div>
          )}
        </div>

        {/* Smart Suggestions */}
        {topSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Lightbulb className="h-4 w-4" />
              Recommendations
            </div>
            <div className="space-y-2">
              {topSuggestions.map((suggestion, idx) => (
                <SuggestionCard key={idx} suggestion={suggestion} />
              ))}
            </div>
          </div>
        )}

        {/* View All / Upgrade CTA */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings?tab=billing" className="text-muted-foreground">
              View full billing details
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
          {currentTier !== "professional" && currentTier !== "enterprise" && (
            <Button size="sm" asChild>
              <Link to="/settings?tab=billing">
                <Zap className="h-4 w-4 mr-1" />
                Upgrade Plan
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionCard({ suggestion }: { suggestion: UsageSuggestion }) {
  const priorityStyles = {
    high: "border-destructive/30 bg-destructive/5",
    medium: "border-warning/30 bg-warning/5",
    low: "border-border bg-muted/30",
  };

  const iconStyles = {
    high: "text-destructive",
    medium: "text-warning",
    low: "text-primary",
  };

  return (
    <div className={cn(
      "p-3 rounded-lg border transition-colors hover:bg-muted/50",
      priorityStyles[suggestion.priority]
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", iconStyles[suggestion.priority])}>
          {suggestion.type === "upgrade" && <Zap className="h-4 w-4" />}
          {suggestion.type === "feature" && <Sparkles className="h-4 w-4" />}
          {suggestion.type === "action" && <Lightbulb className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{suggestion.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {suggestion.description}
          </p>
        </div>
        {suggestion.action && (
          <Button variant="ghost" size="sm" className="shrink-0 h-8 px-2" asChild>
            <Link to={suggestion.action.href}>
              {suggestion.action.label}
              <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
