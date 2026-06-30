# Pilot Onboarding Runbook (Fresh-Tenant)

Single source of truth for standing up and smoke-testing a **fresh pilot tenant**
end-to-end, without leaning on the E2E/eval test fixtures. This document links to
the existing docs rather than duplicating them:

- [pilot-admin-setup.md](./pilot-admin-setup.md) — the 8-step onboarding wizard walkthrough + pre-pilot gate.
- [pilot-troubleshooting.md](./pilot-troubleshooting.md) — symptom → fix → escalation.
- [RUNBOOK.md](./RUNBOOK.md) — backend ops, deploy sequence, migrations, cron, secrets, rollback.
- [offline-field-drill.md](./offline-field-drill.md) — manual on-device offline drill for technicians.
- [technician-getting-started.md](./technician-getting-started.md) — non-technical field guide.
- [role-capabilities.md](./role-capabilities.md) — what each role can access.
- [../evals/README.md](../evals/README.md) — eval harness + the gated provisioner pattern.

> **Scope & guardrails.** This runbook validates the **real `/onboarding` UI path**
> (dogfooding the customer flow). The companion preflight `npm run verify:pilot`
> ([scripts/verify-pilot-readiness.ts](../scripts/verify-pilot-readiness.ts)) is
> **read-only** — it never creates or mutates a tenant. Creating the actual pilot
> tenant is a deliberate, separate human action through the UI; this runbook does
> not automate it.

---

## 0. Before you start — identity hygiene

- Use a **distinct** company name and **real** emails for the pilot. Never reuse
  the test fixtures `E2E Test Company`, `Sentinel Eval Company`, or any
  `*@fieldtek-test.dev` address — E2E global-teardown deletes those.
- **Do not run a pilot smoke pass while a CI E2E run is active on `fgem`**
  (`fgemfxhwushaiiguqxfe`). The E2E suite shares fixed fixtures and its teardown
  can delete tenants/users mid-run. Confirm no E2E run is queued/active first.
- Canonical backend is `fgemfxhwushaiiguqxfe`. There is no staging/prod split.

---

## 1. Pre-flight checklist (environment)

Run the read-only preflight first:

```bash
npm run verify:pilot            # health-check only (no tenant yet)
```

Expect `health-check: healthy` and `RESULT: READY`. Then confirm the rest by hand
(see [RUNBOOK.md](./RUNBOOK.md) for detail):

- [ ] CI `quality` green on `main`; Vercel production deploy commit == `main` HEAD.
- [ ] `health-check` returns 200 / `healthy`; `/admin/system-health` shows no
      unresolved **critical** `system_alerts`.
- [ ] Edge-function secrets present on `fgem`: `OPENAI_API_KEY`, `RESEND_API_KEY`,
      `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`.
      (These are **not** readable from outside the edge runtime — the preflight
      proves them only *observably*, via document embedding completion. See §6.)
- [ ] `documents` storage bucket exists with tenant-scoped RLS.
- [ ] pgvector extension enabled (document_chunks uses `vector(1536)`).
- [ ] pg_cron jobs live (health monitor, ingestion retry) — see RUNBOOK cron table.
- [ ] Vercel `VITE_*` envs set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
      `VITE_CF_TURNSTILE_SITE_KEY`, and `VITE_VAPID_PUBLIC_KEY` if push is used).

---

## 2. Platform-admin bootstrap (manual, one-time per environment)

Becoming a **platform admin** (to view `/admin/ai-audit`, `/admin/system-health`,
`/admin/tenants`) is **not** self-serve. It requires a direct insert. `checkIsPlatformAdmin()`
uses the `is_platform_admin()` RPC, which reads the `platform_admins` table; that
table has `email NOT NULL`, so **both** `user_id` and `email` are required.

1. The future admin signs up normally (so an `auth.users` row exists), then get
   their `user_id`:

   ```sql
   select id, email from auth.users where email = 'admin@yourco.com';
   ```

2. Insert (idempotent on the unique `user_id`):

   ```sql
   insert into public.platform_admins (user_id, email)
   values ('<uuid-from-step-1>', 'admin@yourco.com')
   on conflict (user_id) do update set email = excluded.email;
   ```

3. Verify: sign in at `/admin/login`; the `is_platform_admin()` check should route
   to `/admin` instead of "Access denied".

> Typos here are silent (wrong `user_id` → access denied with no clue). Copy the
> `user_id` from step 1, do not hand-type it.

---

## 3. Pilot feature-flag posture

A fresh tenant's UUID is on no allowlist, so percentage-rollout flags resolve by
consistent hashing — most premium AI flags land **OFF**. That is expected. Base
RAG chat does not depend on any of these.

| Flag | Posture for a fresh pilot | Action |
|---|---|---|
| `workflow_state_tracking` | **ON** (100% rollout) | none — expected on |
| `rag_judge` | **OFF** — held eval-only at Decision A | **do not enable** |
| `judge_blocking_mode` | **OFF** — held eval-only at Decision A | **do not enable** |
| `judge_full_blocking` | **OFF** globally at Decision A | **do not enable** |
| `lesson_citations` | **OFF** — eval + internal pilot allowlist only | **do not widen** |
| `compliance_engine` | OFF (low rollout) | allowlist only if the engagement needs it |
| `equipment_graph` | OFF | allowlist only if diagnostics need the graph |
| `diagnostic_learning` | OFF | allowlist only if the learning loop is in scope |
| `rag_reranking` | OFF | optional retrieval-quality flag |

`npm run verify:pilot -- --tenant-id <uuid>` prints the **effective** posture for
the pilot tenant next to these expectations and flags any drift.

**To allowlist a flag for the pilot** (only the non-Decision-A rows above):

```sql
update public.feature_flags
set allowed_tenant_ids = array_append(coalesce(allowed_tenant_ids, '{}'), '<pilot_tenant_uuid>')
where key = '<flag_key>';
```

Then re-run `verify:pilot --tenant-id` to confirm. **Never** add a pilot tenant to
the Decision-A judge flags.

---

## 4. Manual fresh-tenant smoke checklist

Run as a real human through the UI. Each step maps to a real route/table.

1. **Preflight** — `npm run verify:pilot` → health green; deploy commit == `main`.
2. **Register** — `/register`: enter access code, sign up the owner email, verify email.
3. **Onboard** — `/onboarding` (company → industry → branding → launch); land on
   `/dashboard` with no redirect loop and no `WorkspaceLoadError`.
4. **Verify seed** — `npm run verify:pilot -- --tenant-id <new-uuid>`: tier `trial`,
   trial date ~14d out, `tenant_ai_policies` absent (permissive) or present+enabled.
5. **Customer** — create 1 client (`/clients` or via the job form); it appears in
   the job-form client dropdown.
6. **Job** — `/jobs` → create 1 job (title + priority); lists with `status='pending'`.
7. **Equipment** — `/equipment` → add 1 record (type from the industry preset); saves.
8. **Document → RAG** — `/documents` → upload one small PDF manual; watch
   `extraction_status` → `embedding_status` reach `completed`. Re-run
   `verify:pilot --tenant-id` → `embeddedChunks > 0`. **If it stalls, env gating
   (§6) is the first suspect.**
9. **AI assistant** — `/assistant` → ask one grounded question; expect a real
   answer (no 403 "AI disabled", no rate-limit), citations once the doc is indexed.
10. **Audit** — as platform admin, `/admin/ai-audit`: the query landed as a row for
    the pilot tenant with `response_blocked=false`. Under Decision A the judge is OFF
    for this tenant, so the row shows `unjudged_no_verdict` — **correct, not a defect**.
11. **Invite a teammate** — `/team` → invite a technician; accept via the emailed
    link in a separate session; the technician lands on `/my-jobs` and is
    `RoleGuard`-gated out of `/team`.
12. **Offline (optional)** — run [offline-field-drill.md](./offline-field-drill.md)
    on a real device for the technician.

---

## 5. Empty-tenant UX notes (expected, not bugs)

- **0 clients** → the job form shows an empty client dropdown. Jobs are still
  creatable with a null `client_id`; it just reads as "broken" to a first-time user.
  Create ≥1 client before the first job.
- **0 documents / nothing indexed** → the assistant shows an "indexing incomplete"
  degraded banner and answers generically. Normal until a document finishes
  embedding; disappears once `embedding_status='completed'`.
- **No `tenant_ai_policies` row** → AI is **enabled** by default (absent row is
  permissive). A row is only needed to *restrict* a tenant.
- **Onboarding spinner** can sit ~30s with hidden retries (RLS propagation +
  per-step timeouts). Not a failure unless it surfaces `WorkspaceLoadError`.

---

## 6. What the preflight can and cannot verify

`verify:pilot` is read-only and **cannot read edge-function secrets** (e.g.
`OPENAI_API_KEY`). It does **not** claim to. Instead it reports the **observable
proxies** that prove the ingestion chain works end-to-end:

- `health-check` status (DB / Stripe / auth — **not** OpenAI).
- count of documents at `embedding_status='completed'` (`indexedDocuments`).
- count of `document_chunks` carrying an embedding (`embeddedChunks`).
- a clear **warning** when a tenant has no indexed document yet.

So: a tenant with `embeddedChunks > 0` is the signal that `OPENAI_API_KEY` +
pgvector + the storage bucket are all functioning for real. If documents stay
`pending`/`failed` and `embeddedChunks` stays 0, suspect the OpenAI key / bucket /
pgvector before anything else (see [pilot-troubleshooting.md](./pilot-troubleshooting.md)).

---

## 7. Go / no-go gate before inviting a real beta user

All must hold:

- [ ] `npm run verify:pilot -- --tenant-id <uuid>` exits 0 (hard checks pass).
- [ ] CI `quality` green on `main`; Vercel deploy commit == `main` HEAD.
- [ ] Full §4 smoke passed — **including** a document that reached
      `embedding_status='completed'` and an AI answer with citations.
- [ ] Flag posture confirmed: base RAG on; judge flags OFF (Decision A); any
      pilot-needed flag explicitly allowlisted and re-verified.
- [ ] Invite → accept → role-gated login proven for the technician.
- [ ] Distinct pilot identity; no E2E run active on `fgem` during the pass.
- [ ] §8 rollback steps understood.

---

## 8. Rollback / teardown for a failed pilot tenant

If a pilot tenant must be torn down (failed onboarding, wrong data), delete in
**FK-safe order** with the service role. Most tenant-scoped tables cascade on
`tenant_id`, but delete children first where unsure:

```sql
-- child/leaf data first
delete from public.document_chunks where tenant_id = '<uuid>';
delete from public.documents       where tenant_id = '<uuid>';
delete from public.scheduled_jobs  where tenant_id = '<uuid>';
delete from public.equipment_registry where tenant_id = '<uuid>';
delete from public.clients         where tenant_id = '<uuid>';
delete from public.ai_audit_logs   where tenant_id = '<uuid>';
delete from public.team_invitations where tenant_id = '<uuid>';
delete from public.tenant_ai_policies where tenant_id = '<uuid>';
delete from public.tenant_branding where tenant_id = '<uuid>';
delete from public.tenant_settings where tenant_id = '<uuid>';
delete from public.tenant_users    where tenant_id = '<uuid>';
-- finally the tenant
delete from public.tenants where id = '<uuid>';
```

Then optionally remove the orphaned `auth.users` rows for the pilot's owner/tech
(Supabase dashboard → Authentication, or `auth.admin.deleteUser`). For app/code
rollback (deploys, migrations, flags), follow [RUNBOOK.md](./RUNBOOK.md). Verify
nothing remains: `npm run verify:pilot -- --tenant-id <uuid>` should now report
`tenant ... NOT FOUND` (a hard-fail, which is the expected post-teardown state).

> Confirm the UUID against the live row before running deletes (don't delete a
> tenant you didn't create). Storage objects under `documents/<tenant_id>/…` may
> need separate cleanup in the bucket.
