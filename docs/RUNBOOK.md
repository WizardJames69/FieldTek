# FieldTek Production Runbook

Last updated: 2026-06-10 (Phase 0 stabilization). Items marked **TODO(prod-access)** cannot be filled in until the production project is accessible from this CLI account.

---

## 1. Environments

| Environment | Supabase project ref | Notes |
|---|---|---|
| Staging | `fgemfxhwushaiiguqxfe` | Linked to this repo's CLI (`supabase/.temp/project-ref`). E2E suite runs against it. |
| Production | `dlrhobkrjfegtbdsqdsa` | **Not accessible from the current CLI account.** TODO(prod-access): inventory applied migrations, deployed functions, secrets, cron jobs. |

Frontend hosting: **TODO** — no Vercel/Netlify config exists in the repo; the README references a Lovable project. Confirm where the production frontend is actually served from and how it is rebuilt (this determines how `VITE_*` env vars are injected).

---

## 2. Deploy sequence

Order matters: database first, then functions, then frontend.

1. **Migrations** — see §4 for the safety rules. Never deploy function code that depends on a migration before that migration is applied.
2. **Edge functions** — `supabase functions deploy <function-name> --project-ref <ref>`. Deploy only the functions changed in the release; there is no bulk-deploy script (TODO: add one listing the 52 functions).
3. **Frontend** — `npm run build` with the target environment's `.env` (`VITE_SUPABASE_URL` drives both the API client and the service-worker cache rule in `vite.config.ts`). TODO(hosting): exact publish step.

After any deploy: watch `system_alerts` (Admin → System Health) and Sentry for 15 minutes.

## 3. Rollback principles

- **Migrations: forward-fix only.** Do not attempt to revert applied migrations on shared environments; write a new migration that undoes the damage. All recent migrations are written idempotently (DROP POLICY IF EXISTS / CREATE OR REPLACE / to_regclass guards) — keep that convention.
- **Edge functions:** redeploy the previous commit's function directory (`git checkout <prev-sha> -- supabase/functions/<fn> && supabase functions deploy <fn> --project-ref <ref>`, then restore the working tree).
- **Frontend:** rebuild from the previous tag/commit. The PWA uses `registerType: "autoUpdate"`, so clients pick up the rollback on next load; `cleanupOutdatedCaches` purges stale assets.
- **Feature flags first:** for AI-pipeline misbehavior, prefer turning off the relevant flag (`rag_judge`, `rag_reranking`, `compliance_engine`, `equipment_graph`, `judge_blocking_mode`, `judge_full_blocking`, `diagnostic_learning`, Admin → Feature Flags) over redeploying.

## 4. Migration safety rules

> ⚠️ **Seven deferred workflow-template migrations must NOT be applied** as part of production-readiness work. They are a separate work stream:
> `20260425000000_workflow_templates.sql`, `20260425100000_workflow_templates_fk.sql`, `20260425200000_workflow_templates_feature_flag.sql`, `20260430000000_workflow_step_outcomes.sql`, `20260501000000_workflow_step_statistics.sql`, `20260510000000_workflow_pattern_discovery.sql`, `20260513000000_intelligence_flywheel_and_schema.sql`

- **Never run bare `supabase db push` while those seven are pending.** Because the applied `20260520*` migrations have later timestamps, the CLI considers history out-of-order and `--include-all` would drag the deferred stream in. Procedure for applying a new migration: temporarily move the seven files out of `supabase/migrations/`, run `supabase db push --dry-run`, **verify the dry-run lists exactly the intended files**, push, then restore the seven files. (Verified safe on 2026-06-10: dry run listed only the intended two `20260610*` migrations.)
- `supabase migration list --linked` before and after every apply; commit the output to the PR description.
- The original `20260511000000`/`20260512000000` files were superseded by `20260610100000`/`20260610200000` and deleted from the repo (they were never applied anywhere).
- **Follow-up owed to the workflow stream:** `upsert_workflow_step_statistic`, `fetch_clusterable_chains`, and `convert_suggestion_to_template` (created by `20260501000000`/`20260510000000`) lack `SET search_path = public`. When the workflow stream is applied, ship a companion migration adding it (the fixes were deliberately excluded from `20260610100000` because the functions don't exist in deployed environments yet).
- `tenant_usage` (table) and `increment_job_usage()` (function) exist **only in remote environments** — they were created via dashboard, not migrations. `20260610100000` guards for this with `to_regclass`/`to_regprocedure`. Long-term TODO: capture their definitions into a migration so local/preview databases match remotes.

## 5. Cron inventory (pg_cron, from applied migrations)

| Job | Schedule | What it does | Defined in |
|---|---|---|---|
| `monitor-health-check` | `*/5 * * * *` | `invoke_health_monitor()` → `monitor-health` edge fn → writes `system_health_metrics`, raises/auto-resolves `system_alerts` | 20260228200000 / 20260228500000 |
| `cleanup-old-health-metrics` | `0 3 * * *` | prunes old health metrics | 20260228200000 |
| `retry-stuck-documents` | `*/5 * * * *` | `retry_stuck_documents()`: retries stuck embeddings + pending-stranded extraction (max 3), marks permanent failures, **alerts on failures/vault-miss** (20260610300000) | 20260301000000 / 20260520200000 / 20260610300000 |
| `refresh-rag-quality-daily` | `0 * * * *` (hourly, despite name) | refreshes RAG quality metrics | 20260305100000 |
| `evaluate-rag-alerts` | `*/5 * * * *` | `evaluate_rag_alerts()`: evaluates `rag_alert_rules`, writes `system_health_metrics` | 20260305200000 |
| `log-pending-reembeds` | `*/5 * * * *` | logs chunks pending re-embedding | 20260325000000 |

Additional schedule shipped with the **deferred** workflow stream (do not expect it yet): hourly intelligence refresh in `20260513000000`.

`expire-stale-trials` exists as an edge function but **no pg_cron schedule for it was found in migrations** — TODO: confirm how (or whether) it is triggered.

Out-of-band backstop: `.github/workflows/health-monitor.yml` pings the `monitor-health` function every 5 minutes from GitHub Actions and emails via Resend if it is unreachable (secrets: `MONITOR_HEALTH_URL`, `RESEND_API_KEY`, `ALERT_EMAIL_RECIPIENT`).

### Known alerting gap
`evaluate_rag_alerts()` writes to `system_health_metrics`, but the **email trigger lives on `system_alerts`** — RAG alert rules (including the seeded "Stuck documents" critical rule) currently produce dashboard metrics, **not emails**. Ingestion failures now alert directly into `system_alerts` (20260610300000); bridging the remaining rag-rule severities is a Phase 1 follow-up.

## 6. Secrets inventory

### Vault (Postgres `vault.decrypted_secrets`, per environment)
| Name | Used by |
|---|---|
| `supabase_project_url` | `retry_stuck_documents()`, `notify_critical_alert()`, `invoke_health_monitor()` |
| `service_role_key` | same — pg_net calls into edge functions |

If these are missing/rotated, the retry worker now raises an `ingestion_retry_worker_skipped` alert (visible in Admin → System Health; email delivery for that specific alert may also be impaired since the email trigger reads the same vault — the GitHub Actions monitor is the backstop).

### Edge function env (Supabase dashboard → Functions → Secrets)
Required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (injected), `OPENAI_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`.
Optional: `AI_GATEWAY_URL` (staging sets `https://api.openai.com/v1` to bypass the Lovable gateway), `AI_FALLBACK_URL`, `AI_FALLBACK_API_KEY`, `AI_CHAT_MODEL`, `AI_GATEWAY_TIMEOUT_MS`, `COHERE_API_KEY` (reranking), `GOOGLE_CALENDAR_CLIENT_ID/SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (push), `APP_URL`, `ALERT_EMAIL_RECIPIENT`, `CRON_SECRET`, `EXTERNAL_RETRIEVAL_URL/KEY`, `RETRIEVAL_BACKEND`.
**TODO(prod-access):** verify which of these are set on production.

### Frontend build env
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (required); `VITE_CF_TURNSTILE_SITE_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN`, `VITE_APP_VERSION` (recommended for prod). CI additionally uses `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for sourcemap upload.

## 7. Support procedures

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

- CI (`.github/workflows/ci.yml`): lint, typecheck, unit tests on push/PR to main.
- E2E (`.github/workflows/e2e.yml`): full Playwright suite (~311 tests, sequential) against staging.
- Husky pre-commit (lint+typecheck) and pre-push (unit) still active; **husky removal is a separate planned workstream — do not remove it before CI gates are confirmed green on main.**
