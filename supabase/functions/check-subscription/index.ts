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
    const activeSubscription = subscriptions.data.find((s: { status: string }) =>
      s.status === "active" || s.status === "trialing"
    );

    // Also look for past_due subscriptions (should preserve tier, not reset to trial)
    const pastDueSubscription = !activeSubscription
      ? subscriptions.data.find((s: { status: string }) => s.status === "past_due")
      : null;

    const subscription = activeSubscription || pastDueSubscription;
    const hasValidSub = !!activeSubscription;
    const isPastDue = !!pastDueSubscription && !activeSubscription;
    let tier = "trial";
    let subscriptionEnd = null;
    let isTrialing = false;
    let trialEnd = null;
    let subscriptionStatus = "trial";
    let cancelAtPeriodEnd = false;
    let cancelAt: string | null = null;

    if (subscription) {
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Subscription found", {
        subscriptionId: subscription.id,
        status: subscription.status,
        endDate: subscriptionEnd
      });

      // Get product ID to determine tier
      const priceId = subscription.items.data[0].price.id;
      const productId = subscription.items.data[0].price.product as string;
      tier = PRODUCT_TO_TIER[productId] || "starter";
      logStep("Determined subscription tier", { priceId, productId, tier });

      if (isPastDue) {
        subscriptionStatus = "past_due";
        logStep("Subscription is past_due, preserving tier", { tier });
      } else if (subscription.status === "trialing" && subscription.trial_end) {
        isTrialing = true;
        trialEnd = new Date(subscription.trial_end * 1000).toISOString();
        subscriptionStatus = "trialing";
        logStep("User is in trial period", { trialEnd });
      } else {
        subscriptionStatus = "active";
      }

      // Read cancel_at_period_end from Stripe
      cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
      cancelAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null;

      if (cancelAtPeriodEnd) {
        logStep("Subscription set to cancel at period end", { cancelAt });
      }
    } else {
      logStep("No active, trialing, or past_due subscription found");
    }

    // H2: Reconciliation — if DB tier/status differs from Stripe, update DB
    try {
      const { data: tenantUser } = await supabaseClient
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (tenantUser?.tenant_id) {
        const expectedTier = subscription ? tier : "trial";
        const expectedStatus = isPastDue
          ? "past_due"
          : hasValidSub
            ? (isTrialing ? "trialing" : "active")
            : "trial";

        const { data: currentTenant } = await supabaseClient
          .from("tenants")
          .select("subscription_tier, subscription_status, stripe_customer_id, cancel_at_period_end")
          .eq("id", tenantUser.tenant_id)
          .single();

        if (currentTenant) {
          const updates: Record<string, unknown> = {};

          if (currentTenant.subscription_tier !== expectedTier) {
            updates.subscription_tier = expectedTier;
          }
          if (currentTenant.subscription_status !== expectedStatus) {
            updates.subscription_status = expectedStatus;
          }
          // Reconcile cancel_at_period_end
          if (currentTenant.cancel_at_period_end !== cancelAtPeriodEnd) {
            updates.cancel_at_period_end = cancelAtPeriodEnd;
            updates.cancel_at = cancelAt;
          }
          // H1: Also persist stripe_customer_id if missing
          if (!currentTenant.stripe_customer_id) {
            updates.stripe_customer_id = customerId;
          }

          if (Object.keys(updates).length > 0) {
            logStep("Reconciliation: updating DB to match Stripe", {
              tenantId: tenantUser.tenant_id,
              from: { tier: currentTenant.subscription_tier, status: currentTenant.subscription_status },
              to: updates,
            });

            await supabaseClient
              .from("tenants")
              .update(updates)
              .eq("id", tenantUser.tenant_id);

            // M1: Log the reconciliation in audit table
            await supabaseClient.from("subscription_audit_log").insert({
              tenant_id: tenantUser.tenant_id,
              previous_tier: currentTenant.subscription_tier,
              new_tier: (updates.subscription_tier as string) || currentTenant.subscription_tier,
              previous_status: currentTenant.subscription_status,
              new_status: (updates.subscription_status as string) || currentTenant.subscription_status,
              change_source: "reconciliation",
            });
          }
        }
      }
    } catch (reconcileErr) {
      logStep("Reconciliation failed (non-fatal)", {
        error: reconcileErr instanceof Error ? reconcileErr.message : String(reconcileErr),
      });
    }

    return new Response(JSON.stringify({
      subscribed: hasValidSub,
      tier,
      subscription_end: subscriptionEnd,
      stripe_customer_id: customerId,
      is_trialing: isTrialing,
      trial_end: trialEnd,
      is_past_due: isPastDue,
      subscription_status: subscriptionStatus,
      cancel_at_period_end: cancelAtPeriodEnd,
      cancel_at: cancelAt,
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
