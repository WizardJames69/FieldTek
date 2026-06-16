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
- The eval tenant (`E2E Test Company`) and its corpus must exist on that backend;
  the runner seeds the corpus idempotently if chunks are missing.

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
