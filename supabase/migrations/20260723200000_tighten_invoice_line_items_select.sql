-- ============================================================
-- Week 0 security batch C2 (founder-approved 2026-07-22)
-- invoice_line_items SELECT: mirror the parent invoices policy
-- ============================================================
-- "Users can view invoice items" (20251218033702) checked tenant
-- membership only. When invoices SELECT was tightened to
-- owner/admin/dispatcher (20260107061503), line items were never updated
-- in lockstep — so a technician's JWT could read every line item in the
-- tenant directly, despite having no read access to the parent invoice
-- and no UI surface (the only mount is /invoices, RoleGuard
-- owner/admin/dispatcher).
--
-- Breakage check (verified before this fix): the only direct frontend
-- reader is InvoiceDetailSheet (owner/admin/dispatcher route); the
-- customer portal reads line items exclusively through the
-- generate-invoice-pdf edge function (service role + authorize.ts), and
-- send-invoice-email / tenant-api also use the service role — none are
-- affected by RLS. The portal arm below therefore changes nothing today
-- but makes a future direct portal query correct by construction,
-- mirroring "Portal clients can view their own invoices"
-- (20260610200000).
--
-- Write policy ("Admins can manage invoice items") is untouched.
-- ============================================================

DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_line_items;

CREATE POLICY "Staff can view invoice items"
ON public.invoice_line_items
FOR SELECT
USING (
  invoice_id IN (
    SELECT id FROM public.invoices
    WHERE tenant_id = get_user_tenant_id()
  )
  AND (is_tenant_admin() OR get_user_role() = 'dispatcher')
);

CREATE POLICY "Portal clients can view their own invoice items"
ON public.invoice_line_items
FOR SELECT
USING (
  invoice_id IN (
    SELECT i.id
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    WHERE c.user_id = auth.uid()
  )
);
