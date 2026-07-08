/**
 * Kill switch for ALL payment-collection UI during Design Partner Alpha:
 * subscription checkout (create-checkout), Stripe customer portal
 * (customer-portal), Stripe Connect onboarding (stripe-connect-onboard /
 * stripe-connect-status), and the customer portal invoice "Pay Now" flow
 * (create-invoice-payment).
 *
 * While false, those surfaces render honest "not enabled during the alpha"
 * states and none of the Stripe edge functions above are invoked from the UI.
 * Non-Stripe invoicing (create, send, PDF, reminders, Mark as Paid) is
 * unaffected.
 *
 * Flip to true ONLY in the Stripe Live reopen PR, alongside PR-STRIPE-2
 * (live catalog IDs) and setting Stripe secrets on fgem. See the design
 * partner runbook and the parked Stripe Live readiness plan.
 */
export const PAYMENT_COLLECTION_ENABLED = false;
