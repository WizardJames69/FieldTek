# Week 0 Summary — Stream Retirement · Ledger Hygiene · Security Batch · Crons

**Executed:** 2026-07-21 → 2026-07-24 · **Base at start:** `main` @ `b0888a4` · **Backend:** fgem (`fgemfxhwushaiiguqxfe`) only.

Week 0 of the 90-day plan, executed against the five founder decisions of 2026-07-21. Four PR series landed in order: `chore(stream-retire)` → `chore(db-hygiene)` (+ a reconciliation follow-on) → `fix(security)` → `feat(cron)`. Full plan with Step 0 verification evidence: `.claude/plans/you-are-performing-a-refactored-barto.md`. Drift findings: [week0-drift-report.md](week0-drift-report.md).

---

## What shipped

### Workstream A — `chore(stream-retire)` (PR #70, merged)

The dormant workflow-template stream is retired from the codebase and parked for a possible post-form-engine return as "guided procedures" (founder decision 1).

- Deleted the 10 flag-gated UI/hook files (`src/components/settings/workflows/`, `src/components/jobs/workflows/`, `useWorkflowTemplates`, `useWorkflowExecution`) and collapsed the three mount points (`Settings.tsx`, `JobDetailSheet.tsx`, `MyJobs.tsx`) to the active checklist path. Zero `isEnabled('workflow_templates')` references remain.
- `supabase/migrations-deferred/` → `supabase/migrations-parked/guided-procedures/` with a rewritten README (parked status, revival conditions, the partial out-of-band state of `20260513…`, file-level repair prohibition).
- `verify-step-evidence` lost the `step_execution_id` branch — the unscoped dormant-table reads that were PR-SEC-6 **Gap 3, now resolved by deletion**. Deployed **v16** to fgem and prod-verified.
- `collect-workflow-intelligence` survives deliberately (live telemetry on job completion; header comment documents why). Comment-only — stays v4.

### Workstream B — `chore(db-hygiene)` (PR #71, merged)

- **Drift audit ran and is NOT clean** — see [week0-drift-report.md](week0-drift-report.md). `supabase db diff --linked` returned a false "No schema changes found" while founder catalog queries proved three live out-of-band objects. PR-DB-2 stays **open** with a timeboxed post-Week-0 follow-up; FieldTek currently has **no working schema drift detection** (v2.90 false-clean; v2.109.1 fails outright).
- `types.ts` regenerated from fgem via a new `npm run gen:types` script (the missing script was the root cause of types drift). Dormant workflow tables, `pending_invitations`, `tenants_public`, `step_execution_id`, `workflow_execution_id` all gone; `equipment_components`, `stripe_webhook_events`, `tier_limits` appeared. Zero typecheck fallout.
- Dead artifacts dropped (migration `20260722100000`): `pending_invitations` table, `tenants_public` view. Deprecation `COMMENT ON COLUMN` markers for `profiles.certifications` / `.skills` / `.notification_preferences` (kept per founder — weeks 9–12 feature).
- Repo functions `send-welcome-email` and `send-usage-alert` deleted. **Both were the "deleted" case**: each was deployed on fgem and was platform-deleted by the founder (`supabase functions delete …`) — neither was a repo-only phantom. Function count 54 → 52.

### Reconciliation follow-on (PR #72, merged, applied to fgem)

Migration `20260723050000_reconcile_intelligence_flywheel_ledger.sql` promotes the three proven-live out-of-band objects into the applied ledger (idempotent; founder pre-verified live definitions token-for-token via `pg_get_functiondef` / `pg_get_triggerdef` — the only delta was two comment lines, restored by the push):

- function `notify_collect_workflow_intelligence()` (+ EXECUTE revokes)
- trigger `trg_collect_workflow_intelligence` on `scheduled_jobs`
- `workflow_diagnostic_statistics.tenant_id` nullable + the platform-stats SELECT policy

Without this, a replay-from-zero rebuild would have silently killed the workflow-discovery telemetry. The db-replay CI workflow now carries a three-object canary assertion (honestly scoped: it pins these three objects, it is not general drift detection). Canary passed its first run.

### Workstream C — `fix(security)` (PR #73, merged; all five live on fgem)

Founder decision 4, approved in full. One policy-only migration per fix:

| # | Migration | Fix |
|---|---|---|
| C1 | `20260723100000` | `notifications` INSERT now requires `user_id = auth.uid()` (was: any tenant member could create rows for arbitrary users) |
| C2 | `20260723200000` | `invoice_line_items` SELECT tightened to staff (admin/dispatcher) + a portal-client arm, mirroring the parent `invoices` policy |
| C3 | `20260723300000` | `branding` bucket writes scoped to the caller's own tenant folder (was: any tenant admin could overwrite any tenant's logo) |
| C4 | `20260723400000` | dropped the orphaned unscoped `part-receipts` DELETE policy (wrong-name `IF EXISTS` no-op had left any authenticated user able to delete any receipt) |
| C5 | `20260723500000` | explicit deny-all DELETE on `workflow_step_evidence` — documents the deliberate immutability (founder call: no admin DELETE; that would *create* a tampering capability) |

#### Verification of record — direct authorization probes

Founder call (2026-07-24): the direct probes are the verification of record for C, ahead of any UI smoke. Re-run against fgem on 2026-07-24 via `scripts/probes/week0-c-rls-probe.mjs` — disposable per-run fixtures (two tenants, an admin + a technician + a foreign owner, a client, an invoice with two line items, a seeded receipt object), full teardown. **8/8 passed, zero residue** (`tenants=0 users=0 branding=0`). Every denial is paired with a positive control, so no pass can be a false negative from a broken fixture.

| Probe | Result |
|---|---|
| C1 — technician inserts a `notifications` row for **another** user | denied · `42501 new row violates row-level security policy for table "notifications"` |
| C1 control — same technician inserts a row for themself | allowed |
| C2 — technician selects `invoice_line_items` for a tenant invoice | **0 rows** |
| C2 control — tenant admin selects the same line items | 2 rows |
| C3 — tenant admin uploads to **another** tenant's `branding/<tenant-id>/` folder | denied · `new row violates row-level security policy`; object never landed |
| C3 control — same admin uploads to their own tenant folder | allowed |
| C4 — technician deletes a `part-receipts` object | denied · object still present |
| C4 control — tenant admin deletes the same object | removed |

C5 is deliberately absent from the probe set. It documents an immutability that already held (no DELETE policy existed, so RLS default-denied), so a behavioural probe returns "nothing deleted" both before and after the migration and proves nothing. Its guarantee rests on the migration plus the db-replay gate, not on a runtime probe.

The full e2e suite also ran green against main after the push.

#### Manual UI smoke — portal step ruled not-applicable (founder, 2026-07-24)

`PortalInvoices.tsx` reads the `invoices` table only; it never queries `invoice_line_items`. C2 therefore cannot have broken the customer portal. There is no portal-linked client on any tenant today, and creating a prod auth user to exercise a path the change provably did not touch would be fabricated coverage, not verification. Skipped deliberately — **nothing was provisioned for C**.

The remaining UI steps stay with the founder as optional confirmation, not as the verification of record: create a job and create + send an invoice as `demo-owner@fieldtek-demo.dev`; complete a checklist item with photo evidence as `demo-tech-1@fieldtek-demo.dev` — that step doubling as proof the Workstream A surgery left the technician evidence path intact.

#### ⚠ Known unverified — C2's portal SELECT arm

`"Portal clients can view their own invoice items"` has **no reader in the application today**. Line items reach the portal only through `generate-invoice-pdf`, which runs as the service role and bypasses RLS entirely. The arm is forward-compatible construction — correct by inspection, unexercised at runtime, and not covered by the probe set above. Its first real exercise should come with the portal work in PR-APP-7; a permanent demo portal account (created through the app's own invitation flow, not service-role provisioning) is tracked in [backlog.md](backlog.md).

### Workstream D — `feat(cron)` (this PR)

Founder decisions 2 + 3.

**D1 — recurring jobs, gated and wired.** The 0.3 gate query (see below) returned **0 active templates**, so wiring proceeded:

- `generate-recurring-jobs` gained an `isServiceRoleBearer` gate ahead of any work. Before it, any authenticated user's JWT passed the gateway default `verify_jwt` and could trigger the all-tenant sweep — the PR-SEC-6 future-hardening item, now **closed** (doc updated; trust contract pinned in `authz.test.ts`).
- Migration `20260724100000`: vault-secret wrapper `invoke_generate_recurring_jobs()` (service-role bearer, EXECUTE revoked from PUBLIC/authenticated/anon) + `cron.schedule('generate-recurring-jobs-daily', '0 6 * * *')`.
- Timezone honesty: the function does plain UTC date math and does not read tenant timezones; a single daily UTC run is correct because `advance_days` (default 7) gives multi-day lead time. Recorded as a limitation, not built around.

**D2 — invoice reminder sweep, per-tenant opt-in, default OFF.**

- Migration `20260724200000`: `tenant_settings.invoice_reminders_enabled BOOLEAN NOT NULL DEFAULT false`.
- `send-invoice-reminder`: in sweep mode (no specific `invoice_id`) the function resolves each invoice's tenant opt-in and **skips non-opted-in tenants at the top of the loop** — before the client-email lookup, the Resend call, and the sent→overdue status flip. A missing settings row or null flag is OFF (fail-safe); a settings-fetch error fails CLOSED (sweep sends nothing). Manual per-invoice reminders — an explicit human action — bypass the flag. Mode × flag matrix pinned in `sweepPolicy.test.ts` (Deno).
- Settings → Notifications gained an "Invoice Reminders" card (Switch, owner/admin route) whose copy states plainly that it emails the tenant's customers daily and is off by default.
- Migration `20260724300000`: `invoke_invoice_reminder_sweep()` wrapper + `cron.schedule('invoice-reminder-sweep-daily', '0 14 * * *')`.
- **No tenant's customers get automated emails until that tenant opts in** — the founder rule, enforced in code, schema default, and tests.

**Deploy order honored deliberately:** both functions were deployed BEFORE the cron migrations were pushed. Had the reminder cron existed first, a 14:00 UTC firing would have hit the old skip-less function and emailed every tenant's overdue customers; function-first means the brief missing-column window merely failed the sweep closed.

**D3 — untouched, confirmed:** no invoice aging/terms/tax changes anywhere.

**Prod verification (zero residue):**
- anon-key bearer → `generate-recurring-jobs` **401** (gate live)
- service role → `generate-recurring-jobs` **200** `{"message":"No active templates","generated":0}` (matches the 0.3 result; zero writes)
- service-role sweep scoped to the demo tenant (flag off by default) → **200**, `sent: 0`, one real overdue invoice returned as `status: "skipped"`, `"Reminders disabled for tenant"` — the opt-in gate fired on live data with zero side effects (the sent→overdue flip did not run).

**Testing (founder call on D2):** flag-ON send path asserted at Deno level (`sweepPolicy.test.ts`), NOT e2e — a real-send e2e would email live addresses every CI run. E2E covers the toggle (off by default, persists across reload) and the flag-OFF sweep skip, using a seeded no-email client so even a broken gate could never send a real message.

---

## The 0.3 gate query and its result (founder decision 2)

Run by the founder against prod before D1 was wired:

```sql
select
  t.name as tenant_name,
  r.tenant_id,
  count(*) as active_templates,
  min(r.next_occurrence) as earliest_next_occurrence
from public.recurring_job_templates r
join public.tenants t on t.id = r.tenant_id
where r.is_active = true
group by r.tenant_id, t.name
order by active_templates desc;
```

**Result: `active_recurring_templates = 0`** — no live tenant has recurring templates, so wiring the cron changes nothing for any existing tenant. D1 cleared. (The service-role prod probe after wiring independently confirmed: `generated: 0`.)

---

## Deviations from the Week 0 prompt, and why

1. **A1b struck (founder call):** the `field-assistant` dead execution-context path (`fetchWorkflowExecutionContext` et al.) was NOT removed. It is parked as the **first commit of the form-engine work**. This is a documented DoD exception alongside `collect-workflow-intelligence` — the two sanctioned dormant-stream references outside the parked folder.
2. **`documents.is_public` kept (audit correction):** the prompt listed it as dead; Step 0 proved two live RLS policies (documents SELECT + storage ACL) and the e2e/demo seeds depend on it. Dropping it would have broken document visibility.
3. **C5 is an explicit deny, not "scope it properly":** no DELETE policy existed, so deletes were already default-denied. Adding an admin-scoped DELETE would have *created* an evidence-tampering capability that doesn't exist today — a product decision, not a hygiene fix. Founder approved the deny-all form. Real evidence lifecycle (retention/appeal) is deferred to the form-engine work (tracked as the PR-SEC-6 follow-up recommendation).
4. **A5 had nothing to prune:** all 14 tests in `workflow-verification.spec.ts` exercise the ACTIVE `job_stage_templates` path. No assertion was touched.
5. **Mailer deletions were real platform deletions:** both `send-welcome-email` and `send-usage-alert` were deployed on fgem; the founder deleted both (the "deleted" case, not "not found" — recorded per instruction).
6. **Drift tooling standing gap:** `db diff` cannot currently be trusted (false-clean on v2.90.0; `LegacyDeclarativeShadowDbError` on v2.109.1). PR-DB-2 remains **open** with a timeboxed post-Week-0 follow-up. The db-replay canary compensates for exactly three objects, no more.
7. **Timezone support in D1:** the prompt's "timezone-aware per tenant settings where the function supports it" — it does not support it (plain UTC math). Single daily UTC run, correct because of `advance_days` lead time.
8. **D2 flag-ON testing at Deno level, not e2e** (founder call 3): asserting a real send in e2e would email live addresses on every CI run.
9. **C's manual-smoke portal step dropped, probes promoted (founder call, 2026-07-24):** the prompt's smoke pass ended at "view it in the portal". `PortalInvoices.tsx` never reads `invoice_line_items`, so that step could only have been satisfied by minting a prod portal user to exercise an untouched path — fabricated coverage. The direct probes became the verification of record instead, and the unexercised portal arm was flagged rather than papered over. The demo portal account is now a tracked backlog item on its own merits, to be created through the app's invitation flow.

## Decision 5 sweep (permanent product rules)

Step 0 greps found **no schema or UI** that stores employee medical information (including allergies) or device passcodes in any form. Nothing to flag; the rules stand as guardrails for future work.

## Prod-data safety

Nothing destructive to prod data was executed all week. The only schema drops were the two Step-0-verified-dead objects (`pending_invitations`, `tenants_public`). All other migrations were additive or policy-only. All verification probes were disposable and cleaned (zero residue).

## Definition of done

- [x] Four PR series merged in order (#70, #71 + #72, #73, feat(cron) — this PR)
- [x] Playwright suite green after every workstream; no assertion weakened
- [x] Zero dormant-stream references outside the parked folder, except the two documented exceptions (`collect-workflow-intelligence` — deliberate survivor; `field-assistant` dead path — struck A1b, parked for form-engine)
- [x] `types.ts` regenerated from live fgem, `gen:types` script added
- [x] `docs/week0-drift-report.md` (not clean — standing tooling gap recorded, PR-DB-2 open)
- [x] `docs/week0-summary.md` (this file)
- [x] Nothing destructive to prod data
- [x] Workstream C verified — 8/8 direct authorization probes against fgem, each denial with a positive control, zero residue (the portal leg of the original manual-smoke item ruled not-applicable; C2's portal SELECT arm flagged known-unverified)
- [ ] *Optional, non-gating:* founder UI confirmation pass (job + invoice as `demo-owner`, checklist photo as `demo-tech-1`)
