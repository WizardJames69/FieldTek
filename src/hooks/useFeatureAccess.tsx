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
// Trial users get full Professional-tier access during their 14-day trial
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

export function useFeatureAccess() {
  const { tenant } = useTenant();
  
  const currentTier: SubscriptionTier = (tenant?.subscription_tier as SubscriptionTier) || "trial";
  
  const hasAccess = (feature: FeatureKey): boolean => {
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
    hasAccess,
    getUpgradeTier,
    isAtLeastTier,
    FEATURE_ACCESS,
  };
}
