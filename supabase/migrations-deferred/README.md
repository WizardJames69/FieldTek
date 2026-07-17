# Deferred migrations — workflow-template / pattern-discovery stream

**These SQL files are intentionally NOT part of the active migration history.** The
Supabase CLI only reads `supabase/migrations/`, so nothing in this directory is
applied by `supabase db reset`, `supabase db push`, or the clean-replay CI gate.
That is the whole point: it removes a deployment footgun without deleting the work.

## What this stream is

An eight-file R&D stream that builds a workflow-template + execution model and an
AI pattern-discovery layer on top of the existing workflow-intelligence graph:

| Version | File | Creates |
|---|---|---|
| `20260425000000` | workflow_templates | `workflow_templates`, `workflow_template_steps`, `workflow_executions`, `workflow_step_executions` (+ RLS, indexes) |
| `20260425100000` | workflow_templates_fk | `scheduled_jobs.workflow_execution_id`, `workflow_step_evidence.step_execution_id` |
| `20260425200000` | workflow_templates_feature_flag | `workflow_templates` feature-flag row (disabled) |
| `20260430000000` | workflow_step_outcomes | `workflow_step_outcomes` learning table |
| `20260501000000` | workflow_step_statistics | `workflow_step_statistics` + `upsert_workflow_step_statistic()` |
| `20260509000000` | add_is_tenant_admin_tenant_scoped_overload | `is_tenant_admin(uuid, uuid)` — the tenant-scoped overload `20260510000000` needs |
| `20260510000000` | workflow_pattern_discovery | `workflow_pattern_clusters`, `workflow_pattern_suggestions`, `fetch_clusterable_chains()`, `convert_suggestion_to_template()`, flag row |
| `20260513000000` | intelligence_flywheel_and_schema | flywheel trigger + platform-admin RLS + global-schema prep (see partial-application note) |

The feature is flag-gated and dormant. Runtime code degrades safely when these
objects are absent: `JobDetailSheet` hides workflow UI when the `workflow_templates`
flag is off, Sentinel's `fetchWorkflowExecutionContext` null-degrades, and
`collect-workflow-intelligence` / `verify-step-evidence` guard their workflow
branches. Nothing in production depends on this stream (established by PR-DB-3).

## Why it was pulled out of `supabase/migrations/` (PR-DB-4)

Production (`fgemfxhwushaiiguqxfe`) never received this stream, but later migrations
(`20260520000000` onward) were applied on top with newer timestamps. That left the
eight versions **out of order** relative to the remote ledger. The Supabase CLI
refuses a normal `supabase db push` in that state and demands `--include-all`, which
would drag the entire dormant stream into production. The prior workaround was to
temporarily move these files out of `supabase/migrations/` before every push and
move them back afterward. Making the relocation permanent removes the manual step:
`supabase db push` now proposes only genuinely-pending active migrations.

## Hard rules — do not break these

1. **Never `supabase db push --include-all`.** It would execute this stream against
   production, materializing a dormant feature and colliding with the parts of
   `20260513000000` that are already live out-of-band.
2. **Never `supabase migration repair --status applied` for any of these eight.**
   Seven were never applied anywhere; `20260513000000` is only *partially* applied
   (see below). Marking any of them "applied" would record a false history and could
   mask the missing sections if the stream is ever revived.
3. **Do not edit the SQL in these files, renumber them, or delete them.** They are a
   preserved, coherent stream. If the feature is revived, it ships forward from here.

### `20260513000000` partial-application history (PR-DB-3 finding)

Production contains a *partial, out-of-band* application of this migration:

- **Live in production:** `notify_collect_workflow_intelligence()`, the
  `trg_collect_workflow_intelligence` trigger on `scheduled_jobs`, and the
  `workflow_diagnostic_statistics.tenant_id` nullability + replacement view policy
  (sections A and C1).
- **Absent in production:** the four platform-admin policies on the deferred tables
  and the `workflow_pattern_clusters` ALTER (sections B and C2) — their target tables
  do not exist there.

Because the file is neither fully applied nor fully absent, the migration ledger
cannot truthfully represent it. This is the second reason it must never be repaired.
The live trigger posts `Authorization: Bearer <vault service_role_key>` to
`collect-workflow-intelligence` and is a real production caller of that function.

## How to reactivate the stream in the future

If the workflow-template feature is revived:

1. **Local development / testing:** copy the eight files back into
   `supabase/migrations/`, then `supabase db reset`. See
   [docs/intelligence-system-test.md](../../docs/intelligence-system-test.md).
2. **Before shipping to production, resolve the ordering deliberately** — do NOT just
   `--include-all`. Re-timestamp the stream forward (past the remote ledger maximum)
   as a fresh, ordered set so a normal `supabase db push` applies it in order, and
   reconcile `20260513000000` against what is already live (drop its already-applied
   sections; ship only B/C2 plus the search_path companion for
   `upsert_workflow_step_statistic` / `fetch_clusterable_chains` /
   `convert_suggestion_to_template`, which were deliberately excluded from
   `20260610100000`).
3. Run the read-only production truth-check from PR-DB-3 first, and gate the rollout
   behind the same approval the rest of the migration-safety process uses
   ([docs/RUNBOOK.md §4](../../docs/RUNBOOK.md)).
