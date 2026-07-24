-- ============================================================
-- Week 0 security batch C1 (founder-approved 2026-07-22)
-- notifications INSERT: close within-tenant spoofing
-- ============================================================
-- The original INSERT policy (20260108041939) checked only
-- user_belongs_to_tenant(tenant_id) and never constrained the user_id
-- column, so any authenticated tenant member could create notification
-- rows for ANY user (including users of other tenants) via a direct
-- PostgREST call. Verified before this fix: NO code path inserts into
-- notifications at all — the frontend only selects/updates/deletes its
-- own rows (useNotifications.tsx), the "notify technician" flows are Web
-- Push via send-push-notification (never this table), and no edge
-- function or migration inserts either. Edge functions use the service
-- role and bypass RLS regardless, so nothing legitimate relied on the
-- loose check.
-- ============================================================

DROP POLICY IF EXISTS "System can insert notifications for tenant users" ON public.notifications;

CREATE POLICY "Users can create their own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND user_belongs_to_tenant(tenant_id)
);
