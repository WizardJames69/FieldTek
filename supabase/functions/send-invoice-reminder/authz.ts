/**
 * Authorization + tenant resolution for a NON-service-role caller of
 * send-invoice-reminder.
 *
 * The in-app "Send payment reminder" button invokes this function with only
 * `{ invoice_id }` (no tenant_id) under the staff user's JWT, so we must be
 * able to derive the tenant from the invoice and then verify membership —
 * without ever letting a caller reach another tenant's invoice.
 *
 * Pure orchestration over injected async resolvers so it can be unit-tested
 * with stubs (no network). The service-role path is handled by the caller and
 * never reaches this function.
 *
 * Decisions:
 *  - no authenticated user                         → 401
 *  - explicit tenant_id, caller not a member       → 403 (tenant existence not sensitive)
 *  - no tenant_id and no invoice_id                → 400
 *  - invoice_id resolves to no tenant (not found)  → 404
 *  - invoice_id resolves but caller not a member   → 404 (do NOT leak that the invoice exists)
 *  - member of the resolved/target tenant          → allowed, with effectiveTenantId
 */

export interface InvoiceReminderAccess {
  allowed: boolean;
  status?: 400 | 401 | 403 | 404;
  effectiveTenantId?: string;
}

export async function decideInvoiceReminderAccess(params: {
  userId: string | null;
  tenantId: string | null;
  invoiceId: string | null;
  /** Resolve an invoice id to its tenant id (null if the invoice does not exist). */
  resolveInvoiceTenant: (invoiceId: string) => Promise<string | null>;
  /** Active-membership check for (userId, tenantId). */
  isMember: (userId: string, tenantId: string) => Promise<boolean>;
}): Promise<InvoiceReminderAccess> {
  const { userId, tenantId, invoiceId, resolveInvoiceTenant, isMember } = params;

  if (!userId) return { allowed: false, status: 401 };

  // Path A: caller named the tenant explicitly.
  if (tenantId) {
    const member = await isMember(userId, tenantId);
    if (!member) return { allowed: false, status: 403 };
    return { allowed: true, effectiveTenantId: tenantId };
  }

  // Path B: derive the tenant from the invoice.
  if (!invoiceId) return { allowed: false, status: 400 };

  const resolved = await resolveInvoiceTenant(invoiceId);
  if (!resolved) return { allowed: false, status: 404 };

  const member = await isMember(userId, resolved);
  // 404 (not 403) so a non-member cannot distinguish "exists in another tenant"
  // from "does not exist".
  if (!member) return { allowed: false, status: 404 };

  return { allowed: true, effectiveTenantId: resolved };
}
