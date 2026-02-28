import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MetricResult {
  type: string;
  value: number | null;
  status: "healthy" | "degraded" | "unhealthy";
  metadata?: Record<string, unknown>;
}

interface AlertCheck {
  shouldAlert: boolean;
  alertType: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  source: string;
}

// Thresholds for alerting
const THRESHOLDS = {
  database_latency_warning: 500, // ms
  database_latency_critical: 2000, // ms
  stripe_latency_warning: 1000, // ms
  stripe_latency_critical: 3000, // ms
  error_rate_warning: 0.01, // 1%
  error_rate_critical: 0.05, // 5%
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const metrics: MetricResult[] = [];
  const alerts: AlertCheck[] = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check Database Health
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("tenants").select("id").limit(1);
      const dbLatency = Date.now() - dbStart;

      let dbStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (error) {
        dbStatus = "unhealthy";
        alerts.push({
          shouldAlert: true,
          alertType: "database_down",
          severity: "critical",
          message: `Database query failed: ${error.message}`,
          source: "monitor-health",
        });
      } else if (dbLatency > THRESHOLDS.database_latency_critical) {
        dbStatus = "unhealthy";
        alerts.push({
          shouldAlert: true,
          alertType: "database_latency",
          severity: "high",
          message: `Database latency critical: ${dbLatency}ms`,
          source: "monitor-health",
        });
      } else if (dbLatency > THRESHOLDS.database_latency_warning) {
        dbStatus = "degraded";
        alerts.push({
          shouldAlert: true,
          alertType: "database_latency",
          severity: "medium",
          message: `Database latency elevated: ${dbLatency}ms`,
          source: "monitor-health",
        });
      }

      metrics.push({
        type: "database_latency",
        value: dbLatency,
        status: dbStatus,
        metadata: { error: error?.message },
      });
    } catch (dbError: any) {
      metrics.push({
        type: "database_latency",
        value: null,
        status: "unhealthy",
        metadata: { error: dbError.message },
      });
      alerts.push({
        shouldAlert: true,
        alertType: "database_down",
        severity: "critical",
        message: `Database unreachable: ${dbError.message}`,
        source: "monitor-health",
      });
    }

    // 2. Check Auth Service
    const authStart = Date.now();
    try {
      const { error: authError } = await supabase.auth.getSession();
      const authLatency = Date.now() - authStart;

      let authStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (authError) {
        authStatus = "degraded";
      } else if (authLatency > 2000) {
        authStatus = "degraded";
      }

      metrics.push({
        type: "auth_latency",
        value: authLatency,
        status: authStatus,
        metadata: { error: authError?.message },
      });
    } catch (authErr: any) {
      metrics.push({
        type: "auth_latency",
        value: null,
        status: "unhealthy",
        metadata: { error: authErr.message },
      });
    }

    // 3. Check Stripe Connectivity
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripeStart = Date.now();
      try {
        const stripe = new Stripe(stripeKey, {
          apiVersion: "2023-10-16",
          httpClient: Stripe.createFetchHttpClient(),
        });
        
        await stripe.balance.retrieve();
        const stripeLatency = Date.now() - stripeStart;

        let stripeStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
        if (stripeLatency > THRESHOLDS.stripe_latency_critical) {
          stripeStatus = "unhealthy";
          alerts.push({
            shouldAlert: true,
            alertType: "stripe_latency",
            severity: "high",
            message: `Stripe API latency critical: ${stripeLatency}ms`,
            source: "monitor-health",
          });
        } else if (stripeLatency > THRESHOLDS.stripe_latency_warning) {
          stripeStatus = "degraded";
        }

        metrics.push({
          type: "stripe_latency",
          value: stripeLatency,
          status: stripeStatus,
        });
      } catch (stripeError: any) {
        const stripeLatency = Date.now() - stripeStart;
        metrics.push({
          type: "stripe_latency",
          value: stripeLatency,
          status: "unhealthy",
          metadata: { error: stripeError.message?.substring(0, 100) },
        });
        alerts.push({
          shouldAlert: true,
          alertType: "stripe_down",
          severity: "high",
          message: `Stripe API error: ${stripeError.message?.substring(0, 100)}`,
          source: "monitor-health",
        });
      }
    } else {
      metrics.push({
        type: "stripe_latency",
        value: null,
        status: "healthy",
        metadata: { note: "Stripe not configured" },
      });
    }

    // 4. Check active tenant count (for capacity monitoring)
    try {
      const { count, error } = await supabase
        .from("tenants")
        .select("*", { count: "exact", head: true });
      
      metrics.push({
        type: "active_tenants",
        value: count ?? 0,
        status: "healthy",
      });
    } catch {
      // Non-critical metric
    }

    // 5. Check recent error rate from edge function logs (last hour)
    // This is a placeholder - would need analytics query in production
    metrics.push({
      type: "error_rate",
      value: 0,
      status: "healthy",
      metadata: { period: "1h" },
    });

    // Store metrics in database
    const metricsToInsert = metrics.map(m => ({
      metric_type: m.type,
      metric_value: m.value,
      status: m.status,
      metadata: m.metadata || {},
      recorded_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from("system_health_metrics")
      .insert(metricsToInsert);

    if (insertError) {
      console.error("[MONITOR-HEALTH] Failed to insert metrics:", insertError);
    }

    // Process alerts - check if similar alert exists in last hour before creating new one
    for (const alert of alerts) {
      if (!alert.shouldAlert) continue;

      // Check for recent similar alert
      const { data: existingAlerts } = await supabase
        .from("system_alerts")
        .select("id")
        .eq("alert_type", alert.alertType)
        .is("resolved_at", null)
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existingAlerts || existingAlerts.length === 0) {
        // Create new alert
        const { error: alertError } = await supabase
          .from("system_alerts")
          .insert({
            alert_type: alert.alertType,
            severity: alert.severity,
            message: alert.message,
            source: alert.source,
            metadata: {},
          });

        if (alertError) {
          console.error("[MONITOR-HEALTH] Failed to create alert:", alertError);
        } else {
          console.log(`[MONITOR-HEALTH] Created alert: ${alert.alertType} (${alert.severity})`);
          
          // Send notification email for critical/high alerts
          if (alert.severity === "critical" || alert.severity === "high") {
            try {
              const alertUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-health-alert`;
              await fetch(alertUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  alertType: alert.alertType,
                  severity: alert.severity,
                  message: alert.message,
                  source: alert.source,
                }),
              });
            } catch (emailErr) {
              console.error("[MONITOR-HEALTH] Failed to send alert email:", emailErr);
            }
          }
        }
      }
    }

    // Auto-resolve stale alerts (if services are healthy now)
    const healthyServices = metrics.filter(m => m.status === "healthy").map(m => {
      if (m.type === "database_latency") return ["database_down", "database_latency"];
      if (m.type === "stripe_latency") return ["stripe_down", "stripe_latency"];
      return [];
    }).flat();

    if (healthyServices.length > 0) {
      const { error: resolveError } = await supabase
        .from("system_alerts")
        .update({ resolved_at: new Date().toISOString() })
        .in("alert_type", healthyServices)
        .is("resolved_at", null);

      if (resolveError) {
        console.error("[MONITOR-HEALTH] Failed to resolve alerts:", resolveError);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[MONITOR-HEALTH] Completed in ${totalTime}ms - ${metrics.length} metrics, ${alerts.filter(a => a.shouldAlert).length} alerts`);

    // Determine overall status
    const hasUnhealthy = metrics.some(m => m.status === "unhealthy");
    const hasDegraded = metrics.some(m => m.status === "degraded");
    const overallStatus = hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";

    return new Response(JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration_ms: totalTime,
      metrics,
      alerts_created: alerts.filter(a => a.shouldAlert).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: overallStatus === "unhealthy" ? 503 : 200,
    });
  } catch (error: any) {
    console.error("[MONITOR-HEALTH] Fatal error:", error);
    
    return new Response(JSON.stringify({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
