# Week 0 Drift Report — PR-DB-2 executed; NOT closeable as clean

**Date:** 2026-07-22/23 · **Project:** fgem (`fgemfxhwushaiiguqxfe`) · **Tooling:** supabase CLI v2.90.0 (migra-based `db diff --linked`); v2.109.1 re-run attempted · **Repo base:** Week 0 Workstream B branch

## Verdict up front

`supabase db diff --linked` reported **"No schema changes found." That answer is wrong.** Three objects verified live in production by read-only catalog query (2026-07-23) exist in **no applied migration**:

| Live object | Catalog evidence | Origin |
|---|---|---|
| function `public.notify_collect_workflow_intelligence()` | `pg_proc` row present | parked `20260513…` section A, applied out-of-band |
| trigger `trg_collect_workflow_intelligence` on `scheduled_jobs` | `pg_trigger` row present | same |
| `workflow_diagnostic_statistics.tenant_id` **nullable** (+ replacement SELECT policy admitting `tenant_id IS NULL` rows) | `information_schema.columns.is_nullable = 'YES'` | parked `20260513…` section C1, applied out-of-band |

The parked-stream README (`supabase/migrations-parked/guided-procedures/README.md`, PR-DB-3 finding) was **correct**; the diff tool was **not**. Consequences:

1. **`db diff --linked` is not a trustworthy sole source for trigger/function drift on this project.** It missed three distinct entity classes (trigger, function, column nullability/policy body) in one run while reporting clean. Any future drift audit must pair it with direct catalog queries for known out-of-band objects.
2. **PR-DB-2 is executed but NOT closeable as "clean."** The ledger↔live reconciliation claim below is scoped accordingly.

## Replay-from-zero divergence (the finding that matters)

Because those three objects exist only out-of-band, **every rebuild from migrations produces a schema that silently diverges from production**: the db-replay CI shadow, a `supabase db reset`, and any disaster-recovery rebuild all come up with **no flywheel trigger, no trigger function, and a NOT NULL `tenant_id`**. Nothing asserted their existence, so CI stayed green. Practical impact of a rebuild: `collect-workflow-intelligence` loses its only caller and **workflow-discovery telemetry dies silently** — no error, no alert, just an admin console that stops accumulating data.

**Remediation (founder-directed, 2026-07-23):** a reconciliation migration promotes the live section-A/C1 objects into the applied ledger — additive and idempotent (`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE`, `ALTER COLUMN … DROP NOT NULL`, policy drop/recreate) — shipped as the follow-up PR immediately after Workstream B, together with a **db-replay CI assertion** that the trigger, function, and nullable `tenant_id` exist in the replayed schema. The migration contains **only** what the catalog queries proved live (section A + C1); sections B/C2 stay parked. Push precondition (founder safety check): the live `pg_get_functiondef` / trigger / policy definitions are diffed against the parked text **before** pushing — a match proves the `CREATE OR REPLACE` is a genuine no-op; a mismatch means a second out-of-band change exists, and the push stops so the reconciliation can promote what is *actually* live rather than what the parked file claims.

Scope honesty: that CI assertion pins three named objects. It is a canary for this specific divergence, **not** general drift detection — see the standing-state section below.

## Standing state: FieldTek currently has NO working schema drift detection

Not a one-run anomaly — the standing state of the tooling as of 2026-07-23:

- **v2.90.0** (the pinned CLI, also used by db-replay CI) returns **false-clean**: it missed at least three entity classes (trigger, function, column nullability/policy body) in a single run, for unexplained reasons.
- **v2.109.1** (current) **cannot complete a diff at all** in this environment (`LegacyDeclarativeShadowDbError` while provisioning the shadow database).

Until one of these is fixed, no automated answer to "does live match the migrations?" exists for this project. The db-replay assertion added by the reconciliation PR is **not** a replacement: it pins the three specific objects named in this report and nothing else. **Whatever else may have drifted while v2.90 was returning clean verdicts remains unknown and undetected.** Direct catalog queries are the only currently-trustworthy instrument, and they only answer questions someone thinks to ask.

**PR-DB-2 therefore stays OPEN** with a tracked, timeboxed follow-up: restore working drift detection (fix or replace the diff engine — candidate approaches: newer CLI once the shadow-provisioning bug clears, raw `pg_dump --schema-only` textual comparison, or a scheduled catalog-inventory script) and re-run a full audit with it. Deliberately **not** Week 0 scope.

## Why did the diff miss them? (investigated, not fully determined)

- **v2.90.0 (migra engine):** returned clean. A trigger-coverage gap in migra would explain the trigger, but not the function or the column nullability — both squarely inside migra's documented coverage. The uniform miss across three entity classes suggests the live-side introspection skipped the objects wholesale; one plausible mechanism is role/ownership filtering (out-of-band objects were created via the dashboard SQL editor as a different role than migration-applied objects), but this could not be proven from the CLI's output.
- **v2.109.1 (current):** could not run in this environment at all — `LegacyDeclarativeShadowDbError: failed to provision the shadow database: exit 1` after pulling shadow images. So the newer engine could not be used to confirm or refute the v2.90 result.
- Net: **root cause unresolved; behavior documented; tool distrusted for this class.** The db-replay assertion above is the compensating control — it does not depend on any diff engine.

## What the diff run DID establish (still useful, now correctly scoped)

For the entity classes where a shadow-replay comparison is structurally reliable — i.e., **objects created by the migrations themselves** — the 148 active migrations replay cleanly and nothing in the migration set conflicts with live state (`db push` proposed exactly the expected pending migration and applied cleanly). Notable replay observations:

- `policy "Users can delete their uploaded receipts" … does not exist, skipping` — the C4 orphan mechanism reproducing in the shadow: the name-mismatched `DROP POLICY IF EXISTS` no-ops in replay exactly as it did in production. Both environments carry the same orphaned permissive DELETE policy on `part-receipts`, which is why it is invisible to a shadow diff. Real issue; fixed in Workstream C4.
- Other `does not exist, skipping` NOTICEs are guarded re-issue patterns from the PR-SEC/reissue migrations, by design.

## Surfaces outside any schema diff — reconciled separately

| Surface | Status |
|---|---|
| **Edge functions** | ✅ 54/54 repo↔deployed parity (2026-07-22; CLAUDE.md's stale "47" corrected). After Week 0 B3: 52/52 (`send-welcome-email`, `send-usage-alert` deleted from both sides). |
| **cron.job rows** | Data, not schema. Expected six from migrations (`monitor-health-check`, `cleanup-old-health-metrics`, `retry-stuck-documents`, `evaluate-rag-alerts`, `refresh-rag-quality-daily`, `log-pending-reembeds`); Workstream D adds two. |
| **storage.buckets rows / vault secrets** | Data; verified indirectly (health/alert pipeline alive ⇒ vault secrets present). |

## Verdict table

| Claim | Status |
|---|---|
| Active migrations replay cleanly from zero | ✅ (db-replay CI + this run) |
| `db push` safe without `--include-all` | ✅ (dry-run exact; hygiene migration applied cleanly) |
| Ledger fully represents live schema | ❌ **No — three out-of-band objects until the reconciliation migration lands** |
| `db diff --linked` trustworthy for drift | ❌ **No — demonstrated false-clean; pair with catalog queries** |
| types.ts ↔ live schema | ✅ after Workstream B2 regeneration (`npm run gen:types`) |

## Appendix: full v2.90 replay + diff log (2026-07-22)

```
(unchanged from the original run — 148 migrations applied to shadow, "No schema changes found")
Initialising login role...
Creating shadow database...
Applying migration 20251218033702_….sql … (full sequence through 20260716000000_pr_sec5_tenant_users_role_guard.sql)
NOTICE (00000): policy "Users can delete their uploaded receipts" for relation "storage.objects" does not exist, skipping
NOTICE (00000): policy "Users can accept their own invitations" for relation "public.pending_invitations" does not exist, skipping
NOTICE (00000): tenant_usage does not exist in this environment; skipping RLS enablement
… (guarded re-issue NOTICEs as described above)
Diffing schemas...
Finished supabase db diff on branch chore/week0-stream-retire.

No schema changes found
```

v2.109.1 re-run (2026-07-23): `error running container: exit 1` → `{"_tag":"Error","error":{"code":"LegacyDeclarativeShadowDbError","message":"failed to provision the shadow database: exit 1"}}`
