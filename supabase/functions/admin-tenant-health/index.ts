import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-TENANT-HEALTH] ${step}${detailsStr}`);
};

interface TenantHealth {
  id: string;
  name: string;
  industry: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  activityScore: number;
  churnRisk: "low" | "medium" | "high" | "critical";
  lastActivityDate: string | null;
  totalJobs: number;
  jobsLast30Days: number;
  activeUsers: number;
  totalUsers: number;
  daysSinceLastJob: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { data: adminData, error: adminError } = await supabaseClient
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (adminError || !adminData) {
      throw new Error("Access denied: Platform admin privileges required");
    }
    logStep("Admin verified", { userId: user.id });

    // Fetch all tenants
    const { data: tenants, error: tenantsError } = await supabaseClient
      .from("tenants")
      .select("*");

    if (tenantsError) throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    logStep("Fetched tenants", { count: tenants?.length });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const tenantHealthData: TenantHealth[] = [];

    for (const tenant of tenants || []) {
      // Get total jobs for tenant
      const { count: totalJobs } = await supabaseClient
        .from("scheduled_jobs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id);

      // Get jobs in last 30 days
      const { count: jobsLast30Days } = await supabaseClient
        .from("scheduled_jobs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("created_at", thirtyDaysAgoStr);

      // Get most recent job date
      const { data: recentJob } = await supabaseClient
        .from("scheduled_jobs")
        .select("created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Get tenant users
      const { data: tenantUsers, count: totalUsers } = await supabaseClient
        .from("tenant_users")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id);

      const activeUsers = tenantUsers?.filter((u) => u.is_active)?.length || 0;

      // Calculate days since last job
      let daysSinceLastJob: number | null = null;
      let lastActivityDate: string | null = null;
      if (recentJob?.created_at) {
        lastActivityDate = recentJob.created_at;
        const lastJobDate = new Date(recentJob.created_at);
        const now = new Date();
        daysSinceLastJob = Math.floor((now.getTime() - lastJobDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Calculate activity score (0-100)
      let activityScore = 0;

      // Jobs in last 30 days contributes up to 40 points
      const jobScore = Math.min(40, (jobsLast30Days || 0) * 4);
      activityScore += jobScore;

      // Active users contributes up to 30 points
      const userScore = Math.min(30, (activeUsers || 0) * 10);
      activityScore += userScore;

      // Recency contributes up to 30 points
      if (daysSinceLastJob !== null) {
        if (daysSinceLastJob <= 1) activityScore += 30;
        else if (daysSinceLastJob <= 3) activityScore += 25;
        else if (daysSinceLastJob <= 7) activityScore += 20;
        else if (daysSinceLastJob <= 14) activityScore += 10;
        else if (daysSinceLastJob <= 30) activityScore += 5;
      }

      // Determine churn risk
      let churnRisk: "low" | "medium" | "high" | "critical" = "low";

      // Trial about to expire
      const isTrialEnding = tenant.trial_ends_at && 
        new Date(tenant.trial_ends_at) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) &&
        tenant.subscription_status === "trial";

      if (activityScore < 20 || (daysSinceLastJob !== null && daysSinceLastJob > 30)) {
        churnRisk = "critical";
      } else if (activityScore < 40 || (daysSinceLastJob !== null && daysSinceLastJob > 14) || isTrialEnding) {
        churnRisk = "high";
      } else if (activityScore < 60 || (daysSinceLastJob !== null && daysSinceLastJob > 7)) {
        churnRisk = "medium";
      }

      tenantHealthData.push({
        id: tenant.id,
        name: tenant.name,
        industry: tenant.industry,
        subscriptionTier: tenant.subscription_tier,
        subscriptionStatus: tenant.subscription_status,
        trialEndsAt: tenant.trial_ends_at,
        createdAt: tenant.created_at,
        activityScore,
        churnRisk,
        lastActivityDate,
        totalJobs: totalJobs || 0,
        jobsLast30Days: jobsLast30Days || 0,
        activeUsers,
        totalUsers: totalUsers || 0,
        daysSinceLastJob,
      });
    }

    // Sort by churn risk (critical first) then by activity score (lowest first)
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    tenantHealthData.sort((a, b) => {
      const riskDiff = riskOrder[a.churnRisk] - riskOrder[b.churnRisk];
      if (riskDiff !== 0) return riskDiff;
      return a.activityScore - b.activityScore;
    });

    // Calculate summary stats
    const summary = {
      totalTenants: tenantHealthData.length,
      criticalRisk: tenantHealthData.filter((t) => t.churnRisk === "critical").length,
      highRisk: tenantHealthData.filter((t) => t.churnRisk === "high").length,
      mediumRisk: tenantHealthData.filter((t) => t.churnRisk === "medium").length,
      lowRisk: tenantHealthData.filter((t) => t.churnRisk === "low").length,
      avgActivityScore: tenantHealthData.length > 0
        ? Math.round(tenantHealthData.reduce((sum, t) => sum + t.activityScore, 0) / tenantHealthData.length)
        : 0,
      activeLast7Days: tenantHealthData.filter((t) => t.daysSinceLastJob !== null && t.daysSinceLastJob <= 7).length,
    };

    logStep("Health data calculated", { summary });

    return new Response(
      JSON.stringify({ tenants: tenantHealthData, summary }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
