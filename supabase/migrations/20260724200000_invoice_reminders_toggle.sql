-- ============================================================
-- Week 0 Workstream D2 (founder decision 3, 2026-07-21):
-- per-tenant opt-in for the automated overdue-invoice reminder sweep.
-- DEFAULT OFF — no tenant's customers receive automated emails until
-- that tenant explicitly enables it in Settings → Notifications.
-- send-invoice-reminder's sweep mode skips tenants where this is false
-- (and, fail-safe, tenants with no tenant_settings row at all).
-- The manual per-invoice reminder button is unaffected by this flag —
-- it is an explicit human action.
-- ============================================================

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS invoice_reminders_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenant_settings.invoice_reminders_enabled IS
  'Opt-in for the daily automated overdue-invoice reminder sweep (emails the tenant''s customers). Default false; surfaced in Settings -> Notifications (owner/admin). Manual per-invoice reminders ignore this flag.';
