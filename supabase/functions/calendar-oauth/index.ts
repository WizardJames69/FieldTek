import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken } from "../_shared/tokenEncryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- HMAC-signed OAuth state helpers ---

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

async function createSignedState(
  userId: string,
  tenantId: string,
  secret: string
): Promise<string> {
  const payload = {
    user_id: userId,
    tenant_id: tenantId,
    exp: Date.now() + 10 * 60 * 1000, // 10 minute expiry
    nonce: crypto.randomUUID(),
  };
  const key = await getHmacKey(secret);
  const message = JSON.stringify(payload);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return btoa(JSON.stringify({ ...payload, sig: toHex(signature) }));
}

async function verifySignedState(
  stateParam: string,
  secret: string
): Promise<{ user_id: string; tenant_id: string } | null> {
  try {
    const decoded = JSON.parse(atob(stateParam));
    const { sig, ...payload } = decoded;

    if (!sig || !payload.user_id || !payload.tenant_id || !payload.exp) {
      return null;
    }
    if (Date.now() > payload.exp) {
      console.error("OAuth state expired");
      return null;
    }

    const key = await getHmacKey(secret);
    const message = JSON.stringify(payload);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromHex(sig),
      new TextEncoder().encode(message)
    );

    return valid ? { user_id: payload.user_id, tenant_id: payload.tenant_id } : null;
  } catch (err) {
    console.error("State verification failed:", err);
    return null;
  }
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL") || "https://fieldforce-unified-hub.lovable.app";
  const redirectUri = `${supabaseUrl.replace("/rest/v1", "")}/functions/v1/calendar-oauth`;

  // --- POST: Authenticated initiation ---
  if (req.method === "POST") {
    try {
      const { action, provider } = await req.json();

      if (action !== "initiate" || !provider) {
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the caller's JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await anonClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up the user's tenant
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!tenantUser?.tenant_id) {
        return new Response(
          JSON.stringify({ error: "No tenant found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create HMAC-signed state
      const state = await createSignedState(user.id, tenantUser.tenant_id, serviceKey);

      // Build the OAuth URL for the requested provider
      let oauthUrl: string;

      if (provider === "google") {
        const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
        if (!clientId) {
          return new Response(
            JSON.stringify({ error: "Google Calendar not configured" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
          state,
        });
        oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      } else if (provider === "outlook") {
        const clientId = Deno.env.get("AZURE_CLIENT_ID");
        const azureTenantId = Deno.env.get("AZURE_TENANT_ID") || "common";
        if (!clientId) {
          return new Response(
            JSON.stringify({ error: "Outlook Calendar not configured" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "Calendars.Read offline_access",
          state,
        });
        oauthUrl = `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/authorize?${params}`;
      } else {
        return new Response(
          JSON.stringify({ error: "Unknown provider" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ url: oauthUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Initiate error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to initiate OAuth" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // --- GET: OAuth callback ---
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error from ${provider}:`, error);
    return Response.redirect(`${appUrl}/settings?tab=calendar&error=${encodeURIComponent(error)}`);
  }

  if (!code || !stateParam) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify HMAC-signed state
  const state = await verifySignedState(stateParam, serviceKey);
  if (!state) {
    console.error("Invalid or expired OAuth state");
    return Response.redirect(`${appUrl}/settings?tab=calendar&error=invalid_state`);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    if (provider === "google") {
      const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        return Response.redirect(`${appUrl}/settings?tab=calendar&error=google_not_configured`);
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.access_token) {
        console.error("Google token exchange failed:", tokens);
        return Response.redirect(`${appUrl}/settings?tab=calendar&error=google_token_failed`);
      }

      // Get primary calendar ID
      const calRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const calData = await calRes.json();
      const calendarId = calData.id || "primary";

      const expiry = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

      // Encrypt tokens before storing
      const encAccessToken = await encryptToken(tokens.access_token);
      const encRefreshToken = tokens.refresh_token
        ? await encryptToken(tokens.refresh_token)
        : null;

      // Upsert into calendar_sync_tokens
      const { error: upsertErr } = await supabase
        .from("calendar_sync_tokens")
        .upsert(
          {
            user_id: state.user_id,
            tenant_id: state.tenant_id,
            ical_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
            google_access_token: encAccessToken,
            google_refresh_token: encRefreshToken,
            google_token_expiry: expiry,
            google_calendar_id: calendarId,
          },
          { onConflict: "user_id", ignoreDuplicates: false }
        );

      if (upsertErr) {
        console.error("Google upsert error:", upsertErr);
        return Response.redirect(`${appUrl}/settings?tab=calendar&error=db_error`);
      }

      return Response.redirect(`${appUrl}/settings?tab=calendar&connected=google`);
    }

    if (provider === "outlook") {
      const clientId = Deno.env.get("AZURE_CLIENT_ID");
      const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
      const azureTenantId = Deno.env.get("AZURE_TENANT_ID") || "common";

      if (!clientId || !clientSecret) {
        return Response.redirect(`${appUrl}/settings?tab=calendar&error=outlook_not_configured`);
      }

      // Exchange code for tokens
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            scope: "Calendars.Read offline_access",
          }),
        }
      );

      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.access_token) {
        console.error("Outlook token exchange failed:", tokens);
        return Response.redirect(`${appUrl}/settings?tab=calendar&error=outlook_token_failed`);
      }

      // Get primary calendar ID
      const calRes = await fetch(
        "https://graph.microsoft.com/v1.0/me/calendar",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const calData = await calRes.json();
      const calendarId = calData.id || "primary";

      const expiry = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

      // Encrypt tokens before storing
      const encOutlookAccess = await encryptToken(tokens.access_token);
      const encOutlookRefresh = tokens.refresh_token
        ? await encryptToken(tokens.refresh_token)
        : null;

      const { error: upsertErr } = await supabase
        .from("calendar_sync_tokens")
        .upsert(
          {
            user_id: state.user_id,
            tenant_id: state.tenant_id,
            ical_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
            outlook_access_token: encOutlookAccess,
            outlook_refresh_token: encOutlookRefresh,
            outlook_token_expiry: expiry,
            outlook_calendar_id: calendarId,
          },
          { onConflict: "user_id", ignoreDuplicates: false }
        );

      if (upsertErr) {
        console.error("Outlook upsert error:", upsertErr);
        return Response.redirect(`${appUrl}/settings?tab=calendar&error=db_error`);
      }

      return Response.redirect(`${appUrl}/settings?tab=calendar&connected=outlook`);
    }

    // Detect provider from state if not in URL (some OAuth flows don't preserve query params)
    return new Response(JSON.stringify({ error: "Unknown provider" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("calendar-oauth error:", err);
    return Response.redirect(`${appUrl}/settings?tab=calendar&error=internal`);
  }
});
