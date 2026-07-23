# FieldTek Runbook

Last updated: 2026-06-15 (added pilot docs cross-links; corrected SW rollback note to prompt-mode).

### Pilot documentation (Workstream H)
For running a controlled 1-company pilot, see:
- [pilot-admin-setup.md](pilot-admin-setup.md) — tenant setup + pre-pilot readiness checklist + daily monitoring.
- [technician-getting-started.md](technician-getting-started.md) — non-technical field guide (install, offline, sync).
- [pilot-troubleshooting.md](pilot-troubleshooting.md) — support fixes + escalation + diagnostics to collect.
- [role-capabilities.md](role-capabilities.md) — what each role can access (route/nav enforcement).
- [offline-field-drill.md](offline-field-drill.md) — manual device offline-readiness drills.

---

## 1. Environments

There is a **single canonical FieldTek backend**. No staging/production split exists yet — do not use
that wording until a second Supabase environment is deliberately created and documented here.

| Supabase project ref | Status | Notes |
|---|---|---|
| `fgemfxhwushaiiguqxfe` | **Primary / canonical** | The one real FieldTek backend. CLI-linked (`supabase/.temp/project-ref`); all migrations, the 53 edge functions, and the E2E suite run here. All approved backend work targets it. |
| `dlrhobkrjfegtbdsqdsa` | **Legacy Lovable — do not use** | The original Lovable-provisioned project. **Not accessible from the current CLI account** (different Supabase account). Not managed, migrated, or deployed to from this repo. Archive; do not delete. |
| `dguurrghlassjshteupf` | Unrelated | "always-triple-check" stray project in the same org. Ignore. |

Frontend hosting: the app deploys through **Vercel** (no hosting config is committed in-repo; the
`VITE_*` env vars are injected by Vercel at build time). To confirm/maintain the backend target, in
**Vercel → Project Settings → Environment Variables**:
- `VITE_SUPABASE_URL` points to `https://fgemfxhwushaiiguqxfe.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (Supabase publishable/anon key) belongs to `fgemfxhwushaiiguqxfe`

> **Resolved (2026-06-12):** the cron/alert/retry callbacks are **not** hardcoded at runtime.
> `20260228500000_harden_alerting_pipeline.sql` rewired them to read the project URL from the Postgres
> **vault** secret `supabase_project_url` — `invoke_health_monitor()`, `notify_critical_alert()`, and
> `retry_stuck_documents()` all read it from vault, so the `dlrho` strings remaining in the three
> historical migrations (`20260228200000/400000/500000`) are inert history only. Verified in the `fgem`
> SQL Editor that `vault.decrypted_secrets.supabase_project_url = https://fgemfxhwushaiiguqxfe.supabase.co`
> and that `service_role_key` is present; live telemetry corroborates (fresh `system_health_metrics`, no
> `ingestion_retry_worker_skipped` alerts, `queued` `system_notifications`). **No corrective migration is
> needed.** Do **not** rewrite those historical migrations. (The only remaining ops check is out of band:
> confirm the `MONITOR_HEALTH_URL` GitHub Actions secret also points at `fgem` — see §9 / the health-monitor workflow.)

---

## 2. Deploy sequence

Order matters: database first, then functions, then frontend.

1. **Migrations** — see §4 for the safety rules. Never deploy function code that depends on a migration before that migration is applied.
2. **Edge functions** — `supabase functions deploy <function-name> --project-ref fgemfxhwushaiiguqxfe`. Deploy only the functions changed in the release; there is no bulk-deploy script (TODO: add one listing the 53 functions).
3. **Frontend** — deployed via **Vercel**, which runs `npm run build` with the `VITE_*` env vars from Project Settings → Environment Variables (`VITE_SUPABASE_URL` drives both the API client and the service-worker cache rule in `vite.config.ts`). Confirm those env vars target the primary backend (`fgemfxhwushaiiguqxfe`) before a release. TODO(hosting): document the exact Vercel deploy trigger (push-to-`main` vs manual promote).

After any deploy: watch `system_alerts` (Admin → System Health) and Sentry for 15 minutes.

## 3. Rollback principles

- **Migrations: forward-fix only.** Do not attempt to revert applied migrations on shared environments; write a new migration that undoes the damage. All recent migrations are written idempotently (DROP POLICY IF EXISTS / CREATE OR REPLACE / to_regclass guards) — keep that convention.
- **Edge functions:** redeploy the previous commit's function directory (`git checkout <prev-sha> -- supabase/functions/<fn> && supabase functions deploy <fn> --project-ref <ref>`, then restore the working tree).
- **Frontend:** rebuild/redeploy from the previous tag/commit on Vercel. The PWA uses `registerType: "prompt"` (not `autoUpdate`): a new (or rolled-back) bundle stays in "waiting" and clients pick it up when they accept the **"New version available"** prompt or reload while online; `cleanupOutdatedCaches` purges stale assets. There is no automated client kill-switch — see the pilot rollback notes in [pilot-admin-setup.md](pilot-admin-setup.md) and the recovery steps in [pilot-troubleshooting.md §10](pilot-troubleshooting.md).
- **Feature flags first:** for AI-pipeline misbehavior, prefer turning off the relevant flag (`rag_judge`, `rag_reranking`, `compliance_engine`, `equipment_graph`, `judge_blocking_mode`, `judge_full_blocking`, `diagnostic_learning`, Admin → Feature Flags) over redeploying.

## 4. Migration safety rules

> ⚠️ **The eight parked workflow-template migrations live in `supabase/migrations-parked/guided-procedures/`, NOT `supabase/migrations/`** (relocated in PR-DB-4, parked in Week 0 2026-07-21). They are a separate, retired work stream and must never participate in normal production replay:
> `20260425000000_workflow_templates.sql`, `20260425100000_workflow_templates_fk.sql`, `20260425200000_workflow_templates_feature_flag.sql`, `20260430000000_workflow_step_outcomes.sql`, `20260501000000_workflow_step_statistics.sql`, `20260509000000_add_is_tenant_admin_tenant_scoped_overload.sql`, `20260510000000_workflow_pattern_discovery.sql`, `20260513000000_intelligence_flywheel_and_schema.sql`. Full rationale, per-file inventory, and reactivation steps: [supabase/migrations-parked/guided-procedures/README.md](../supabase/migrations-parked/guided-procedures/README.md).

- **`supabase db push` is now safe by default.** The Supabase CLI only reads `supabase/migrations/`, so the deferred stream no longer makes history look out-of-order and the old "move the files aside before every push" workaround is gone. Still: `supabase migration list --linked` before and after every apply and commit the output to the PR description, and `supabase db push --dry-run` to confirm the proposed set before pushing.
- **Never use `supabase db push --include-all`**, and **never `supabase migration repair --status applied`** for any of the eight deferred versions. Seven were never applied to production; `20260513000000` is only *partially* applied out-of-band (its `notify_collect_workflow_intelligence()` function + `trg_collect_workflow_intelligence` trigger + `workflow_diagnostic_statistics` nullability/policy are live, but its deferred-table policies are not). Marking any of them applied would record a false history. (PR-DB-3 established this; the nine genuinely out-of-band migrations `20260615000000`–`20260706000000` were the only ones repaired-as-applied.)
- The original `20260511000000`/`20260512000000` files were superseded by `20260610100000`/`20260610200000` and deleted from the repo (they were never applied anywhere).
- **Follow-up owed to the workflow stream (only relevant if it is ever revived):** `upsert_workflow_step_statistic`, `fetch_clusterable_chains`, and `convert_suggestion_to_template` (created by `20260501000000`/`20260510000000`) lack `SET search_path = public`. When the stream is reactivated, ship a companion migration adding it (the fixes were deliberately excluded from `20260610100000` because the functions don't exist in deployed environments).
- `tenant_usage` (table) and `increment_job_usage()` (function) exist **only in remote environments** — they were created via dashboard, not migrations. `20260610100000` guards for this with `to_regclass`/`to_regprocedure`. Long-term TODO: capture their definitions into a migration so local/preview databases match remotes.

## 5. Cron inventory (pg_cron, from applied migrations)

| Job | Schedule | What it does | Defined in |
|---|---|---|---|
| `monitor-health-check` | `*/5 * * * *` | `invoke_health_monitor()` → `monitor-health` edge fn → writes `system_health_metrics`, raises/auto-resolves `system_alerts` | 20260228200000 / 20260228500000 |
| `cleanup-old-health-metrics` | `0 3 * * *` | prunes old health metrics | 20260228200000 |
| `retry-stuck-documents` | `*/5 * * * *` | `retry_stuck_documents()`: retries stuck embeddings + pending-stranded extraction (max 3), marks permanent failures, **alerts on failures/vault-miss** (20260610300000) | 20260301000000 / 20260520200000 / 20260610300000 |
| `refresh-rag-quality-daily` | `0 * * * *` (hourly, despite name) | refreshes RAG quality metrics | 20260305100000 |
| `evaluate-rag-alerts` | `*/5 * * * *` | `evaluate_rag_alerts()`: evaluates `rag_alert_rules`, writes `system_health_metrics` + bridges breaches into `system_alerts` (20260610400000); skips average metrics on idle/no-data windows (20260610600000) | 20260305200000 / 20260610400000 / 20260610600000 |
| `log-pending-reembeds` | `*/5 * * * *` | logs chunks pending re-embedding | 20260325000000 |

Additional schedule shipped with the **deferred** workflow stream (do not expect it yet): hourly intelligence refresh in `20260513000000`.

`expire-stale-trials` exists as an edge function but **no pg_cron schedule for it was found in migrations** — TODO: confirm how (or whether) it is triggered.

Out-of-band backstop: `.github/workflows/health-monitor.yml` pings the `monitor-health` function every 5 minutes from GitHub Actions and emails via Resend if it is unreachable (secrets: `MONITOR_HEALTH_URL`, `RESEND_API_KEY`, `ALERT_EMAIL_RECIPIENT`).

### RAG alert → email bridging (since 20260610400000)
`evaluate_rag_alerts()` still writes every breach to `system_health_metrics` (dashboard), and **also inserts a `system_alerts` row** (`alert_type = 'rag_<metric>'`, `source = 'evaluate_rag_alerts'`). Rule severity `critical` maps to system_alerts severity `critical` — which fires the existing email pipeline (`trg_notify_critical_alert` → `send-health-alert` → Resend); all other rule severities map to `medium` (visible in Admin → System Health, no email). Dedup: no new row while an unresolved alert of the same `alert_type` from the last hour exists, on top of each rule's `cooldown_minutes`/`last_triggered_at` gate.

To test the bridge end-to-end:
```sql
-- 1. Make a rule trivially breach on the next 5-min cron tick
UPDATE rag_alert_rules SET operator='gte', threshold=0, last_triggered_at=NULL
WHERE rule_name='Stuck documents';
-- 2. After the tick: expect one system_alerts row (and, for critical,
--    a system_notifications row from the email trigger)
SELECT created_at, alert_type, severity, message FROM system_alerts
WHERE source='evaluate_rag_alerts' ORDER BY created_at DESC LIMIT 3;
-- 3. Re-arm the rule (clear cooldown) and wait one more tick to confirm
--    dedup: still exactly one unresolved row
UPDATE rag_alert_rules SET last_triggered_at=NULL WHERE rule_name='Stuck documents';
-- 4. Restore the rule and resolve the test alert
UPDATE rag_alert_rules SET operator='gt', threshold=3 WHERE rule_name='Stuck documents';
UPDATE system_alerts SET resolved_at=now()
WHERE source='evaluate_rag_alerts' AND resolved_at IS NULL;
```

### Idle/no-data guard for average RAG alerts (since 20260610600000)
Average/observation-based RAG rules (`avg_rq_score`, `abstain_rate`, `validation_failure_rate`, `p95_response_time_ms`) **do not alert on idle windows with zero observations.** Previously `evaluate_rag_alerts()` computed `avg_rq_score` as `COALESCE(AVG(retrieval_quality_score), 0)`, so a quiet hour with no RAG activity produced `0`, and the seeded `avg_rq_score < 40` ("Low retrieval quality") rule breached on nothing — a recurring phantom **medium** alert. The function now also counts the rows actually measured in the window and **skips** the rule (no `system_health_metrics`, no `system_alerts`, no cooldown update) when that count is zero.

- **Real low-quality observations still alert.** A window that *does* contain scored requests with a genuinely low average still breaches and bridges normally.
- **Count-based alerts are unchanged.** `stuck_document_count` is a `COUNT(*)` where `0` is a real, healthy measurement; its branch leaves the observation count NULL so the guard never applies, and the critical "Stuck documents" alert keeps working.

Confirm on a quiet window on the primary backend (no recent scored `ai_audit_logs`):
```sql
-- Arm the average rule and run one evaluation by hand.
UPDATE rag_alert_rules SET last_triggered_at=NULL WHERE rule_name='Low retrieval quality';
SELECT public.evaluate_rag_alerts();
-- Expect NO new row (the rule was skipped on no-data, not breached):
SELECT created_at, alert_type, severity, message FROM system_alerts
WHERE alert_type='rag_avg_rq_score' AND source='evaluate_rag_alerts'
ORDER BY created_at DESC LIMIT 3;
-- (A window that contains a real low retrieval_quality_score still breaches;
--  count-based rules are exercised by the bridge test above.)
```

## 6. Secrets inventory

### Vault (Postgres `vault.decrypted_secrets`, per environment)
| Name | Used by |
|---|---|
| `supabase_project_url` | `retry_stuck_documents()`, `notify_critical_alert()`, `invoke_health_monitor()` |
| `service_role_key` | same — pg_net calls into edge functions |

If these are missing/rotated, the retry worker now raises an `ingestion_retry_worker_skipped` alert (visible in Admin → System Health; email delivery for that specific alert may also be impaired since the email trigger reads the same vault — the GitHub Actions monitor is the backstop).

### Edge function env (Supabase dashboard → Functions → Secrets)
Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (injected), `OPENAI_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`.
Optional: `AI_GATEWAY_URL` (the primary backend sets `https://api.openai.com/v1` to bypass the Lovable gateway), `AI_FALLBACK_URL`, `AI_FALLBACK_API_KEY`, `AI_CHAT_MODEL`, `AI_GATEWAY_TIMEOUT_MS`, `COHERE_API_KEY` (reranking), `GOOGLE_CALENDAR_CLIENT_ID/SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (push), `APP_URL`, `ALERT_EMAIL_RECIPIENT`, `CRON_SECRET`, `EXTERNAL_RETRIEVAL_URL/KEY`, `RETRIEVAL_BACKEND`.

### Frontend build env
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (required); `VITE_CF_TURNSTILE_SITE_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN`, `VITE_APP_VERSION` (recommended for prod). CI additionally uses `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for sourcemap upload.

## 7. Support procedures

> **Pilot support:** for field-user issues during a pilot (login/invite, workspace-load error, wrong
> role, job not visible, stale-after-deploy, PWA install, stuck/dropped offline changes, "couldn't
> load data"), use [pilot-troubleshooting.md](pilot-troubleshooting.md) first — it has symptom →
> fix → escalate steps and the diagnostic checklist. The procedures below are backend/ops triage.

### Stuck document ingestion
1. Documents page shows per-document `extraction_status` / `embedding_status` badges; failures surface `last_error` with a retry action on the DocumentCard.
2. SQL triage:
   ```sql
   SELECT id, file_name, extraction_status, embedding_status,
          retry_count, processing_started_at, last_error
   FROM documents
   WHERE extraction_status != 'completed' OR embedding_status != 'completed'
   ORDER BY created_at DESC;
   ```
3. The retry worker handles `processing`-stuck (>10 min) and `pending`-stranded rows automatically, max 3 attempts, 5 docs per 5-minute cycle. After 3 attempts the document is marked `failed` and a `document_ingestion_failed` alert fires.

### Failed document extraction
- `unpdf` cannot parse some PDFs (notably minimal/scanned ones) — extraction falls back to OpenAI vision automatically. If both fail, `last_error` says why.
- Manual re-trigger (mirrors what the retry worker does):
  ```sql
  UPDATE documents SET extraction_status='pending', retry_count=0,
         processing_started_at=NULL, last_error=NULL WHERE id = '<doc-id>';
  ```
  then wait for the next `retry-stuck-documents` cycle, or invoke `extract-document-text` with `{"documentId": "<doc-id>", "mode": "document"}` using a service-role bearer (accepted since `_shared/serviceAuth.ts`, commit e256198).
- Re-embedding only: invoke `generate-embeddings` with `{"documentId": "<doc-id>"}` (same auth).

### Verifying the retry cron is alive
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'retry-stuck-documents';
SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-stuck-documents')
ORDER BY start_time DESC LIMIT 10;
-- vault secrets present?
SELECT name FROM vault.decrypted_secrets WHERE name IN ('supabase_project_url','service_role_key');
-- recent ingestion alerts?
SELECT created_at, alert_type, message FROM system_alerts
WHERE source = 'retry_stuck_documents' ORDER BY created_at DESC LIMIT 5;
```

### Compliance-blocked job (no UI override yet)
If the deterministic compliance engine incorrectly blocks a job (`scheduled_jobs.compliance_status = 'blocked'`), there is currently **no admin UI override** — Phase 1 backlog item. Interim: review `compliance_verdicts` for the job, fix or disable the offending `compliance_rules` row, and reset the job's `compliance_status` via SQL.

## 8. Quality gates

- CI (`.github/workflows/ci.yml`): lint, typecheck, unit tests, production build on push/PR to main.
- E2E (`.github/workflows/e2e.yml`): full Playwright suite (~311 tests, sequential) against the primary backend (`fgemfxhwushaiiguqxfe`).
- Local git hooks: **none**. Husky pre-commit (lint+typecheck) and pre-push (unit) were removed once the CI gates above were confirmed green on main; quality enforcement now lives entirely in CI.
