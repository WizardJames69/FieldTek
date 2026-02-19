import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider"); // 'google' | 'outlook'
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appUrl = Deno.env.get("APP_URL") || "https://fieldforce-unified-hub.lovable.app";

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error from ${provider}:`, error);
    return Response.redirect(`${appUrl}/settings?tab=calendar&error=${encodeURIComponent(error)}`);
  }

  if (!code || !stateParam || !provider) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Decode state: base64-encoded JSON with user_id and tenant_id
  let state: { user_id: string; tenant_id: string };
  try {
    state = JSON.parse(atob(stateParam));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid state" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const redirectUri = `${Deno.env.get("SUPABASE_URL")!.replace("/rest/v1", "")}/functions/v1/calendar-oauth`;

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

      // Upsert into calendar_sync_tokens
      const { error: upsertErr } = await supabase
        .from("calendar_sync_tokens")
        .upsert(
          {
            user_id: state.user_id,
            tenant_id: state.tenant_id,
            ical_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""), // placeholder if not exists
            google_access_token: tokens.access_token,
            google_refresh_token: tokens.refresh_token || null,
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
      const tenantId = Deno.env.get("AZURE_TENANT_ID") || "common";

      if (!clientId || !clientSecret) {
        return Response.redirect(`${appUrl}/settings?tab=calendar&error=outlook_not_configured`);
      }

      // Exchange code for tokens
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
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

      const { error: upsertErr } = await supabase
        .from("calendar_sync_tokens")
        .upsert(
          {
            user_id: state.user_id,
            tenant_id: state.tenant_id,
            ical_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
            outlook_access_token: tokens.access_token,
            outlook_refresh_token: tokens.refresh_token || null,
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

    return new Response(JSON.stringify({ error: "Unknown provider" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("calendar-oauth error:", err);
    return Response.redirect(`${appUrl}/settings?tab=calendar&error=internal`);
  }
});
