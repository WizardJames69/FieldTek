// ============================================================
// generate-invoice-pdf — Invoice access authorization (PR-SEC-5 / B1)
// ============================================================
// Side-effect-free (no top-level I/O or server startup) so it can be imported
// directly by authorize.test.ts for real unit coverage — same pattern as
// field-assistant/jobOwnership.ts. index.ts calls isAuthorizedForInvoice
// AFTER fetching the invoice (with the service-role client) and BEFORE
// rendering any of its PII/financials.
//
// The endpoint has verify_jwt=false and authenticates the caller with getUser,
// which only proves the caller is *some* logged-in user. Without this check any
// authenticated user (another tenant's staff, any portal customer, a demo user)
// could fetch another tenant's invoice by UUID. Two legitimate audiences,
// mirroring send-invoice-email (staff) and create-invoice-payment (portal):
//   (a) active staff of the invoice's tenant, role owner/admin/dispatcher, and
//   (b) the portal customer whose client record owns the invoice.
// Callers translate `false` into a non-enumerating 404 (identical to a missing
// invoice), so a foreign-tenant invoice and a nonexistent one are
// indistinguishable.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const ALLOWED_STAFF_ROLES = ["owner", "admin", "dispatcher"];

export interface InvoiceAuthContext {
  tenant_id: string;
  client_id: string | null;
}

/**
 * True iff `userId` may read the full content of an invoice belonging to
 * `invoice.tenant_id` / `invoice.client_id`. Fails CLOSED: any lookup error
 * returns false so the caller responds 404 rather than leaking on error.
 */
export async function isAuthorizedForInvoice(
  client: SupabaseClient,
  userId: string,
  invoice: InvoiceAuthContext,
): Promise<boolean> {
  try {
    const [{ data: staff }, { data: owningClient }] = await Promise.all([
      client
        .from("tenant_users")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", invoice.tenant_id)
        .eq("is_active", true)
        .maybeSingle(),
      invoice.client_id
        ? client
            .from("clients")
            .select("id")
            .eq("user_id", userId)
            .eq("id", invoice.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const isAuthorizedStaff = !!staff && ALLOWED_STAFF_ROLES.includes(staff.role);
    const isOwningPortalClient = !!owningClient;
    return isAuthorizedStaff || isOwningPortalClient;
  } catch (err) {
    console.error("[generate-invoice-pdf] Authorization lookup failed — failing CLOSED:", err);
    return false;
  }
}
