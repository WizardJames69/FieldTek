import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push requires these environment variables
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@fieldtek.ai";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  type?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

interface NotificationRequest {
  userId?: string;
  userIds?: string[];
  tenantId: string;
  payload: PushPayload;
}

// Simple JWT encoder for VAPID
function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createVapidAuthHeader(endpoint: string): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
  
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: expiration,
    sub: VAPID_SUBJECT,
  };
  
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import the private key
  const privateKeyBytes = Uint8Array.from(atob(VAPID_PRIVATE_KEY!.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  return {
    authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    cryptoKey: `p256ecdsa=${VAPID_PUBLIC_KEY}`,
  };
}

async function sendPushToEndpoint(
  endpoint: string,
  _p256dhKey: string,
  _authKey: string,
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // For now, use a simplified push without encryption
    // In production, you'd want to use the full Web Push encryption protocol
    const vapidHeaders = await createVapidAuthHeader(endpoint);
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TTL": "86400",
        "Urgency": "high",
        ...vapidHeaders,
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error("Push failed:", response.status, text);
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
    
    await response.text(); // Consume response body
    return { success: true };
  } catch (err) {
    const error = err as Error;
    console.error("Push error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
      console.error("VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: NotificationRequest = await req.json();
    const { userId, userIds, tenantId, payload } = body;

    if (!tenantId || !payload) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!tenantUser || !["owner", "admin", "dispatcher"].includes(tenantUser.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target subscriptions
    let query = supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key, user_id")
      .eq("tenant_id", tenantId);

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (userIds && userIds.length > 0) {
      query = query.in("user_id", userIds);
    }

    const { data: subscriptions, error: subError } = await query;

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send push to all subscriptions
    const results = await Promise.all(
      subscriptions.map((sub) =>
        sendPushToEndpoint(sub.endpoint, sub.p256dh_key, sub.auth_key, payload)
      )
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    // Clean up failed endpoints (expired or invalid)
    const expiredEndpoints = failed
      .map((f, i) => (f.error?.includes("410") || f.error?.includes("404") ? subscriptions[i].endpoint : null))
      .filter(Boolean);

    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed.length,
        cleaned: expiredEndpoints.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
