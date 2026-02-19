
# Google Calendar & Outlook Calendar Sync for Technicians

## Architecture Decision: iCal Feed + OAuth for Write-Back

There are two technically distinct halves to "see FieldTek jobs in personal calendars and vice versa":

**1. FieldTek → External calendar (read from FieldTek):**
The cleanest, most universal approach is a **secret iCal/webcal feed URL** per user. This is a standard RFC 5545 `.ics` subscription that every calendar app supports natively — Google Calendar ("Other calendars → URL"), Apple Calendar, Outlook ("Add calendar → From internet"), and Android/iOS stock calendars. No OAuth required. The feed auto-refreshes every 6–24 hours on the calendar client side.

**2. External calendar → FieldTek (write-back / "vice versa"):**
This direction requires OAuth. The user must authorize FieldTek to read their Google or Outlook calendar. Google Calendar API and Microsoft Graph (Outlook) both use OAuth 2.0 with client credentials that must be configured. There are **no pre-built connectors** in this workspace for either — the only available connector is ElevenLabs. Therefore OAuth credentials (Google OAuth Client ID/Secret or Azure App Registration Client ID/Secret) must be stored as backend secrets and set up by the project owner once.

**Design choice:** Implement both halves in a phased, pragmatic way:
- Phase 1 (no credentials required): iCal feed for all users immediately
- Phase 2 (requires OAuth setup): Google Calendar write-back (import external events as blocked time)

The "vice versa" direction is limited to **showing external busy time in FieldTek** (blocked time awareness) — not creating FieldTek jobs from Google Calendar events, which would be extremely complex conflict-resolution logic.

---

## What Gets Built

### 1. Database: `calendar_sync_tokens` table

A new table storing per-user iCal feed tokens and (optionally) OAuth tokens for external calendar connections.

```sql
CREATE TABLE public.calendar_sync_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ical_token      text NOT NULL UNIQUE,  -- secret token for the iCal feed URL
  google_access_token   text,            -- encrypted OAuth access token
  google_refresh_token  text,            -- encrypted OAuth refresh token
  google_token_expiry   timestamptz,
  google_calendar_id    text,            -- which Google calendar to read from
  outlook_access_token  text,
  outlook_refresh_token text,
  outlook_token_expiry  timestamptz,
  outlook_calendar_id   text,
  sync_enabled    boolean NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only see/manage their own token
ALTER TABLE public.calendar_sync_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calendar sync" ON public.calendar_sync_tokens
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

The `ical_token` is a 32-byte random secret (hex) generated client-side. The URL is:
```
/functions/v1/calendar-feed/{ical_token}.ics
```

This is public (no auth header needed — the token IS the auth) so any calendar app can subscribe to it.

### 2. Edge Function: `calendar-feed`

A new edge function (`supabase/functions/calendar-feed/index.ts`) that:

1. Extracts the token from the URL path (`.../calendar-feed/TOKEN.ics`)
2. Looks up the token in `calendar_sync_tokens` using the **service role client** (bypasses RLS since the request has no auth header)
3. Fetches the user's `scheduled_jobs` for the next 90 days (and past 30 days) from `scheduled_jobs` filtered by `assigned_to = user_id` AND `tenant_id`
4. Formats the jobs as a valid iCalendar (RFC 5545) string with:
   - `VEVENT` per job
   - `DTSTART` / `DTEND` from `scheduled_date` + `scheduled_time` + `estimated_duration`
   - `SUMMARY` = job title
   - `DESCRIPTION` = job type, client name, notes
   - `LOCATION` = job address
   - `STATUS` = CONFIRMED / CANCELLED
   - `UID` = `job-{id}@fieldtek.ai` (stable UID so calendar apps track updates)
   - `LAST-MODIFIED` = `updated_at`
5. Returns the response with `Content-Type: text/calendar; charset=utf-8` and `Content-Disposition: attachment; filename="fieldtek-jobs.ics"`

No JWT verification needed — the `ical_token` is the credential. Added to `supabase/config.toml` with `verify_jwt = false`.

### 3. Edge Function: `calendar-oauth` (Google + Outlook OAuth flow)

A single edge function handling the OAuth callback for both providers:

**GET** `/calendar-oauth?provider=google&code=...&state=...`
**GET** `/calendar-oauth?provider=outlook&code=...&state=...`

The state parameter encodes `user_id` and `tenant_id` (base64-encoded, not sensitive — the security is the OAuth code itself which is single-use).

The function:
1. Exchanges the auth code for access + refresh tokens using the configured secrets
2. Fetches the user's primary calendar ID from the provider API
3. Upserts the tokens into `calendar_sync_tokens`
4. Redirects to `/settings?tab=calendar&connected=google` (or outlook)

Secrets required (added via backend secrets):
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID` (use `common` for multi-tenant)

**Important:** The OAuth feature (write-back) is presented to users but requires the project owner to first configure these secrets and register OAuth apps with Google and Microsoft. The iCal feed works **without any secrets**.

### 4. Edge Function: `calendar-sync` (scheduled background sync)

A lightweight edge function called on-demand (from the settings UI "Sync Now" button) that:

1. Fetches connected users' external calendar events for the next 14 days
2. Stores them as `external_calendar_events` (new table) with user_id, start/end times, summary (title only — no description for privacy)
3. These events show as "busy" blocks in the FieldTek Schedule page for dispatchers viewing a technician's calendar

This is **one-way read** from external → FieldTek. No events are created in the external calendar from FieldTek (the iCal feed already handles that direction).

### 5. Database: `external_calendar_events` table

```sql
CREATE TABLE public.external_calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL,   -- 'google' | 'outlook'
  external_id     text NOT NULL,
  title           text,            -- shown as "Busy" in dispatcher view by default
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  is_all_day      boolean NOT NULL DEFAULT false,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, external_id)
);

ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;
-- Technicians see own events; admins/dispatchers in same tenant see all
CREATE POLICY "Own events" ON public.external_calendar_events
  FOR SELECT USING (user_id = auth.uid() OR get_user_tenant_id() = tenant_id AND is_tenant_admin());
CREATE POLICY "Own insert/update/delete" ON public.external_calendar_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### 6. Frontend: `CalendarSettings` component

New component `src/components/settings/CalendarSettings.tsx` added as a "Calendar" tab in `Settings.tsx`.

**Sections:**

**A. iCal Feed (works immediately, no setup)**
- "Your Personal Job Feed" card
- Shows the feed URL: `https://dlrhobkrjfegtbdsqdsa.supabase.co/functions/v1/calendar-feed/TOKEN.ics`
- Copy button
- Regenerate token button (with confirmation dialog)
- Platform-specific install guides (expandable):
  - **Google Calendar**: "Open Google Calendar → Other calendars (+ icon) → From URL → Paste URL"
  - **Apple Calendar / iPhone**: "Open Calendar app → File → New Calendar Subscription → Paste URL"
  - **Outlook**: "Add calendar → Subscribe from web → Paste URL"
  - **Android**: "Open Google Calendar → Settings → Add account → Other → Paste URL"
- Status badge showing last time the token was created

**B. Google Calendar Connection (OAuth)**
- Connect button → initiates OAuth flow
- When connected: shows which calendar is synced, "Sync Now" button, "Disconnect" button
- Requires `GOOGLE_CALENDAR_CLIENT_ID` secret to be configured; if not set, shows a "Contact your administrator to configure Google Calendar integration" notice

**C. Outlook/Microsoft 365 Connection (OAuth)**
- Same pattern as Google

**D. Privacy note**: "External calendar titles are imported as 'Busy' blocks only. Event details from your personal calendar are never stored."

### 7. Frontend: Show External Busy Blocks in Schedule

Update `src/components/schedule/CalendarView.tsx` and `src/pages/MyCalendar.tsx` to:
- Fetch `external_calendar_events` for the visible date range + assigned technician
- Render "Busy" blocks behind job cards in the calendar using a distinct visual style (hatched/muted pattern)
- These blocks are read-only (not clickable to edit, just informational for dispatchers)

### 8. Feature Gating

Calendar sync is available to **Growth tier and above** (same as `ai_assistant`). Add `calendar_sync` to the `FEATURE_ACCESS` map in `useFeatureAccess.tsx`:

```typescript
calendar_sync: ["trial", "growth", "professional", "enterprise"],
```

And add `calendar_sync` to `FeatureKey` type. The iCal feed is extremely lightweight so making it available from Growth is appropriate.

---

## Files Created / Modified

| File | Action | Change |
|---|---|---|
| `supabase/migrations/YYYYMMDD_add_calendar_sync.sql` | Create | `calendar_sync_tokens` + `external_calendar_events` tables + RLS |
| `supabase/functions/calendar-feed/index.ts` | Create | iCal feed generator edge function |
| `supabase/functions/calendar-oauth/index.ts` | Create | Google + Outlook OAuth callback handler |
| `supabase/functions/calendar-sync/index.ts` | Create | On-demand sync of external calendar events |
| `supabase/config.toml` | Edit | Add `verify_jwt = false` for `calendar-feed` and `calendar-oauth` |
| `src/hooks/useFeatureAccess.tsx` | Edit | Add `calendar_sync` feature key |
| `src/components/FeatureGate.tsx` | Edit | Add `calendar_sync` to `formatFeatureName` |
| `src/components/settings/CalendarSettings.tsx` | Create | Full settings UI with iCal feed + OAuth connect/disconnect |
| `src/pages/Settings.tsx` | Edit | Add "Calendar" tab |
| `src/pages/MyCalendar.tsx` | Edit | Fetch + display external busy blocks |
| `src/components/schedule/CalendarView.tsx` | Edit | Render external busy blocks in dispatcher view |

---

## OAuth Setup (Required for Write-Back Only)

The iCal feed works with **zero configuration**. For the Google/Outlook OAuth connection, the project owner must:

**Google:**
1. Go to console.cloud.google.com → Create OAuth 2.0 credentials (Web application type)
2. Add authorized redirect URI: `https://dlrhobkrjfegtbdsqdsa.supabase.co/functions/v1/calendar-oauth`
3. Enable the Google Calendar API
4. Store `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` as backend secrets

**Microsoft (Outlook):**
1. Go to portal.azure.com → App registrations → New registration
2. Add redirect URI: `https://dlrhobkrjfegtbdsqdsa.supabase.co/functions/v1/calendar-oauth`
3. Add Calendars.Read permission under Microsoft Graph
4. Store `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` as backend secrets

If secrets are not present, the OAuth connect buttons are hidden and replaced with a notice. The iCal feed section is always shown and always works.

---

## Security Notes

- The iCal token is 32 random bytes (256 bits of entropy) — effectively unguessable
- Tokens can be regenerated at any time; old token stops working immediately
- OAuth tokens are stored in the database (not in localStorage) but are not encrypted at rest — this is standard for this class of integration; Supabase's database encryption at rest protects them
- The `calendar-oauth` callback validates that the `state` parameter's `user_id` matches the authenticated user (for the redirect after OAuth) — the OAuth code itself is single-use and validated server-side
- External event titles are truncated/anonymized to "Busy" in dispatcher view (configurable — technicians can choose to share full titles)
- No breaking changes to any existing tables or components
