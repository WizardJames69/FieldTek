
-- Calendar sync tokens table (per-user iCal feed token + OAuth credentials)
CREATE TABLE public.calendar_sync_tokens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ical_token            text NOT NULL UNIQUE,
  google_access_token   text,
  google_refresh_token  text,
  google_token_expiry   timestamptz,
  google_calendar_id    text,
  outlook_access_token  text,
  outlook_refresh_token text,
  outlook_token_expiry  timestamptz,
  outlook_calendar_id   text,
  sync_enabled          boolean NOT NULL DEFAULT true,
  last_synced_at        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_sync_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar sync"
  ON public.calendar_sync_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_calendar_sync_tokens_user_id ON public.calendar_sync_tokens(user_id);
CREATE INDEX idx_calendar_sync_tokens_ical_token ON public.calendar_sync_tokens(ical_token);

-- External calendar events table (imported busy blocks from Google/Outlook)
CREATE TABLE public.external_calendar_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider    text NOT NULL CHECK (provider IN ('google', 'outlook')),
  external_id text NOT NULL,
  title       text,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  is_all_day  boolean NOT NULL DEFAULT false,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, external_id)
);

ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;

-- Technicians see their own events; tenant admins/dispatchers see all in their tenant
CREATE POLICY "Users can view own external events"
  ON public.external_calendar_events FOR SELECT
  USING (
    user_id = auth.uid()
    OR (tenant_id = get_user_tenant_id() AND is_tenant_admin())
    OR (tenant_id = get_user_tenant_id() AND get_user_role() = 'dispatcher')
  );

CREATE POLICY "Users can manage own external events"
  ON public.external_calendar_events FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_external_calendar_events_user_id ON public.external_calendar_events(user_id);
CREATE INDEX idx_external_calendar_events_tenant_id ON public.external_calendar_events(tenant_id);
CREATE INDEX idx_external_calendar_events_date_range ON public.external_calendar_events(start_at, end_at);

-- Updated_at trigger for calendar_sync_tokens
CREATE TRIGGER update_calendar_sync_tokens_updated_at
  BEFORE UPDATE ON public.calendar_sync_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
