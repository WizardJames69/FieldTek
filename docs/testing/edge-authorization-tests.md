# Edge-function authorization tests

Two layers of regression coverage lock the object-level authorization boundaries
closed by PR-SEC-5 (B1–B4) and PR-SEC-6 (Gap 1, Gap 2). Added in PR-TEST-3.

## 1. Deno unit / authorization suite (CI-gated)

The `supabase/functions/` Deno tests (~340 across auth guards, evidence-row shaping,
tenant/service auth, conversation ownership, the send-beta-approval platform-admin
gate, …) now run in CI via `.github/workflows/edge-tests.yml`.

Run locally:

```bash
npm run test:edge-authz          # deno test --allow-env --allow-read supabase/functions/
# or a single dir:
deno test --allow-env --allow-read supabase/functions/send-beta-approval/
```

- Pure / stubbed — **no network at runtime, no Supabase project, no credentials.**
  Remote `std` imports are pinned by the committed `deno.lock` and cached by
  `denoland/setup-deno`.
- One test is currently `ignore`d: the stacked-modifier injection case, which
  documents a real detection gap fixed separately in **PR-SEC-7 (#66)**. Remove the
  `ignore` once PR-SEC-7 merges.

## 2. HTTP-level authorization spec (Playwright)

`e2e/specs/authorization.spec.ts` exercises the deployed functions end-to-end and
is wired into the `chromium-ai-pipeline` project in `playwright.config.ts`.

Run locally (requires `.env.test`):

```bash
npx playwright test e2e/specs/authorization.spec.ts
```

Cases: B1 `generate-invoice-pdf` (owner ok / technician + foreign + nonexistent +
malformed → identical generic 404 / no cross-tenant content), B2
`collect-workflow-intelligence` (service-role only; user & anon-key → 401), B3
tenant role escalation via PostgREST (admin→owner and self→owner denied, DB
unchanged; legitimate change allowed), B4 `verify-step-evidence` (job ownership,
generic `Job not found`, `step_execution_id` tolerated), Gap 1 field-assistant
conversation ownership (own reused; foreign → zero new messages + fresh
caller-owned conversation; malformed → safe new conversation), Gap 2
`send-beta-approval` (no/invalid/ordinary/tenant-admin denied with no email or
write; platform-admin reaches the handler).

### Required environment (`.env.test`)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Optional: `SEND_BETA_APPROVAL_SEAM_DEPLOYED=1` (see below).

### Credentials that must NEVER reach browser code

`SUPABASE_SERVICE_ROLE_KEY` is used **only** in node-context helpers
(`authz-fixtures.ts`, `authz-http.ts` via `getAdminClient()`) for out-of-band
seeding and inspection, and as the B2 "trusted internal caller" bearer. It must
never be passed to a Playwright `page`, `route`, screenshot, trace, or any
browser-visible surface. The spec authenticates users with the publishable/anon
key + a password grant (`signIn`), exactly like the frontend.

### Disposable fixtures + lifecycle

`e2e/helpers/authz-fixtures.ts` provisions everything under a unique per-run
`runId` (Tenant A owner/tech/admin, Tenant B owner/tech, a platform admin, an
ordinary no-tenant user, Tenant A/B clients + invoices + jobs, a foreign
conversation, a disposable beta application, and the Carrier corpus for Tenant A so
field-assistant answers grounded). Teardown deletes strictly by recorded id — one
`tenants` delete cascades every tenant-scoped table; `ai_audit_logs`, auth users,
and the beta application are removed explicitly — and returns any residue, which
the spec asserts is empty. Nothing depends on the shared global-setup fixtures.

### Concurrency

The whole Playwright suite runs against ONE shared live backend (fgem). `e2e.yml`
now serialises all e2e runs into a single `e2e-shared-backend` concurrency group
with `cancel-in-progress: false` (a run killed mid-teardown would strand residue).
The authorization spec additionally namespaces its own fixtures per run, so it is
safe even under that queue. Before running an fgem e2e locally, confirm no CI e2e
run is queued or in progress.

### Gap 2 allow-path (email seam)

The full platform-admin allow-path (email operation reached, only the disposable
application row stamped, **no real Resend delivery**) is gated behind a
deterministic email seam in `send-beta-approval` (`BETA_APPROVAL_EMAIL_SINK=1`,
fail-safe OFF in production). Because this PR does not deploy, the allow-path test
is **skipped** until the function is redeployed with the sink env set; set
`SEND_BETA_APPROVAL_SEAM_DEPLOYED=1` in the runner env to enable it then. Until
then the allow-path is covered by `send-beta-approval/authz.test.ts` (unit).

## Adding a new function authorization test

1. Add Deno unit tests next to the function (`supabase/functions/<fn>/*.test.ts`);
   they are picked up automatically by `npm run test:edge-authz`.
2. For HTTP-level coverage, add a `describe` to `authorization.spec.ts` using
   `invokeFunction()` + the disposable fixtures; assert status, generic-denial
   indistinguishability, and DB before/after snapshots (no side effect on denial).
3. Keep the service-role key in node-context helpers only.

## Deferred: Gap 3

`verify-step-evidence` `step_execution_id` scoping remains deferred — its target
tables belong to the inactive workflow-template stream and it sits behind the
disabled `workflow_step_verification` flag. It must be scoped to the caller's
job/tenant as part of that stream's activation, before the flag is ever enabled.
See `docs/security/PR-SEC-6-authorization-gaps.md`.
