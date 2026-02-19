import { ReactNode } from "react";
import { useFeatureAccess, FeatureKey, getMinimumTierForFeature } from "@/hooks/useFeatureAccess";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /** What to show when feature is locked. Defaults to a styled lock overlay. */
  fallback?: ReactNode;
  /** If true, renders nothing when locked instead of fallback */
  hideWhenLocked?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  hideWhenLocked = false 
}: FeatureGateProps) {
  const { hasAccess } = useFeatureAccess();
  
  if (hasAccess(feature)) {
    return <>{children}</>;
  }
  
  if (hideWhenLocked) {
    return null;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  const requiredTier = getMinimumTierForFeature(feature);
  
  return (
    <FeatureLockedCard 
      featureName={formatFeatureName(feature)} 
      requiredTier={requiredTier} 
    />
  );
}

interface FeatureLockedCardProps {
  featureName: string;
  requiredTier: string;
  className?: string;
}

export function FeatureLockedCard({ 
  featureName, 
  requiredTier,
  className 
}: FeatureLockedCardProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 text-center",
      className
    )}>
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {featureName}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        This feature is available on the{" "}
        <span className="font-medium text-foreground capitalize">{requiredTier}</span>{" "}
        plan and above.
      </p>
      <Button asChild size="sm">
        <Link to="/settings?tab=billing">Upgrade Plan</Link>
      </Button>
    </div>
  );
}

interface FeatureLockedOverlayProps {
  feature: FeatureKey;
  children: ReactNode;
  className?: string;
}

export function FeatureLockedOverlay({ 
  feature, 
  children,
  className 
}: FeatureLockedOverlayProps) {
  const { hasAccess } = useFeatureAccess();
  const requiredTier = getMinimumTierForFeature(feature);
  
  if (hasAccess(feature)) {
    return <>{children}</>;
  }
  
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none opacity-50 blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
        <div className="text-center p-4">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">
            Upgrade to {requiredTier}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings?tab=billing">View Plans</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface FeatureBadgeProps {
  feature: FeatureKey;
  className?: string;
}

export function FeatureBadge({ feature, className }: FeatureBadgeProps) {
  const { hasAccess } = useFeatureAccess();
  
  if (hasAccess(feature)) {
    return null;
  }
  
  const requiredTier = getMinimumTierForFeature(feature);
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary",
      className
    )}>
      <Lock className="h-3 w-3" />
      {requiredTier}
    </span>
  );
}

function formatFeatureName(feature: FeatureKey): string {
  const names: Record<FeatureKey, string> = {
    equipment_tracking: "Equipment Tracking",
    invoicing_full: "Full Invoicing",
    ai_assistant: "AI Field Assistant",
    advanced_analytics: "Advanced Analytics",
    custom_workflows: "Custom Workflows",
    api_access: "API Access",
    multi_location: "Multi-location Support",
    white_label: "White-label Branding",
    custom_integrations: "Custom Integrations",
    document_management: "Document Management",
    service_requests: "Service Requests",
    calendar_sync: "Calendar Sync",
  };
  return names[feature] || feature;
}
