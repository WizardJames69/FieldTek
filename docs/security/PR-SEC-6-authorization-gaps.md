# PR-SEC-6 — Authorization gap closure

Follow-up to the PR-TEST-3 authorization audit, which swept all edge functions and
stopped after finding three object-level authorization gaps. PR-SEC-6 fixes the two
**active** gaps; the third is **latent** and deferred to the workflow-template stream
activation. Repository-only change — no deploy, no migration.

## ACTIVE — FIXED

### Gap 1 — field-assistant conversation ownership (cross-tenant blind write)
- **Root cause:** `trackConversation` (`supabase/functions/field-assistant/audit.ts`) wrote the
  user + assistant `messages` rows via the service-role client (RLS bypassed) keyed only by a
  **caller-supplied** `conversationId`. The authenticated tenant/user were used only when *creating*
  a conversation, never when a supplied id was reused. `conversations.tenant_id`/`user_id` are
  `NOT NULL`, so any authenticated user could blind-write message content into another tenant's /
  user's thread.
- **Fix:** new `field-assistant/conversationOwnership.ts` (`verifyConversationOwnership`, side-effect-free,
  fail-closed) filters `conversations` by id **AND** tenant_id **AND** user_id — the tenant/user being
  the already-authenticated server-side values, never body fields. `trackConversation` calls it before
  reusing a supplied id; on any failure (malformed / missing / foreign tenant / foreign user / lookup
  error) it discards the id and falls through to the existing create-new branch — a fresh caller-owned
  conversation. Nothing is copied from the rejected id, and no message is ever written to it. Because the
  tracking runs after the SSE response has already streamed, no status can be returned to the caller;
  the fallback is silent and leaks nothing.
- **Tests:** `field-assistant/conversationOwnership.test.ts` — helper matrix (own → true; foreign
  tenant/user, missing → false; malformed → false without querying; query error/throws → fail closed;
  foreign ≡ missing) + `trackConversation` recording-stub proofs (owned id reused; foreign / malformed /
  errored id → no insert targets the supplied id, a fresh authenticated-user-owned conversation is
  created, both message rows target only the resolved safe id).

### Gap 2 — send-beta-approval authentication (unauthenticated service-role write + email relay)
- **Root cause:** `send-beta-approval` had `verify_jwt = false` **and** no in-function auth. A
  caller-supplied `applicationId` reached a service-role `beta_applications` update, and caller-supplied
  `email`/`promoCode` drove a branded "Welcome to FieldTek Beta" email — i.e. an unauthenticated
  branded-email/phishing relay to any address plus unauth stamping of any application row.
- **Caller analysis:** exactly one caller repo-wide — the platform-admin **Approve** / **Resend Email**
  actions in `src/pages/admin/AdminBetaApplications.tsx`, behind the `/admin/beta-applications`
  platform-admin route, invoking via `supabase.functions.invoke` (auto-attaches the admin's JWT). No
  edge-function caller, no DB trigger, no script. `beta_applications` RLS is `FOR ALL USING
  (is_platform_admin())`. → intended model = **platform-admin authorization** (cross-tenant by design;
  no per-tenant check).
- **Fix:** new `send-beta-approval/authz.ts` holds the pure `decideBetaApprovalAccess`, a fail-closed
  `lookupPlatformAdmin`, and `handleBetaApproval(req, deps)` which enforces the order OPTIONS → verify
  JWT (`getUserId`) → `platform_admins` lookup (only for an authenticated user) → **generic 401/403
  before the body is parsed** → email + `beta_applications` write only on allow. `index.ts` is thin
  wiring of the real service-role-backed deps. `supabase/config.toml`'s `verify_jwt = false` override was
  removed so the gateway also rejects unauthenticated calls (both layers). No frontend change needed
  (`supabase.functions.invoke` already sends the admin session). Edge functions can't use the
  `is_platform_admin()` RPC (service-role client → `auth.uid()` null), so the `platform_admins` table
  lookup is used — same as `promote-lesson` / `send-campaign`.
- **Tests:** `send-beta-approval/authz.test.ts` — decision matrix; `lookupPlatformAdmin` fail-closed
  (no row / query error / throws → false); handler auth-order + no-side-effect-on-deny (missing/malformed
  header → 401 with no lookup; invalid token → 401 with membership lookup skipped; ordinary user &
  tenant-admin → 403; a denied caller with a full valid body incl. `applicationId` → still no email and
  no write; platform admin → email sent + result recorded → 200).

## DEFERRED — NOT FIXED HERE

### Gap 3 — verify-step-evidence `step_execution_id` lookup — ✅ RESOLVED 2026-07-21 (Week 0, by deletion)
Caller-supplied `step_execution_id` reached unscoped service-role reads of `workflow_step_executions` /
`workflow_template_steps` (`supabase/functions/verify-step-evidence/index.ts`), and derived thresholds
flowed back to the caller. **Deliberately not fixed in PR-SEC-6** because it was doubly-latent:
- both target tables belong to the **parked workflow-template stream** and are **absent from the
  production schema** (`supabase/migrations-parked/guided-procedures/` — the branch no-oped on the live schema); and
- it sat behind the `workflow_step_verification` feature flag's template path, never reachable from the UI.

**Resolution (Week 0 stream retirement):** the entire `step_execution_id` branch was deleted from
`verify-step-evidence` — the request no longer accepts the field and the unscoped reads no longer exist.
If the parked stream is ever revived as "guided procedures," the reintroduced lookup MUST be scoped to
the caller's job/tenant (recorded in `supabase/migrations-parked/guided-procedures/README.md`).

## Follow-up

**PR-TEST-3 delivered the permanent regression gates** for both fixes above:
- The ~340-test edge-function Deno suite (including `conversationOwnership.test.ts` for Gap 1 and
  `send-beta-approval/authz.test.ts` for Gap 2) now runs in CI via `.github/workflows/edge-tests.yml`
  (`npm run test:edge-authz`), where it previously ran nowhere.
- An HTTP-level authorization spec (`e2e/specs/authorization.spec.ts`) exercises Gap 1 conversation
  ownership and the Gap 2 platform-admin gate end-to-end against the deployed functions, alongside
  B1–B4. See `docs/testing/edge-authorization-tests.md`.

Gap 3 remains deferred (workflow-template stream inactive; see above). The `future-hardening`
observations from the audit (`analyze-service-request` 404/403 enumeration split,
`create-invoice-payment` public pay-link, `generate-recurring-jobs` in-code gate,
`verify-turnstile-portal` clientId ownership, and the reveal-pattern injection observation now tracked
in PR-SEC-7) remain tracked, not fixed in PR-SEC-6.
