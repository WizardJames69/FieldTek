import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { TIER_CONFIG, SubscriptionTier } from "@/config/pricing";

export interface UsageStats {
  technicians: number;
  jobsThisMonth: number;
  storageUsed: number;
  aiConversations: number;
  clients: number;
  documents: number;
}

export interface UsageLimits {
  techsLimit: number | null;
  jobsLimit: number | null;
  officeUsersLimit: number | null;
  storageLimit: number | null; // bytes
}

export interface UsageAnalysis {
  stats: UsageStats | null;
  limits: UsageLimits;
  percentages: {
    jobs: number;
    techs: number;
    storage: number;
  };
  thresholds: {
    jobs: "normal" | "warning" | "critical";
    techs: "normal" | "warning" | "critical";
    storage: "normal" | "warning" | "critical";
  };
  suggestions: UsageSuggestion[];
  isLoading: boolean;
}

export interface UsageSuggestion {
  type: "upgrade" | "feature" | "action";
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  priority: "low" | "medium" | "high";
}

function getThresholdLevel(percent: number): "normal" | "warning" | "critical" {
  if (percent >= 95) return "critical";
  if (percent >= 80) return "warning";
  return "normal";
}

export function useUsageStats(): UsageAnalysis {
  const { tenant } = useTenant();

  const currentTier = (tenant?.subscription_tier as SubscriptionTier) || "trial";
  const tierConfig = TIER_CONFIG[currentTier];

  const { data: stats, isLoading } = useQuery({
    queryKey: ["usage-stats", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [techRes, jobsRes, docsRes, aiRes, clientsRes] = await Promise.all([
        supabase
          .from("tenant_users")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("role", "technician")
          .eq("is_active", true),
        supabase
          .from("scheduled_jobs")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", startOfMonth.toISOString()),
        supabase
          .from("documents")
          .select("file_size")
          .eq("tenant_id", tenant.id),
        supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("created_at", startOfMonth.toISOString()),
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id),
      ]);

      const storageUsed = docsRes.data?.reduce((acc, doc) => acc + (doc.file_size || 0), 0) || 0;

      return {
        technicians: techRes.count || 0,
        jobsThisMonth: jobsRes.count || 0,
        storageUsed,
        aiConversations: aiRes.count || 0,
        clients: clientsRes.count || 0,
        documents: docsRes.data?.length || 0,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60000, // Cache for 1 minute
  });

  // Calculate limits
  const jobsLimit = typeof tierConfig.jobsPerMonth === "number" ? tierConfig.jobsPerMonth : null;
  const techsLimit = typeof tierConfig.includedTechs === "number" ? tierConfig.includedTechs : null;
  const officeUsersLimit = typeof tierConfig.officeUsers === "number" ? tierConfig.officeUsers : null;
  const storageLimit = tierConfig.storageQuotaBytes;

  // Calculate percentages
  const jobsPercent = jobsLimit && stats 
    ? Math.min((stats.jobsThisMonth / jobsLimit) * 100, 100) 
    : 0;
  const techsPercent = techsLimit && stats 
    ? Math.min((stats.technicians / techsLimit) * 100, 100) 
    : 0;
  const storagePercent = storageLimit && stats
    ? Math.min((stats.storageUsed / storageLimit) * 100, 100)
    : 0;

  // Generate smart suggestions
  const suggestions: UsageSuggestion[] = [];

  // Job limit suggestions
  if (jobsPercent >= 95) {
    suggestions.push({
      type: "upgrade",
      title: "You've almost reached your job limit",
      description: `You've used ${stats?.jobsThisMonth || 0} of ${jobsLimit} jobs this month. Upgrade to continue scheduling without interruption.`,
      action: { label: "Upgrade Now", href: "/settings?tab=billing" },
      priority: "high",
    });
  } else if (jobsPercent >= 80) {
    suggestions.push({
      type: "upgrade",
      title: "Approaching job limit",
      description: `You're at ${Math.round(jobsPercent)}% of your monthly job limit. Consider upgrading for unlimited jobs.`,
      action: { label: "View Plans", href: "/settings?tab=billing" },
      priority: "medium",
    });
  }

  // Technician limit suggestions
  if (techsLimit && stats && stats.technicians >= techsLimit) {
    suggestions.push({
      type: "upgrade",
      title: "Technician limit reached",
      description: `You have ${stats.technicians} technicians but your plan includes ${techsLimit}. Upgrade to add more team members.`,
      action: { label: "Add More Seats", href: "/settings?tab=billing" },
      priority: "high",
    });
  } else if (techsPercent >= 80) {
    suggestions.push({
      type: "upgrade",
      title: "Team growing fast",
      description: `You're using ${stats?.technicians || 0} of ${techsLimit} technician seats. Upgrade to support your growing team.`,
      action: { label: "View Plans", href: "/settings?tab=billing" },
      priority: "medium",
    });
  }

  // Storage limit suggestions
  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  };

  if (storagePercent >= 95 && storageLimit) {
    suggestions.push({
      type: "upgrade",
      title: "Storage almost full",
      description: `You've used ${formatBytes(stats?.storageUsed || 0)} of ${formatBytes(storageLimit)}. Upgrade for more storage.`,
      action: { label: "Upgrade Now", href: "/settings?tab=billing" },
      priority: "high",
    });
  } else if (storagePercent >= 80 && storageLimit) {
    suggestions.push({
      type: "upgrade",
      title: "Approaching storage limit",
      description: `${Math.round(storagePercent)}% of storage used (${formatBytes(stats?.storageUsed || 0)} of ${formatBytes(storageLimit)}). Consider upgrading.`,
      action: { label: "View Plans", href: "/settings?tab=billing" },
      priority: "medium",
    });
  }

  // Feature suggestions based on usage patterns
  if (stats && stats.clients > 20 && currentTier === "starter") {
    suggestions.push({
      type: "feature",
      title: "Unlock Equipment Tracking",
      description: "With over 20 clients, equipment tracking can help you manage service history and warranties more efficiently.",
      action: { label: "Learn More", href: "/settings?tab=billing" },
      priority: "low",
    });
  }

  if (stats && stats.jobsThisMonth > 50 && currentTier !== "professional" && currentTier !== "enterprise") {
    suggestions.push({
      type: "feature",
      title: "Try Advanced Analytics",
      description: "You're processing significant job volume. Advanced analytics can help optimize scheduling and identify trends.",
      action: { label: "Upgrade for Analytics", href: "/settings?tab=billing" },
      priority: "low",
    });
  }

  // Trial-specific suggestions
  if (currentTier === "trial") {
    suggestions.push({
      type: "action",
      title: "Your trial is active",
      description: "Explore all features during your trial. Upgrade anytime to keep your data and continue using FieldTek.",
      action: { label: "Choose a Plan", href: "/settings?tab=billing" },
      priority: "low",
    });
  }

  return {
    stats,
    limits: {
      techsLimit,
      jobsLimit,
      officeUsersLimit,
      storageLimit,
    },
    percentages: {
      jobs: jobsPercent,
      techs: techsPercent,
      storage: storagePercent,
    },
    thresholds: {
      jobs: getThresholdLevel(jobsPercent),
      techs: getThresholdLevel(techsPercent),
      storage: getThresholdLevel(storagePercent),
    },
    suggestions: suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    isLoading,
  };
}
