import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, maybeCleanupRateLimits } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, formData, tenantId } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing CAPTCHA token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenantId || !formData) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role for rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIP = getClientIp(req);

    // Check rate limit by IP
    const ipRateLimit = await checkRateLimit(supabase, {
      identifierType: "ip",
      identifier: clientIP,
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
    });
    if (!ipRateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
          retryAfter: 900
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "900"
          }
        }
      );
    }

    // Also check rate limit by email if provided
    if (formData.contact_email) {
      const emailRateLimit = await checkRateLimit(supabase, {
        identifierType: "email",
        identifier: formData.contact_email.toLowerCase(),
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
      });
      if (!emailRateLimit.allowed) {
        console.warn(`Rate limit exceeded for email: ${formData.contact_email}`);
        return new Response(
          JSON.stringify({
            error: "Too many requests from this email. Please try again later.",
            retryAfter: 900
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": "900"
            }
          }
        );
      }
    }

    // Verify the Turnstile token with Cloudflare
    const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!secretKey) {
      console.error("TURNSTILE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }),
      }
    );

    const verifyResult: TurnstileResponse = await verifyResponse.json();

    if (!verifyResult.success) {
      console.error("Turnstile verification failed:", verifyResult["error-codes"]);
      return new Response(
        JSON.stringify({ error: "CAPTCHA verification failed. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CAPTCHA verified - now insert the service request
    const { data, error } = await supabase.from("service_requests").insert({
      tenant_id: tenantId,
      title: formData.title,
      description: `${formData.description}\n\n---\nContact: ${formData.contact_name}\nEmail: ${formData.contact_email}\nPhone: ${formData.contact_phone || "Not provided"}`,
      request_type: formData.request_type,
      status: "new",
    }).select().single();

    if (error) {
      console.error("Database insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to submit request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send notification to admins (don't wait for it, fire and forget)
    try {
      fetch(`${supabaseUrl}/functions/v1/notify-service-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          requestId: data.id,
          tenantId: tenantId,
        }),
      }).catch(err => console.error("Notification error:", err));
    } catch (err) {
      console.error("Failed to trigger notification:", err);
    }

    // Periodically cleanup old rate limit records (1% chance per request)
    await maybeCleanupRateLimits(supabase);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
