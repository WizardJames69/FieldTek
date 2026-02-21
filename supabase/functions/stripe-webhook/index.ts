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

    // C4: Idempotency check — skip already-processed events
    const { data: existingEvent } = await supabaseClient
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      logStep("Event already processed, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        logStep("Customer was deleted, skipping (non-retriable)");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customerEmail = customer.email;
      if (!customerEmail) {
        logStep("No customer email found, skipping (non-retriable)");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Found customer email", { email: customerEmail });

      // C3: Try multiple lookup strategies to find the tenant
      let userId: string | null = null;
      let tenantId: string | null = null;

      // Strategy 1: Look up by email in profiles
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("user_id")
        .eq("email", customerEmail)
        .limit(1)
        .maybeSingle();

      if (profileData) {
        userId = profileData.user_id;
        logStep("Found user by email", { userId });
      }

      // Strategy 2: Fall back to subscription metadata user_id
      if (!userId && subscription.metadata?.user_id) {
        userId = subscription.metadata.user_id;
        logStep("Found user via subscription metadata fallback", { userId });
      }

      // Strategy 3: Look up tenant by stripe_customer_id (H1)
      if (!userId) {
        const { data: tenantByCustomer } = await supabaseClient
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (tenantByCustomer) {
          tenantId = tenantByCustomer.id;
          logStep("Found tenant by stripe_customer_id", { tenantId });
        }
      }

      // Look up tenant from user if we found a user but not a tenant yet
      if (userId && !tenantId) {
        const { data: tenantUser } = await supabaseClient
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (tenantUser) {
          tenantId = tenantUser.tenant_id;
          logStep("Found tenant for user", { tenantId });
        }
      }

      // C3: If still no tenant found, log to dead-letter and return 500 for retry
      if (!tenantId) {
        logStep("No tenant found after all lookup strategies", { customerEmail, customerId });

        await supabaseClient.from("webhook_dead_letters").insert({
          event_id: event.id,
          event_type: event.type,
          error_reason: "tenant_not_found",
          payload: { customerId, customerEmail, subscriptionId: subscription.id, metadata: subscription.metadata },
        });

        return new Response(
          JSON.stringify({ error: "Tenant not found, will retry" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // H1: Persist stripe_customer_id on the tenant for future reliable lookups
      await supabaseClient
        .from("tenants")
        .update({ stripe_customer_id: customerId })
        .eq("id", tenantId)
        .is("stripe_customer_id", null); // Only set if not already set

      // Fetch current tier/status for audit log (M1)
      const { data: currentTenant } = await supabaseClient
        .from("tenants")
        .select("subscription_tier, subscription_status")
        .eq("id", tenantId)
        .single();

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

      // Handle cancel_at_period_end (user canceled via portal but still in grace period)
      const cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
      const cancelAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null;

      if (cancelAtPeriodEnd) {
        logStep("Subscription set to cancel at period end", { cancelAtPeriodEnd, cancelAt });
      }

      logStep("Updating tenant subscription", {
        tenantId,
        subscriptionTier,
        subscriptionStatus,
        cancelAtPeriodEnd,
        stripeStatus: subscription.status
      });

      // Update the tenant's subscription
      const { error: updateError } = await supabaseClient
        .from("tenants")
        .update({
          subscription_tier: subscriptionTier,
          subscription_status: subscriptionStatus,
          cancel_at_period_end: cancelAtPeriodEnd,
          cancel_at: cancelAt,
        })
        .eq("id", tenantId);

      if (updateError) {
        throw new Error(`Failed to update tenant: ${updateError.message}`);
      }

      // M1: Write audit log entry
      if (currentTenant) {
        await supabaseClient.from("subscription_audit_log").insert({
          tenant_id: tenantId,
          previous_tier: currentTenant.subscription_tier,
          new_tier: subscriptionTier,
          previous_status: currentTenant.subscription_status,
          new_status: subscriptionStatus,
          stripe_event_id: event.id,
          stripe_subscription_id: subscription.id,
          change_source: "webhook",
        });
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
          // H4: Check if invoice is already paid to prevent duplicate notifications
          const { data: existingInvoice } = await supabaseClient
            .from("invoices")
            .select("status")
            .eq("id", invoiceId)
            .single();

          if (existingInvoice?.status === "paid") {
            logStep("Invoice already paid, skipping notifications", { invoiceId });
          } else {
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
    }

    // H4: Removed duplicate payment_intent.succeeded handler for invoice payments.
    // checkout.session.completed already handles invoice payment recording and notifications.

    // C4: Record this event as processed (idempotency)
    await supabaseClient.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
    });

    // Periodically cleanup old webhook events (1% chance per request)
    if (Math.random() < 0.01) {
      await supabaseClient.rpc("cleanup_old_webhook_events");
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
