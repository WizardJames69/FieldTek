import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-ONBOARD] ${step}${detailsStr}`);
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
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's tenant (must be owner or admin)
    const { data: tenantUser, error: tenantUserError } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("role", ["owner", "admin"])
      .single();

    if (tenantUserError || !tenantUser) {
      throw new Error("You must be a tenant owner or admin to connect a Stripe account");
    }

    const tenantId = tenantUser.tenant_id;
    logStep("Found tenant", { tenantId, role: tenantUser.role });

    // Get tenant details
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id, name, email, stripe_connect_account_id, stripe_connect_status")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://fieldtek.ai";

    let accountId = tenant.stripe_connect_account_id;

    // Check if we already have a Connect account
    if (accountId) {
      logStep("Existing Connect account found", { accountId });
      
      // Check if onboarding is complete
      const account = await stripe.accounts.retrieve(accountId);
      
      if (account.details_submitted && account.charges_enabled) {
        logStep("Account already fully onboarded");
        return new Response(JSON.stringify({ 
          success: true, 
          status: "connected",
          message: "Your Stripe account is already connected" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Generate a new onboarding link for incomplete accounts
      logStep("Account needs to complete onboarding");
    } else {
      // Create a new Connect account (Standard type)
      logStep("Creating new Connect account");
      
      const account = await stripe.accounts.create({
        type: "standard",
        email: tenant.email || user.email,
        metadata: {
          tenant_id: tenantId,
          tenant_name: tenant.name,
        },
      });

      accountId = account.id;
      logStep("Connect account created", { accountId });

      // Store the account ID
      const { error: updateError } = await supabaseClient
        .from("tenants")
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: "pending",
        })
        .eq("id", tenantId);

      if (updateError) {
        throw new Error(`Failed to save Connect account: ${updateError.message}`);
      }
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/settings?tab=billing&stripe_connect=refresh`,
      return_url: `${origin}/settings?tab=billing&stripe_connect=complete`,
      type: "account_onboarding",
    });

    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      success: true, 
      url: accountLink.url,
      accountId,
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
