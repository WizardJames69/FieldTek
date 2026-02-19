import { Crown, Briefcase, Zap } from "lucide-react";

export type SubscriptionTier = "trial" | "starter" | "growth" | "professional" | "enterprise";

export interface TierConfig {
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  includedTechs: number | string;
  additionalTechPrice: number | string;
  officeUsers: number | string;
  jobsPerMonth: number | string;
  /** Storage quota in bytes. null = unlimited */
  storageQuotaBytes: number | null;
  features: string[];
  cta: string;
  href: string;
  popular: boolean;
  color: string;
  icon: typeof Crown;
  stripeTier?: string;
}

/** Convenience constants for storage quotas */
const GB = 1024 * 1024 * 1024;

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  trial: {
    name: "Trial",
    description: "14-day free trial to explore all features",
    monthlyPrice: 0,
    yearlyPrice: 0,
    includedTechs: 2,
    additionalTechPrice: 0,
    officeUsers: 2,
    jobsPerMonth: 50,
    storageQuotaBytes: 500 * 1024 * 1024, // 500MB
    features: [
      "Job scheduling & dispatch",
      "Customer management",
      "Mobile app access",
      "Basic reporting",
    ],
    cta: "Current Plan",
    href: "#",
    popular: false,
    color: "bg-muted text-muted-foreground",
    icon: Zap,
  },
  starter: {
    name: "Starter",
    description: "Perfect for small teams getting started",
    monthlyPrice: 99,
    yearlyPrice: 79,
    includedTechs: 2,
    additionalTechPrice: 35,
    officeUsers: 2,
    jobsPerMonth: 100,
    storageQuotaBytes: 1 * GB, // 1GB
    features: [
      "Job scheduling & dispatch",
      "Customer management",
      "Mobile app access",
      "Basic reporting",
      "Email support",
    ],
    cta: "Join Waitlist",
    href: "/register",
    popular: false,
    color: "bg-blue-500/10 text-blue-600",
    icon: Zap,
    stripeTier: "starter",
  },
  growth: {
    name: "Growth",
    description: "For growing businesses ready to scale",
    monthlyPrice: 229,
    yearlyPrice: 183,
    includedTechs: 5,
    additionalTechPrice: 49,
    officeUsers: 5,
    jobsPerMonth: 500,
    storageQuotaBytes: 5 * GB, // 5GB
    features: [
      "Everything in Starter",
      "Equipment tracking",
      "Invoicing & payments",
      "AI Field Assistant",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Join Waitlist",
    href: "/register",
    popular: true,
    color: "bg-primary/10 text-primary",
    icon: Briefcase,
    stripeTier: "growth",
  },
  professional: {
    name: "Professional",
    description: "For established operations at scale",
    monthlyPrice: 449,
    yearlyPrice: 359,
    includedTechs: 10,
    additionalTechPrice: 59,
    officeUsers: "Unlimited",
    jobsPerMonth: "Unlimited",
    storageQuotaBytes: 25 * GB, // 25GB
    features: [
      "Everything in Growth",
      "Custom workflows",
      "API access",
      "Multi-location support",
      "Advanced AI features",
      "Dedicated success manager",
    ],
    cta: "Join Waitlist",
    href: "/register",
    popular: false,
    color: "bg-purple-500/10 text-purple-600",
    icon: Crown,
    stripeTier: "professional",
  },
  enterprise: {
    name: "Enterprise",
    description: "For large organizations with custom needs",
    monthlyPrice: null,
    yearlyPrice: null,
    includedTechs: "Unlimited",
    additionalTechPrice: "Negotiated",
    officeUsers: "Unlimited",
    jobsPerMonth: "Unlimited",
    storageQuotaBytes: null, // Unlimited
    features: [
      "Everything in Professional",
      "White-label branding",
      "Custom integrations",
      "On-premise deployment",
      "SLA guarantee",
      "Custom training & onboarding",
    ],
    cta: "Contact Sales",
    href: "/consultation",
    popular: false,
    color: "bg-amber-500/10 text-amber-600",
    icon: Crown,
  },
};

export const UPGRADE_PATH: SubscriptionTier[] = ["trial", "starter", "growth", "professional", "enterprise"];

export const FEATURE_COMPARISON = [
  { feature: "Team Management", starter: true, growth: true, professional: true, enterprise: true },
  { feature: "Job Scheduling & Dispatch", starter: true, growth: true, professional: true, enterprise: true },
  { feature: "Customer Management", starter: true, growth: true, professional: true, enterprise: true },
  { feature: "Mobile App Access", starter: true, growth: true, professional: true, enterprise: true },
  { feature: "Equipment Tracking", starter: false, growth: true, professional: true, enterprise: true },
  { feature: "Invoicing & Payments", starter: false, growth: true, professional: true, enterprise: true },
  { feature: "AI Field Assistant", starter: false, growth: true, professional: true, enterprise: true },
  { feature: "Advanced Analytics", starter: false, growth: true, professional: true, enterprise: true },
  { feature: "Custom Workflows", starter: false, growth: false, professional: true, enterprise: true },
  { feature: "API Access", starter: false, growth: false, professional: true, enterprise: true },
  { feature: "Multi-location Support", starter: false, growth: false, professional: true, enterprise: true },
  { feature: "White-label Branding", starter: false, growth: false, professional: false, enterprise: true },
  { feature: "Custom Integrations", starter: false, growth: false, professional: false, enterprise: true },
  { feature: "SLA Guarantee", starter: false, growth: false, professional: false, enterprise: true },
];

// Helper to get tier by stripeTier
export function getTierByStripeTier(stripeTier: string): SubscriptionTier | undefined {
  return (Object.keys(TIER_CONFIG) as SubscriptionTier[]).find(
    (key) => TIER_CONFIG[key].stripeTier === stripeTier
  );
}

// Helper to check if tier can upgrade to another
export function canUpgradeTo(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
  const currentIndex = UPGRADE_PATH.indexOf(currentTier);
  const targetIndex = UPGRADE_PATH.indexOf(targetTier);
  return targetIndex > currentIndex;
}
