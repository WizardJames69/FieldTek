# Backlog

Tracked work that is real but **not blocking** the current milestone. Items land here when a decision defers them deliberately, so they stay visible instead of living in a chat log. Each entry states who opened it, why it exists, and what "done" looks like.

Closed items are deleted, not archived — the PR that closes one removes its entry.

---

## Demo portal account, created through the app's own invitation flow

**Opened:** founder, 2026-07-24 (out of Week 0, explicitly non-blocking).

**Why.** There is currently **no portal-linked client on any tenant** — every demo client carries an undeliverable `.example` address, so `clients.user_id` is null everywhere and the customer portal has zero real users. Two things depend on that changing:

- **PR-APP-7 (quote approval, weeks 6–9)** needs a portal approve flow, and it cannot be built or demoed against zero portal users.
- **The invitation path itself is untested.** `send-portal-invitation` writes a `portal_invitations` row with a 7-day expiry and emails a `/portal/signup?token=…` link via Resend; nobody has ever walked it end to end.

It also becomes the first runtime exercise of C2's portal SELECT arm, which is flagged known-unverified in [week0-summary.md](week0-summary.md).

**Constraint (founder).** Create it **app-natively**, not with the service role — set a demo client's email to a real inbox, use *Resend Portal Invitation* on the Clients page, complete signup in the browser, then point a test invoice at that client. Same reason Week 0 existed: no more out-of-band state.

**Entry points:** `src/pages/Clients.tsx:222,454` (Resend Portal Invitation), `src/components/clients/ClientFormDialog.tsx:134` (auto-invite on create when the client has an email), `src/App.tsx:283` (`/portal/signup`).

**Done when:** a demo client has a live `clients.user_id`, that account can sign in at `/portal`, a test invoice belongs to it, and the credentials are in the founder's password manager alongside the demo staff logins.

---

## PR-DB-2 — schema drift detection

**Opened:** Week 0 RECON (PR #72), timeboxed follow-up owed.

FieldTek has **no working drift detection**: `supabase db diff --linked` reports false-clean on CLI v2.90.0 and fails with `LegacyDeclarativeShadowDbError` on v2.109.1. The db-replay canary compensates for exactly three objects and is not a general check. Until this is solved, out-of-band schema changes are invisible. See [week0-drift-report.md](week0-drift-report.md).

**Done when:** a repeatable command (CI-wired or documented) reliably reports repo-vs-fgem schema divergence, or the gap is closed some other way and the report is updated to say so.

---

## Evidence deletion lifecycle

**Opened:** PR-SEC-6 recommendation; reaffirmed by Week 0 C5.

`workflow_step_evidence` now carries an explicit deny-all DELETE policy — deliberate immutability, not an oversight. A real lifecycle (retention windows, an appeal/correction path, who may act and with what audit trail) is a product decision deferred to the form-engine work. Adding an admin-scoped DELETE before that design exists would create an evidence-tampering capability that does not exist today.

---

## Form-engine opener — `field-assistant` dead-path removal

**Opened:** founder struck A1b from Week 0 (2026-07-22).

`field-assistant` still carries the dormant execution-context path (`fetchWorkflowExecutionContext` and its consumers) for tables that do not exist in production. It was left in place to avoid a live-AI deploy during Week 0. **It must be the first commit of the form-engine work** — removal means deploying `field-assistant` and re-running the 12/12 live eval gate.
