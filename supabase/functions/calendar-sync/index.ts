import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken, decryptToken } from "../_shared/tokenEncryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function refreshOutlookToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        scope: "Calendars.Read offline_access",
      }),
    }
  );
  if (!res.ok) return null;
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require user auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get the user's calendar sync tokens
  const { data: tokenRow, error: tokenErr } = await serviceSupabase
    .from("calendar_sync_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return new Response(JSON.stringify({ error: "No calendar connection found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Decrypt stored tokens (backward-compatible with plaintext values)
  if (tokenRow.google_access_token) {
    tokenRow.google_access_token = await decryptToken(tokenRow.google_access_token);
  }
  if (tokenRow.google_refresh_token) {
    tokenRow.google_refresh_token = await decryptToken(tokenRow.google_refresh_token);
  }
  if (tokenRow.outlook_access_token) {
    tokenRow.outlook_access_token = await decryptToken(tokenRow.outlook_access_token);
  }
  if (tokenRow.outlook_refresh_token) {
    tokenRow.outlook_refresh_token = await decryptToken(tokenRow.outlook_refresh_token);
  }

  const now = new Date();
  const startOfRange = now.toISOString();
  const endOfRange = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const results: { provider: string; synced: number; error?: string }[] = [];

  // --- Google Calendar Sync ---
  if (tokenRow.google_access_token || tokenRow.google_refresh_token) {
    const googleClientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

    let accessToken = tokenRow.google_access_token;
    let tokenUpdates: Record<string, string> = {};

    // Refresh if expired or close to expiry
    const isExpired =
      tokenRow.google_token_expiry &&
      new Date(tokenRow.google_token_expiry).getTime() < Date.now() + 60000;

    if ((isExpired || !accessToken) && tokenRow.google_refresh_token && googleClientId && googleClientSecret) {
      const refreshed = await refreshGoogleToken(
        tokenRow.google_refresh_token,
        googleClientId,
        googleClientSecret
      );
      if (refreshed?.access_token) {
        accessToken = refreshed.access_token;
        tokenUpdates.google_access_token = await encryptToken(accessToken);
        tokenUpdates.google_token_expiry = new Date(
          Date.now() + refreshed.expires_in * 1000
        ).toISOString();
      }
    }

    if (accessToken) {
      try {
        const calId = encodeURIComponent(tokenRow.google_calendar_id || "primary");
        const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?` +
          new URLSearchParams({
            timeMin: startOfRange,
            timeMax: endOfRange,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "250",
          });

        const eventsRes = await fetch(eventsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          const events = eventsData.items ?? [];

          // Upsert events into external_calendar_events
          const toUpsert = events
            .filter((e: Record<string, unknown>) => e.status !== "cancelled")
            .map((e: Record<string, unknown>) => {
              const start = e.start as Record<string, string>;
              const end = e.end as Record<string, string>;
              const isAllDay = !!start.date;
              return {
                user_id: user.id,
                tenant_id: tokenRow.tenant_id,
                provider: "google",
                external_id: e.id as string,
                title: (e.summary as string) || null,
                start_at: isAllDay ? `${start.date}T00:00:00Z` : start.dateTime,
                end_at: isAllDay ? `${end.date}T00:00:00Z` : end.dateTime,
                is_all_day: isAllDay,
                synced_at: new Date().toISOString(),
              };
            });

          if (toUpsert.length > 0) {
            await serviceSupabase
              .from("external_calendar_events")
              .upsert(toUpsert, { onConflict: "user_id,provider,external_id" });
          }

          results.push({ provider: "google", synced: toUpsert.length });
        } else {
          const errText = await eventsRes.text();
          results.push({ provider: "google", synced: 0, error: errText });
        }
      } catch (err) {
        results.push({ provider: "google", synced: 0, error: String(err) });
      }
    }

    // Save refreshed token if updated
    if (Object.keys(tokenUpdates).length > 0) {
      await serviceSupabase
        .from("calendar_sync_tokens")
        .update(tokenUpdates)
        .eq("user_id", user.id);
    }
  }

  // --- Outlook Calendar Sync ---
  if (tokenRow.outlook_access_token || tokenRow.outlook_refresh_token) {
    const azureClientId = Deno.env.get("AZURE_CLIENT_ID");
    const azureClientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
    const azureTenantId = Deno.env.get("AZURE_TENANT_ID") || "common";

    let accessToken = tokenRow.outlook_access_token;
    let tokenUpdates: Record<string, string> = {};

    const isExpired =
      tokenRow.outlook_token_expiry &&
      new Date(tokenRow.outlook_token_expiry).getTime() < Date.now() + 60000;

    if ((isExpired || !accessToken) && tokenRow.outlook_refresh_token && azureClientId && azureClientSecret) {
      const refreshed = await refreshOutlookToken(
        tokenRow.outlook_refresh_token,
        azureClientId,
        azureClientSecret,
        azureTenantId
      );
      if (refreshed?.access_token) {
        accessToken = refreshed.access_token;
        tokenUpdates.outlook_access_token = await encryptToken(accessToken);
        tokenUpdates.outlook_token_expiry = new Date(
          Date.now() + refreshed.expires_in * 1000
        ).toISOString();
      }
    }

    if (accessToken) {
      try {
        const eventsUrl = `https://graph.microsoft.com/v1.0/me/calendarView?` +
          new URLSearchParams({
            startDateTime: startOfRange,
            endDateTime: endOfRange,
            $top: "250",
            $select: "id,subject,start,end,isAllDay",
          });

        const eventsRes = await fetch(eventsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          const events = eventsData.value ?? [];

          const toUpsert = events.map((e: Record<string, unknown>) => {
            const start = e.start as Record<string, string>;
            const end = e.end as Record<string, string>;
            return {
              user_id: user.id,
              tenant_id: tokenRow.tenant_id,
              provider: "outlook",
              external_id: e.id as string,
              title: (e.subject as string) || null,
              start_at: start.dateTime + "Z",
              end_at: end.dateTime + "Z",
              is_all_day: !!(e.isAllDay),
              synced_at: new Date().toISOString(),
            };
          });

          if (toUpsert.length > 0) {
            await serviceSupabase
              .from("external_calendar_events")
              .upsert(toUpsert, { onConflict: "user_id,provider,external_id" });
          }

          results.push({ provider: "outlook", synced: toUpsert.length });
        } else {
          const errText = await eventsRes.text();
          results.push({ provider: "outlook", synced: 0, error: errText });
        }
      } catch (err) {
        results.push({ provider: "outlook", synced: 0, error: String(err) });
      }
    }

    if (Object.keys(tokenUpdates).length > 0) {
      await serviceSupabase
        .from("calendar_sync_tokens")
        .update(tokenUpdates)
        .eq("user_id", user.id);
    }
  }

  // Update last_synced_at
  await serviceSupabase
    .from("calendar_sync_tokens")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
