import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get user's tenant
    const { data: tenantUser, error: tenantUserError } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (tenantUserError || !tenantUser) {
      throw new Error("No tenant found for user");
    }

    const tenantId = tenantUser.tenant_id;

    // Get tenant's Connect account
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_connect_account_id, stripe_connect_status, stripe_connect_onboarded_at")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    if (!tenant.stripe_connect_account_id) {
      logStep("No Connect account found");
      return new Response(JSON.stringify({
        connected: false,
        status: "not_connected",
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(tenant.stripe_connect_account_id);
    logStep("Retrieved Stripe account", { 
      accountId: account.id, 
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
    });

    // Determine status
    let status: string = tenant.stripe_connect_status || "pending";
    
    if (account.details_submitted && account.charges_enabled) {
      status = "connected";
    } else if (account.requirements?.disabled_reason) {
      status = "restricted";
    } else if (!account.details_submitted) {
      status = "pending";
    }

    // Update status in database if changed
    if (status !== tenant.stripe_connect_status) {
      const updateData: Record<string, unknown> = { stripe_connect_status: status };
      
      if (status === "connected" && !tenant.stripe_connect_onboarded_at) {
        updateData.stripe_connect_onboarded_at = new Date().toISOString();
      }

      await supabaseClient
        .from("tenants")
        .update(updateData)
        .eq("id", tenantId);
      
      logStep("Updated Connect status", { status });
    }

    return new Response(JSON.stringify({
      connected: status === "connected",
      status,
      accountId: tenant.stripe_connect_account_id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements?.currently_due || [],
      onboardedAt: tenant.stripe_connect_onboarded_at,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
