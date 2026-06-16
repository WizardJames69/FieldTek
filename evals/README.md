# Sentinel AI eval harness

A runnable benchmark for the Sentinel AI (`field-assistant`) RAG pipeline. It
asks a fixed question set against the deployed assistant, reads each answer's
`ai_audit_logs` row for retrieval/judge signals, scores every case, and writes a
JSON report.

This is the **PR-2.1 skeleton + first benchmark set**, plus the **PR-2.2**
threshold gate (pass/fail + no-regression) and per-run cost cap. Wiring the gate
into CI ("don't ship if evals fail") arrives in PR-2.3.

## What it measures

| Metric | Meaning |
|---|---|
| **retrieval accuracy** | expected source document/chunk appeared among the retrieved chunks |
| **citation support** | the answer cited a relevant retrieved source |
| **fact coverage** | the answer contained the expected fact(s) |
| **abstain rate** | `must_abstain` cases the assistant correctly abstained on |
| **hallucination rate** | answered-when-it-should-have-abstained, or judge-flagged-ungrounded, over answered cases |

## Run it

```bash
# Offline self-test — no backend, no OpenAI cost. Proves scoring + reporting.
npx tsx evals/run.ts --self-test

# LIVE run — hits the deployed field-assistant; calls OpenAI (costs money).
npx tsx evals/run.ts

npx tsx evals/run.ts --limit 3          # first N cases
npx tsx evals/run.ts --out my-report.json
```

### Threshold gate & cost cap (PR-2.2)

`--check` evaluates a run's metrics against thresholds and **exits non-zero on
failure**, so the same command can back a CI ship-gate (PR-2.3). It works fully
offline against a saved report — no backend, no OpenAI cost:

```bash
# Gate a saved report against the default floors (exit 1 if below).
npx tsx evals/run.ts --report report.json --check

# No-regression: also fail if metrics slipped vs a previous green run.
npx tsx evals/run.ts --report report.json --baseline last-green.json --check

# Override the default floors with a JSON file (partial merge).
npx tsx evals/run.ts --report report.json --thresholds my-floors.json --check

# LIVE run, gated, with a hard token budget (stops early, logs what it skipped).
npx tsx evals/run.ts --check --max-tokens 50000
```

**Default thresholds** (`evals/thresholds.ts` → `DEFAULT_THRESHOLDS`): retrieval
accuracy ≥ 80%, citation support ≥ 80%, fact coverage ≥ 70%, abstain rate ≥ 90%,
hallucination rate ≤ 5%, with a 5-point no-regression tolerance vs baseline. A
metric with no applicable cases (e.g. abstain rate when a run has no must-abstain
cases) is **skipped**, never failed. Without `--check`, the verdict is printed
but the process does not fail.

**Cost cap:** `--max-tokens N` sums each case's `token_count_prompt +
token_count_response` and stops **before** starting another case once the budget
is spent, logging how many cases were skipped (no silent truncation).

### Cost & prerequisites

- **Seeding is free** — the corpus reuses pre-computed embeddings
  (`e2e/fixtures/chunk-embeddings.json`); no embedding calls at seed time.
- **A live run costs money** — each question calls the deployed assistant, which
  calls OpenAI (completion + judge + query embedding). The first benchmark set is
  ~9 questions, so a run is a few cents, but it is **not** free. Use
  `--self-test` for CI/dev smoke.
- LIVE runs need `.env.test` (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the
  `E2E_ADMIN_*` credentials) and target whichever backend `.env.test` points at.
- The eval tenant (`E2E Test Company`) must exist on that backend. The live
  runner seeds the **corpus** idempotently, but it does **not** create the tenant
  or admin login — provision those once with the narrow provisioner below.

### Provisioning the eval tenant (one-time, narrow)

A live run needs the `E2E Test Company` tenant + an admin login on the target
backend. The documented E2E global-setup creates far more than the eval needs
(5 users, a 2nd tenant, **global feature flags**, platform admin, workflow /
diagnostic / compliance data). `evals/provision.ts` instead creates **only** the
minimum — idempotent, tenant-scoped, and safe to re-run:

| Entity | What |
|---|---|
| `auth.user` | eval admin login (`e2e-admin@fieldtek-test.dev`), marked `e2e_test_data` |
| `profiles` | profile row for that admin |
| `tenants` | eval tenant (enterprise/active; no metadata column, so marked by name + `e2e-test-company-*` slug) |
| `tenant_users` | admin owner membership |
| `tenant_ai_policies` | AI enabled for the tenant |
| `documents` + `document_chunks` | fixture HVAC corpus (pre-computed embeddings — **no model calls**) |

It will **never** write global `feature_flags`, a second tenant ("Tenant B"), a
platform admin, or any workflow / diagnostic / compliance / equipment-graph /
sample-job data — enforced by an allowlist guard (`assertPlanWithinAllowlist`)
plus offline unit tests.

```bash
# Preview the exact write-plan — no DB connection, no writes.
npx tsx evals/provision.ts --dry-run

# Provision for real — requires --confirm-project to MATCH the project ref in
# VITE_SUPABASE_URL, so it cannot run against the wrong backend or by accident.
npx tsx evals/provision.ts --confirm-project fgemfxhwushaiiguqxfe
```

A real write also requires `.env.test` (`VITE_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`).

## Layout

| File | Role |
|---|---|
| `types.ts` | Case / observation / result / report contracts |
| `cases.ts` | The first benchmark set (HVAC manual + must-abstain) |
| `scoring.ts` | Pure scoring + aggregation (unit-tested in `src/test/evals/`) |
| `observe.ts` | Pure response interpretation (SSE / abstain / block) |
| `thresholds.ts` | Pure pass/fail + no-regression gate (unit-tested) |
| `cost.ts` | Pure per-run token budget guard (unit-tested) |
| `seed.ts` | Resolve tenant + ensure corpus (reuses E2E seed helpers) |
| `run.ts` | Runner: live execution, offline `--self-test` / `--report`, gate, JSON report |
| `provisionPlan.ts` | Pure provisioner plan + gate (allowlist, confirm parsing; unit-tested) |
| `provision.ts` | Narrow eval-only tenant provisioner (idempotent; `--dry-run` / `--confirm-project`) |
| `reports/` | Generated reports (git-ignored) |

The pure modules (`scoring.ts`, `observe.ts`, `thresholds.ts`, `cost.ts`) are
covered by Vitest under `src/test/evals/`, so `npm run test` / CI catch scoring
and gating regressions without a live backend.

## Follow-ups (not in PR-2.1)

- `equipment_history` / `service_history` case types (the scorer already supports
  them; they need a richer seeded `equipment_registry` + job history).
- A second trade corpus (e.g. a plumbing fixture spec) per the master plan.
- CI eval gate wiring `--check` into the pipeline (PR-2.3); optional
  `ai_eval_runs` trend-history table (deferred — file baselines cover regression
  for now).
