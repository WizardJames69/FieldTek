import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapping of subscription tiers to Stripe price IDs
const TIER_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: {
    monthly: "price_1SpiodJZanOkZUMQ1U3Wc8nJ",
    yearly: "price_1Spiv5JZanOkZUMQRjHs1PXx",
  },
  growth: {
    monthly: "price_1SpiorJZanOkZUMQdG0vsg7D",
    yearly: "price_1SpivVJZanOkZUMQRITnNHCo",
  },
  professional: {
    monthly: "price_1SpipAJZanOkZUMQ4hvNutoN",
    yearly: "price_1SpivhJZanOkZUMQpGSV3o5z",
  },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Get request body
    let body;
    try {
      body = await req.json();
    } catch {
      logStep("ERROR", { message: "Invalid JSON in request body" });
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    const { tier, skip_trial, billing_period = "monthly" } = body;
    
    // Validate tier
    if (!tier) {
      logStep("ERROR", { message: "Missing tier parameter" });
      return new Response(
        JSON.stringify({ error: "Please select a subscription tier" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    if (!TIER_PRICES[tier]) {
      logStep("ERROR", { message: `Invalid tier: ${tier}` });
      return new Response(
        JSON.stringify({ error: `Invalid tier: ${tier}. Must be one of: ${Object.keys(TIER_PRICES).join(", ")}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Validate billing period
    if (billing_period !== "monthly" && billing_period !== "yearly") {
      logStep("ERROR", { message: `Invalid billing_period: ${billing_period}` });
      return new Response(
        JSON.stringify({ error: "Invalid billing period. Must be 'monthly' or 'yearly'" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    const priceId = TIER_PRICES[tier][billing_period as "monthly" | "yearly"];
    logStep("Tier selected", { tier, billing_period, skip_trial: !!skip_trial, priceId });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is a beta founder for coupon application
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    let isBetaFounder = false;
    try {
      const { data: tenantMember } = await supabaseAdmin
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      
      if (tenantMember?.tenant_id) {
        const { data: tenantData } = await supabaseAdmin
          .from('tenants')
          .select('is_beta_founder')
          .eq('id', tenantMember.tenant_id)
          .single();
        
        isBetaFounder = tenantData?.is_beta_founder === true;
      }
      logStep("Beta founder check", { isBetaFounder });
    } catch (err) {
      logStep("Beta founder check failed, proceeding without coupon", { error: String(err) });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      logStep("No existing Stripe customer found");
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    
    // Apply founding member coupon for beta founders
    const discounts = isBetaFounder ? [{ coupon: 'WQMyNyRo' }] : [];
    logStep("Discount config", { isBetaFounder, discounts });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      payment_method_collection: "always",
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      ...(discounts.length > 0 ? { discounts } : {}),
      subscription_data: {
        ...(skip_trial ? {} : { trial_period_days: 30 }),
        metadata: {
          user_id: user.id,
          tier: tier,
          billing_period: billing_period,
        },
      },
      metadata: {
        user_id: user.id,
        tier: tier,
        billing_period: billing_period,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
