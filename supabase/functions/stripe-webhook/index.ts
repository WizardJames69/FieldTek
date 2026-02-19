import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapping of Stripe product IDs to subscription tiers (must match check-subscription)
// Includes both monthly and yearly product IDs
const PRODUCT_TO_TIER: Record<string, "starter" | "growth" | "professional"> = {
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
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    
    logStep("Secrets verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${errorMessage}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle subscription events (platform account)
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      logStep("Processing subscription event", { 
        eventType: event.type, 
        subscriptionId: subscription.id,
        customerId,
        status: subscription.status 
      });

      // Get customer email from Stripe
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        logStep("Customer was deleted, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerEmail = customer.email;
      if (!customerEmail) {
        logStep("No customer email found, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Found customer email", { email: customerEmail });

      // Find the user by email - query profiles table instead of listing all users
      const { data: profileData, error: profileError } = await supabaseClient
        .from("profiles")
        .select("user_id")
        .eq("email", customerEmail)
        .limit(1)
        .single();

      if (profileError || !profileData) {
        logStep("No user found with email", { email: customerEmail });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const user = { id: profileData.user_id };

      logStep("Found user", { userId: user.id });

      // Find the tenant for this user
      const { data: tenantUser, error: tenantUserError } = await supabaseClient
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (tenantUserError || !tenantUser) {
        logStep("No tenant found for user", { userId: user.id, error: tenantUserError?.message });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tenantId = tenantUser.tenant_id;
      logStep("Found tenant", { tenantId });

      // Determine the new subscription tier and status
      let subscriptionTier: "trial" | "starter" | "growth" | "professional" = "trial";
      let subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" = "canceled";

      if (subscription.status === "active" || subscription.status === "trialing") {
        const productId = subscription.items.data[0]?.price?.product as string;
        subscriptionTier = PRODUCT_TO_TIER[productId] || "starter";
        subscriptionStatus = subscription.status === "trialing" ? "trialing" : "active";
      } else if (subscription.status === "past_due") {
        const productId = subscription.items.data[0]?.price?.product as string;
        subscriptionTier = PRODUCT_TO_TIER[productId] || "starter";
        subscriptionStatus = "past_due";
      } else {
        // Subscription is canceled, incomplete, etc.
        subscriptionStatus = "canceled";
        subscriptionTier = "trial";
      }

      logStep("Updating tenant subscription", { 
        tenantId, 
        subscriptionTier, 
        subscriptionStatus,
        stripeStatus: subscription.status 
      });

      // Update the tenant's subscription
      const { error: updateError } = await supabaseClient
        .from("tenants")
        .update({
          subscription_tier: subscriptionTier,
          subscription_status: subscriptionStatus,
        })
        .eq("id", tenantId);

      if (updateError) {
        throw new Error(`Failed to update tenant: ${updateError.message}`);
      }

      logStep("Tenant subscription updated successfully", { tenantId, subscriptionTier, subscriptionStatus });
    }

    // Handle Connect account events (for tenant Stripe accounts)
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      logStep("Processing account.updated event", { accountId: account.id });

      // Find tenant with this Connect account
      const { data: tenant, error: tenantError } = await supabaseClient
        .from("tenants")
        .select("id, stripe_connect_status")
        .eq("stripe_connect_account_id", account.id)
        .single();

      if (tenantError || !tenant) {
        logStep("No tenant found for Connect account", { accountId: account.id });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine new status
      let newStatus = tenant.stripe_connect_status;
      if (account.details_submitted && account.charges_enabled) {
        newStatus = "connected";
      } else if (account.requirements?.disabled_reason) {
        newStatus = "restricted";
      } else if (!account.details_submitted) {
        newStatus = "pending";
      }

      if (newStatus !== tenant.stripe_connect_status) {
        const updateData: Record<string, unknown> = { stripe_connect_status: newStatus };
        if (newStatus === "connected") {
          updateData.stripe_connect_onboarded_at = new Date().toISOString();
        }

        await supabaseClient
          .from("tenants")
          .update(updateData)
          .eq("id", tenant.id);

        logStep("Updated tenant Connect status", { tenantId: tenant.id, newStatus });
      }
    }

    // Handle checkout session completed for invoice payments (Connect accounts)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.completed", { sessionId: session.id, metadata: session.metadata });

      // Check if this is an invoice payment
      if (session.metadata?.payment_type === "invoice") {
        const invoiceId = session.metadata.invoice_id;
        
        if (invoiceId) {
          logStep("Marking invoice as paid", { invoiceId });

          const { error: updateError } = await supabaseClient
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", invoiceId);

          if (updateError) {
            logStep("Failed to update invoice", { error: updateError.message });
          } else {
            logStep("Invoice marked as paid successfully", { invoiceId });
            
            // Get invoice details for notifications
            const { data: invoiceData } = await supabaseClient
              .from("invoices")
              .select("invoice_number, total, tenant_id, clients(name)")
              .eq("id", invoiceId)
              .single();
            
            // Send payment receipt email
            try {
              const receiptResponse = await fetch(
                `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-payment-receipt`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({ invoiceId }),
                }
              );
              
              if (receiptResponse.ok) {
                logStep("Payment receipt email sent", { invoiceId });
              } else {
                const errorText = await receiptResponse.text();
                logStep("Failed to send payment receipt email", { error: errorText });
              }
            } catch (emailError) {
              logStep("Error sending payment receipt email", { 
                error: emailError instanceof Error ? emailError.message : String(emailError) 
              });
            }

            // Send push notification to office staff
            if (invoiceData?.tenant_id) {
              try {
                // Get office staff user IDs
                const { data: staffUsers } = await supabaseClient
                  .from("tenant_users")
                  .select("user_id")
                  .eq("tenant_id", invoiceData.tenant_id)
                  .eq("is_active", true)
                  .in("role", ["owner", "admin", "dispatcher"]);

                if (staffUsers && staffUsers.length > 0) {
                  const userIds = staffUsers.map((u: any) => u.user_id);
                  const clientName = (invoiceData.clients as any)?.name || "Customer";
                  
                  await fetch(
                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({
                        userIds,
                        tenantId: invoiceData.tenant_id,
                        payload: {
                          title: "💰 Invoice Paid",
                          body: `${invoiceData.invoice_number} from ${clientName} - $${(invoiceData.total || 0).toFixed(2)}`,
                          type: "general",
                          tag: `invoice_paid_${invoiceId}`,
                          data: {
                            invoiceId,
                            url: `/invoices?invoice=${invoiceId}`,
                          },
                          actions: [{ action: "view", title: "View Invoice" }],
                        },
                      }),
                    }
                  );
                  logStep("Push notification sent to office staff", { invoiceId });
                }
              } catch (pushErr) {
                logStep("Failed to send push notification", { 
                  error: pushErr instanceof Error ? pushErr.message : String(pushErr) 
                });
              }
            }
          }
        }
      }
    }

    // Handle payment_intent.succeeded for invoice payments
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      logStep("Processing payment_intent.succeeded", { paymentIntentId: paymentIntent.id, metadata: paymentIntent.metadata });

      // Check if this is an invoice payment
      if (paymentIntent.metadata?.payment_type === "invoice") {
        const invoiceId = paymentIntent.metadata.invoice_id;
        
        if (invoiceId) {
          logStep("Marking invoice as paid via payment intent", { invoiceId });

          const { error: updateError } = await supabaseClient
            .from("invoices")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", invoiceId);

          if (updateError) {
            logStep("Failed to update invoice", { error: updateError.message });
          } else {
            logStep("Invoice marked as paid successfully", { invoiceId });
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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
