# Sentinel AI eval harness

A runnable benchmark for the Sentinel AI (`field-assistant`) RAG pipeline. It
asks a fixed question set against the deployed assistant, reads each answer's
`ai_audit_logs` row for retrieval/judge signals, scores every case, and writes a
JSON report.

This is the **PR-2.1 skeleton + first benchmark set**. Threshold-based pass/fail
gating and cost controls arrive in PR-2.2; CI wiring + a "don't ship if evals
fail" gate arrive in PR-2.3.

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
| `seed.ts` | Resolve tenant + ensure corpus (reuses E2E seed helpers) |
| `run.ts` | Runner: live execution, offline `--self-test`, JSON report |
| `reports/` | Generated reports (git-ignored) |

The pure modules (`scoring.ts`, `observe.ts`) are covered by Vitest under
`src/test/evals/`, so `npm run test` / CI catch scoring regressions without a
live backend.

## Follow-ups (not in PR-2.1)

- `equipment_history` / `service_history` case types (the scorer already supports
  them; they need a richer seeded `equipment_registry` + job history).
- A second trade corpus (e.g. a plumbing fixture spec) per the master plan.
- Threshold/regression scoring + cost caps (PR-2.2); CI eval gate (PR-2.3).
