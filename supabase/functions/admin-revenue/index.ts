import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-REVENUE] ${step}${detailsStr}`);
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Tier mapping
    const PRODUCT_TO_TIER: Record<string, string> = {
      "prod_TnJRvBGtJmXOKk": "starter",
      "prod_TnJRx1P7LOKR8k": "growth",
      "prod_TnJS2o21anjuku": "professional",
    };

    const TIER_PRICES: Record<string, number> = {
      "starter": 99,
      "growth": 229,
      "professional": 449,
    };

    // Get all active subscriptions
    logStep("Fetching active subscriptions");
    const subscriptions = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.customer"],
    });

    let mrr = 0;
    const tierBreakdown: Record<string, { count: number; revenue: number }> = {
      starter: { count: 0, revenue: 0 },
      growth: { count: 0, revenue: 0 },
      professional: { count: 0, revenue: 0 },
    };

    for (const sub of subscriptions.data) {
      const productId = sub.items.data[0]?.price?.product as string;
      const tier = PRODUCT_TO_TIER[productId] || "unknown";
      const monthlyAmount = (sub.items.data[0]?.price?.unit_amount || 0) / 100;

      mrr += monthlyAmount;

      if (tierBreakdown[tier]) {
        tierBreakdown[tier].count += 1;
        tierBreakdown[tier].revenue += monthlyAmount;
      }
    }

    const arr = mrr * 12;
    logStep("Revenue calculated", { mrr, arr, totalSubs: subscriptions.data.length });

    // Get payment history (last 50 payments)
    logStep("Fetching payment history");
    const charges = await stripe.charges.list({
      limit: 50,
    });

    const paymentHistory = charges.data.map((charge: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      created: number;
      billing_details?: { email?: string | null };
      receipt_email?: string | null;
      description?: string | null;
    }) => ({
      id: charge.id,
      amount: charge.amount / 100,
      currency: charge.currency.toUpperCase(),
      status: charge.status,
      created: new Date(charge.created * 1000).toISOString(),
      customerEmail: charge.billing_details?.email || charge.receipt_email || "Unknown",
      description: charge.description || "Subscription payment",
    }));
    logStep("Payment history fetched", { count: paymentHistory.length });

    // Get monthly revenue trend (last 6 months)
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);
    const allCharges = await stripe.charges.list({
      created: { gte: sixMonthsAgo },
      limit: 100,
    });

    const monthlyRevenue: Record<string, number> = {};
    for (const charge of allCharges.data) {
      if (charge.status === "succeeded") {
        const date = new Date(charge.created * 1000);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + charge.amount / 100;
      }
    }

    const revenueTrend = Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    logStep("Revenue trend calculated", { months: revenueTrend.length });

    return new Response(
      JSON.stringify({
        mrr,
        arr,
        activeSubscriptions: subscriptions.data.length,
        tierBreakdown,
        paymentHistory,
        revenueTrend,
      }),
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
