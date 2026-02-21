import { useTenant } from "@/contexts/TenantContext";

export type SubscriptionTier = "trial" | "starter" | "growth" | "professional" | "enterprise";

export type FeatureKey =
  | "equipment_tracking"
  | "invoicing_full"
  | "ai_assistant"
  | "advanced_analytics"
  | "custom_workflows"
  | "api_access"
  | "multi_location"
  | "white_label"
  | "custom_integrations"
  | "document_management"
  | "service_requests"
  | "calendar_sync";

// Define which tiers have access to each feature
// Trial users get full Professional-tier access during their 30-day trial
const FEATURE_ACCESS: Record<FeatureKey, SubscriptionTier[]> = {
  // Available to all tiers
  document_management: ["trial", "starter", "growth", "professional", "enterprise"],
  service_requests: ["trial", "starter", "growth", "professional", "enterprise"],
  
  // Growth tier and above (trial gets full access)
  equipment_tracking: ["trial", "growth", "professional", "enterprise"],
  invoicing_full: ["trial", "growth", "professional", "enterprise"],
  ai_assistant: ["trial", "growth", "professional", "enterprise"],
  advanced_analytics: ["trial", "growth", "professional", "enterprise"],
  calendar_sync: ["trial", "growth", "professional", "enterprise"],
  
  // Professional tier and above (trial gets full access)
  custom_workflows: ["trial", "professional", "enterprise"],
  api_access: ["trial", "professional", "enterprise"],
  multi_location: ["trial", "professional", "enterprise"],
  
  // Enterprise only (kept exclusive)
  white_label: ["enterprise"],
  custom_integrations: ["enterprise"],
};

// Tier hierarchy for upgrade suggestions
const TIER_HIERARCHY: SubscriptionTier[] = [
  "trial",
  "starter",
  "growth",
  "professional",
  "enterprise",
];

export function getMinimumTierForFeature(feature: FeatureKey): SubscriptionTier {
  const allowedTiers = FEATURE_ACCESS[feature];
  for (const tier of TIER_HIERARCHY) {
    if (allowedTiers.includes(tier)) {
      return tier;
    }
  }
  return "enterprise";
}

// Features that remain accessible even when subscription is blocked
const UNIVERSAL_FEATURES: FeatureKey[] = ["document_management", "service_requests"];

export function useFeatureAccess() {
  const { tenant } = useTenant();

  const currentTier: SubscriptionTier = (tenant?.subscription_tier as SubscriptionTier) || "trial";
  const subscriptionStatus = (tenant?.subscription_status as string) || "trial";
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const cancelAtPeriodEnd = tenant?.cancel_at_period_end || false;

  // Determine if subscription status blocks access
  const isStatusBlocked =
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "cancelled" ||
    (subscriptionStatus === "trial" && trialEndsAt !== null && trialEndsAt < new Date());

  const isPastDue = subscriptionStatus === "past_due";

  const hasAccess = (feature: FeatureKey): boolean => {
    // Canceled/expired trials: only universal features remain accessible
    if (isStatusBlocked) {
      return UNIVERSAL_FEATURES.includes(feature);
    }

    // past_due: allow UI access (DB triggers block creation server-side)
    // active/trialing/trial: normal tier-based access
    const allowedTiers = FEATURE_ACCESS[feature];
    return allowedTiers.includes(currentTier);
  };

  const getUpgradeTier = (feature: FeatureKey): SubscriptionTier | null => {
    if (hasAccess(feature)) return null;
    return getMinimumTierForFeature(feature);
  };

  const getTierIndex = (tier: SubscriptionTier): number => {
    return TIER_HIERARCHY.indexOf(tier);
  };

  const isAtLeastTier = (tier: SubscriptionTier): boolean => {
    return getTierIndex(currentTier) >= getTierIndex(tier);
  };

  return {
    currentTier,
    subscriptionStatus,
    isPastDue,
    isStatusBlocked,
    cancelAtPeriodEnd,
    hasAccess,
    getUpgradeTier,
    isAtLeastTier,
    FEATURE_ACCESS,
  };
}
