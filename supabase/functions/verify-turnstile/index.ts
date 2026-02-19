import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface RateLimitRecord {
  id: string;
  request_count: number;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5;

async function checkRateLimit(
  supabase: any,
  identifier: string,
  identifierType: 'ip' | 'email'
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  // Get current request count in the window
  const { data: existing, error: fetchError } = await supabase
    .from('rate_limits')
    .select('id, request_count')
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType)
    .gte('window_start', windowStart)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is fine
    console.error('Rate limit check error:', fetchError);
    // On error, allow the request but log it
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW };
  }

  const record = existing as RateLimitRecord | null;

  if (record) {
    // Record exists in current window
    if (record.request_count >= MAX_REQUESTS_PER_WINDOW) {
      return { allowed: false, remaining: 0 };
    }

    // Increment the counter
    await supabase
      .from('rate_limits')
      .update({ request_count: record.request_count + 1 })
      .eq('id', record.id);

    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.request_count - 1 };
  } else {
    // No record exists, create one
    await supabase.from('rate_limits').insert({
      identifier,
      identifier_type: identifierType,
      request_count: 1,
      window_start: new Date().toISOString(),
    });

    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }
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
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";

    // Check rate limit by IP
    const ipRateLimit = await checkRateLimit(supabase, clientIP, 'ip');
    if (!ipRateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          retryAfter: RATE_LIMIT_WINDOW_MINUTES * 60
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60)
          } 
        }
      );
    }

    // Also check rate limit by email if provided
    if (formData.contact_email) {
      const emailRateLimit = await checkRateLimit(supabase, formData.contact_email.toLowerCase(), 'email');
      if (!emailRateLimit.allowed) {
        console.warn(`Rate limit exceeded for email: ${formData.contact_email}`);
        return new Response(
          JSON.stringify({ 
            error: "Too many requests from this email. Please try again later.",
            retryAfter: RATE_LIMIT_WINDOW_MINUTES * 60
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60)
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
    if (Math.random() < 0.01) {
      try {
        await supabase.rpc('cleanup_old_rate_limits');
        console.log('Cleaned up old rate limit records');
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }

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
