import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    database: ServiceStatus;
    stripe: ServiceStatus;
    auth: ServiceStatus;
  };
  latency: {
    database_ms: number | null;
    stripe_ms: number | null;
  };
}

interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy" | "unconfigured";
  message: string;
  latency_ms?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  const healthStatus: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "unhealthy", message: "Not checked" },
      stripe: { status: "unconfigured", message: "Not configured" },
      auth: { status: "unhealthy", message: "Not checked" },
    },
    latency: {
      database_ms: null,
      stripe_ms: null,
    },
  };

  try {
    // Check database connectivity
    const dbStart = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      healthStatus.services.database = {
        status: "unhealthy",
        message: "Missing Supabase configuration",
      };
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Simple query to test database connectivity
      const { data, error } = await supabase
        .from("tenants")
        .select("id")
        .limit(1);

      const dbLatency = Date.now() - dbStart;
      healthStatus.latency.database_ms = dbLatency;

      if (error) {
        healthStatus.services.database = {
          status: "unhealthy",
          message: `Database query failed: ${error.message}`,
          latency_ms: dbLatency,
        };
      } else {
        healthStatus.services.database = {
          status: dbLatency > 2000 ? "degraded" : "healthy",
          message: dbLatency > 2000 ? "High latency detected" : "Connected",
          latency_ms: dbLatency,
        };
      }

      // Check auth service
      const authStart = Date.now();
      try {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        const authLatency = Date.now() - authStart;
        
        if (authError) {
          healthStatus.services.auth = {
            status: "degraded",
            message: `Auth check returned error: ${authError.message}`,
            latency_ms: authLatency,
          };
        } else {
          healthStatus.services.auth = {
            status: authLatency > 2000 ? "degraded" : "healthy",
            message: authLatency > 2000 ? "High latency detected" : "Operational",
            latency_ms: authLatency,
          };
        }
      } catch (authErr) {
        healthStatus.services.auth = {
          status: "unhealthy",
          message: `Auth service unreachable`,
        };
      }
    }

    // Check Stripe connectivity
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      healthStatus.services.stripe = {
        status: "unconfigured",
        message: "Stripe API key not configured",
      };
    } else {
      const stripeStart = Date.now();
      try {
        const stripe = new Stripe(stripeKey, {
          apiVersion: "2023-10-16",
          httpClient: Stripe.createFetchHttpClient(),
        });

        // Simple API call to test Stripe connectivity
        await stripe.balance.retrieve();
        const stripeLatency = Date.now() - stripeStart;
        healthStatus.latency.stripe_ms = stripeLatency;

        healthStatus.services.stripe = {
          status: stripeLatency > 3000 ? "degraded" : "healthy",
          message: stripeLatency > 3000 ? "High latency detected" : "Connected",
          latency_ms: stripeLatency,
        };
      } catch (stripeError: any) {
        const stripeLatency = Date.now() - stripeStart;
        healthStatus.latency.stripe_ms = stripeLatency;
        
        healthStatus.services.stripe = {
          status: "unhealthy",
          message: `Stripe API error: ${stripeError.message?.substring(0, 100) || "Unknown error"}`,
          latency_ms: stripeLatency,
        };
      }
    }

    // Determine overall status
    const statuses = Object.values(healthStatus.services).map((s) => s.status);
    if (statuses.includes("unhealthy")) {
      healthStatus.status = "unhealthy";
    } else if (statuses.includes("degraded")) {
      healthStatus.status = "degraded";
    } else {
      healthStatus.status = "healthy";
    }

    console.log(`[HEALTH-CHECK] Status: ${healthStatus.status} (${Date.now() - startTime}ms)`);

    return new Response(JSON.stringify(healthStatus), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: healthStatus.status === "unhealthy" ? 503 : 200,
    });
  } catch (error: any) {
    console.error("[HEALTH-CHECK] Unexpected error:", error);
    
    healthStatus.status = "unhealthy";
    healthStatus.services.database = {
      status: "unhealthy",
      message: `Unexpected error: ${error.message}`,
    };

    return new Response(JSON.stringify(healthStatus), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 503,
    });
  }
});
