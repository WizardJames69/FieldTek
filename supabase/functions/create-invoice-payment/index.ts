import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-INVOICE-PAYMENT] ${step}${detailsStr}`);
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

    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Rate limiting: max 10 payment attempts per IP per hour
    const identifierType = "invoice_payment_ip";
    const maxRequests = 10;
    const windowMinutes = 60;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    
    const { data: existingRate } = await supabaseClient
      .from("rate_limits")
      .select("id, request_count")
      .eq("identifier", clientIP)
      .eq("identifier_type", identifierType)
      .gte("window_start", windowStart)
      .maybeSingle();

    if (existingRate && (existingRate as { request_count: number }).request_count >= maxRequests) {
      logStep("Rate limited", { ip: clientIP });
      return new Response(JSON.stringify({ 
        error: "Too many payment requests. Please try again later." 
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment or create rate limit record
    if (existingRate) {
      const rate = existingRate as { id: string; request_count: number };
      await supabaseClient
        .from("rate_limits")
        .update({ request_count: rate.request_count + 1 })
        .eq("id", rate.id);
    } else {
      await supabaseClient
        .from("rate_limits")
        .insert({
          identifier: clientIP,
          identifier_type: identifierType,
          request_count: 1,
          window_start: new Date().toISOString(),
        });
    }

    // Parse request body
    const { invoiceId } = await req.json();
    if (!invoiceId) throw new Error("Invoice ID is required");
    
    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(invoiceId)) {
      throw new Error("Invalid invoice ID format");
    }
    
    logStep("Invoice ID received", { invoiceId });

    // Additional rate limiting: max 5 attempts per invoice per hour
    // This prevents enumeration attacks on specific invoices
    const invoiceRateType = "invoice_payment_invoice";
    const invoiceMaxRequests = 5;
    
    const { data: invoiceRate } = await supabaseClient
      .from("rate_limits")
      .select("id, request_count")
      .eq("identifier", invoiceId)
      .eq("identifier_type", invoiceRateType)
      .gte("window_start", windowStart)
      .maybeSingle();

    if (invoiceRate && (invoiceRate as { request_count: number }).request_count >= invoiceMaxRequests) {
      logStep("Invoice rate limited", { invoiceId });
      return new Response(JSON.stringify({ 
        error: "Too many payment attempts for this invoice. Please try again later." 
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment or create invoice rate limit record
    if (invoiceRate) {
      const rate = invoiceRate as { id: string; request_count: number };
      await supabaseClient
        .from("rate_limits")
        .update({ request_count: rate.request_count + 1 })
        .eq("id", rate.id);
    } else {
      await supabaseClient
        .from("rate_limits")
        .insert({
          identifier: invoiceId,
          identifier_type: invoiceRateType,
          request_count: 1,
          window_start: new Date().toISOString(),
        });
    }

    // Get the invoice with client and tenant details
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        id,
        invoice_number,
        total,
        status,
        client_id,
        tenant_id
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    logStep("Invoice found", { 
      invoiceNumber: invoice.invoice_number, 
      total: invoice.total,
      status: invoice.status,
      clientId: invoice.client_id,
    });

    // Verify invoice is payable
    if (invoice.status === "paid") {
      throw new Error("This invoice has already been paid");
    }
    if (invoice.status === "draft") {
      throw new Error("This invoice is still a draft and cannot be paid");
    }
    if (invoice.status === "cancelled") {
      throw new Error("This invoice has been cancelled");
    }
    if (!invoice.total || invoice.total <= 0) {
      throw new Error("Invoice has no amount to pay");
    }

    // Get client details for email
    const { data: client, error: clientError } = await supabaseClient
      .from("clients")
      .select("id, name, email")
      .eq("id", invoice.client_id)
      .single();

    if (clientError || !client) {
      throw new Error("Client not found");
    }
    logStep("Client found", { clientId: client.id, email: client.email });

    // Get tenant's Connect account
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id, name, stripe_connect_account_id, stripe_connect_status")
      .eq("id", invoice.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    if (!tenant.stripe_connect_account_id || tenant.stripe_connect_status !== "connected") {
      throw new Error("This business has not set up online payments yet. Please contact them for alternative payment methods.");
    }

    logStep("Tenant Connect account found", { 
      tenantId: tenant.id,
      connectAccountId: tenant.stripe_connect_account_id,
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://fieldtek.ai";

    // Calculate platform fee (2% of total)
    const platformFeePercent = 0.02;
    const totalInCents = Math.round(invoice.total * 100);
    const applicationFee = Math.round(totalInCents * platformFeePercent);

    // Create Checkout session on connected account
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: `Payment to ${tenant.name}`,
          },
          unit_amount: totalInCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      customer_email: client.email || undefined,
      payment_intent_data: {
        application_fee_amount: applicationFee,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number,
          client_id: client.id,
          tenant_id: tenant.id,
          payment_type: "invoice",
        },
      },
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        client_id: client.id,
        tenant_id: tenant.id,
        payment_type: "invoice",
      },
      success_url: `${origin}/portal/payment-success?invoice=${invoiceId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portal/invoices`,
    }, {
      stripeAccount: tenant.stripe_connect_account_id,
    });

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      applicationFee,
    });

    return new Response(JSON.stringify({ 
      success: true,
      url: session.url,
      sessionId: session.id,
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
