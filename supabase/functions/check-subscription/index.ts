import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapping of Stripe product IDs to subscription tiers
// Includes both monthly and yearly product IDs
const PRODUCT_TO_TIER: Record<string, string> = {
  // Monthly products
  "prod_TnJRvBGtJmXOKk": "starter",
  "prod_TnJRx1P7LOKR8k": "growth",
  "prod_TnJS2o21anjuku": "professional",
  // Yearly products
  "prod_TnJYHeFoo7ZMKr": "starter",
  "prod_TnJYlRK2IgK6yl": "growth",
  "prod_TnJYbiX5D0hesT": "professional",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning trial status");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: "trial",
        subscription_end: null,
        stripe_customer_id: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Fetch subscriptions without status filter to get both active and trialing
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
    });
    
    // Find an active or trialing subscription
    const subscription = subscriptions.data.find((s: { status: string }) => 
      s.status === "active" || s.status === "trialing"
    );
    
    const hasValidSub = !!subscription;
    let tier = "trial";
    let subscriptionEnd = null;
    let isTrialing = false;
    let trialEnd = null;

    if (hasValidSub && subscription) {
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Valid subscription found", { 
        subscriptionId: subscription.id, 
        status: subscription.status,
        endDate: subscriptionEnd 
      });
      
      // Check if in Stripe trial period
      if (subscription.status === "trialing" && subscription.trial_end) {
        isTrialing = true;
        trialEnd = new Date(subscription.trial_end * 1000).toISOString();
        logStep("User is in trial period", { trialEnd });
      }
      
      // Get product ID to determine tier
      const priceId = subscription.items.data[0].price.id;
      const productId = subscription.items.data[0].price.product as string;
      tier = PRODUCT_TO_TIER[productId] || "starter";
      logStep("Determined subscription tier", { priceId, productId, tier });
    } else {
      logStep("No active or trialing subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasValidSub,
      tier,
      subscription_end: subscriptionEnd,
      stripe_customer_id: customerId,
      is_trialing: isTrialing,
      trial_end: trialEnd,
    }), {
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
