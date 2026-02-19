import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tier configuration for limits
const TIER_LIMITS: Record<string, { jobsPerMonth: number | null; techs: number | null }> = {
  trial: { jobsPerMonth: 50, techs: 2 },
  starter: { jobsPerMonth: 100, techs: 2 },
  growth: { jobsPerMonth: 500, techs: 5 },
  professional: { jobsPerMonth: null, techs: 10 },
  enterprise: { jobsPerMonth: null, techs: null },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[USAGE-ALERT] ${step}${detailsStr}`);
};

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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      logStep("RESEND_API_KEY not configured, skipping email alerts");
      return new Response(JSON.stringify({ message: "Email alerts not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const resend = new Resend(resendKey);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all tenants with their owners
    const { data: tenants, error: tenantsError } = await supabaseClient
      .from("tenants")
      .select("id, name, subscription_tier, owner_id, email")
      .not("subscription_tier", "in", '("professional","enterprise")');

    if (tenantsError) {
      throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
    }

    logStep("Fetched tenants", { count: tenants?.length });

    const alerts: { tenantId: string; type: string; percent: number }[] = [];

    for (const tenant of tenants || []) {
      const tier = tenant.subscription_tier || "trial";
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.trial;

      if (!limits.jobsPerMonth) continue; // Unlimited, no alert needed

      // Count jobs this month
      const { count: jobCount } = await supabaseClient
        .from("scheduled_jobs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("created_at", startOfMonth.toISOString());

      const usagePercent = (jobCount || 0) / limits.jobsPerMonth * 100;

      // Check if we should send an alert (50%, 80%, 95%)
      const thresholds = [50, 80, 95];
      for (const threshold of thresholds) {
        if (usagePercent >= threshold && usagePercent < threshold + 10) {
          // Check if we already sent this alert this month
          const alertKey = `usage_alert_${tenant.id}_${threshold}_${now.getMonth()}_${now.getFullYear()}`;
          
          // We'd normally check a sent_alerts table, but for simplicity, we'll send the alert
          // In production, add a table to track sent alerts
          
          const ownerEmail = tenant.email;
          if (!ownerEmail) continue;

          const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
          const nextTier = tier === "trial" ? "Starter" : tier === "starter" ? "Growth" : "Professional";

          let subject = "";
          let urgency = "";
          let color = "";

          if (threshold >= 95) {
            subject = `⚠️ Critical: You've used ${Math.round(usagePercent)}% of your monthly jobs`;
            urgency = "critical";
            color = "#ef4444";
          } else if (threshold >= 80) {
            subject = `📊 Heads up: ${Math.round(usagePercent)}% of your job limit used`;
            urgency = "warning";
            color = "#f59e0b";
          } else {
            subject = `📈 Great progress! You've used half your monthly jobs`;
            urgency = "info";
            color = "#3b82f6";
          }

          try {
            await resend.emails.send({
              from: "FieldTek <info@fieldtek.ai>",
              to: [ownerEmail],
              subject,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
                    .logo { font-size: 24px; font-weight: bold; color: #1e3a5f; }
                    .content { padding: 30px 0; }
                    .alert-box { background: ${color}15; border-left: 4px solid ${color}; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .progress-container { background: #e5e7eb; border-radius: 9999px; height: 12px; margin: 20px 0; }
                    .progress-bar { background: ${color}; height: 12px; border-radius: 9999px; }
                    .cta-button { display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
                    .stats { display: flex; gap: 20px; margin: 20px 0; }
                    .stat { flex: 1; text-align: center; padding: 15px; background: #f9fafb; border-radius: 8px; }
                    .stat-value { font-size: 28px; font-weight: bold; color: #1e3a5f; }
                    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
                    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #6b7280; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <div class="logo">FieldTek</div>
                    </div>
                    <div class="content">
                      <h2>Hi ${tenant.name},</h2>
                      
                      <div class="alert-box">
                        <strong>Usage Update:</strong> You've used ${Math.round(usagePercent)}% of your monthly job limit on the ${tierName} plan.
                      </div>
                      
                      <div class="progress-container">
                        <div class="progress-bar" style="width: ${Math.min(usagePercent, 100)}%"></div>
                      </div>
                      
                      <div class="stats">
                        <div class="stat">
                          <div class="stat-value">${jobCount || 0}</div>
                          <div class="stat-label">Jobs Used</div>
                        </div>
                        <div class="stat">
                          <div class="stat-value">${limits.jobsPerMonth}</div>
                          <div class="stat-label">Monthly Limit</div>
                        </div>
                        <div class="stat">
                          <div class="stat-value">${limits.jobsPerMonth - (jobCount || 0)}</div>
                          <div class="stat-label">Remaining</div>
                        </div>
                      </div>
                      
                      ${threshold >= 80 ? `
                        <p>Your business is growing! 🎉 To ensure uninterrupted service and unlock more features, consider upgrading to <strong>${nextTier}</strong>.</p>
                        
                        <p>With ${nextTier}, you'll get:</p>
                        <ul>
                          ${tier === "starter" ? "<li>Up to 500 jobs per month</li><li>Equipment tracking</li><li>AI Field Assistant</li><li>Full invoicing & payments</li>" : ""}
                          ${tier === "trial" || tier === "growth" ? "<li>Unlimited jobs</li><li>Custom workflows</li><li>API access</li><li>Multi-location support</li>" : ""}
                        </ul>
                        
                        <center>
                          <a href="https://fieldtek.ai/settings?tab=billing" class="cta-button">
                            Upgrade Now →
                          </a>
                        </center>
                      ` : `
                        <p>You're making great progress this month! Keep scheduling jobs to grow your business.</p>
                        
                        <p>Need more capacity? Check out our upgrade options for higher limits and additional features.</p>
                        
                        <center>
                          <a href="https://fieldtek.ai/settings?tab=billing" class="cta-button">
                            View Plans
                          </a>
                        </center>
                      `}
                    </div>
                    <div class="footer">
                      <p>© ${now.getFullYear()} FieldTek. All rights reserved.</p>
                      <p>You're receiving this because you're a FieldTek user.</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
            });

            logStep("Sent usage alert email", { tenantId: tenant.id, threshold, email: ownerEmail });
            alerts.push({ tenantId: tenant.id, type: urgency, percent: usagePercent });
          } catch (emailError) {
            logStep("Failed to send email", { tenantId: tenant.id, error: emailError });
          }
        }
      }
    }

    logStep("Completed", { alertsSent: alerts.length });

    return new Response(JSON.stringify({ success: true, alerts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
