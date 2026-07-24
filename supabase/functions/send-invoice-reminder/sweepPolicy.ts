// ============================================================
// send-invoice-reminder — per-tenant sweep opt-in decision (Week 0 D2)
// ============================================================
// Side-effect-free (no top-level I/O) so it can be imported directly by
// sweepPolicy.test.ts — same pattern as authz.ts / evidenceRow.ts.
//
// Founder decision 3 (2026-07-21): the automated all-overdue sweep is
// per-tenant OPT-IN, default off. A tenant with no tenant_settings row,
// a null flag, or an explicit false is SKIPPED — only an explicit true
// sends. The manual per-invoice reminder (a specific invoice_id on the
// request) is an explicit human action and ignores the flag entirely.

export interface ReminderPolicyInput {
  /** True when the request names no specific invoice_id (the sweep). */
  sweepMode: boolean;
  /**
   * tenant_settings.invoice_reminders_enabled for the invoice's tenant.
   * undefined = no tenant_settings row found (fail-safe: treated as off).
   */
  tenantOptIn: boolean | null | undefined;
}

export function shouldSendReminder(input: ReminderPolicyInput): {
  send: boolean;
  skipReason?: string;
} {
  if (!input.sweepMode) {
    return { send: true };
  }
  if (input.tenantOptIn === true) {
    return { send: true };
  }
  return { send: false, skipReason: "Reminders disabled for tenant" };
}
