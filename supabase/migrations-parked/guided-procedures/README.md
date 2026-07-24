# Parked stream — "guided procedures" (formerly workflow templates / pattern discovery)

**Status: PARKED by founder decision, 2026-07-21 (Week 0).** This stream must not
coexist with the form engine being built next. If it is ever revived, it comes back
*after* the form engine ships, re-scoped as a **guided procedures** concept
(step-by-step technician runbooks for complex procedures — startup sequences,
commissioning walk-throughs), not as a competing document/checklist system.

**These SQL files are intentionally NOT part of the active migration history.** The
Supabase CLI only reads `supabase/migrations/`, so nothing in this directory is
applied by `supabase db reset`, `supabase db push`, or the clean-replay CI gate.

## What this stream was

An eight-file R&D stream that built a workflow-template + execution model and an
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

## What the Week 0 retirement removed (2026-07-21)

The runtime halves of this stream were deleted from the codebase, so reviving it
means rebuilding UI against these schemas, not un-hiding anything:

- The flag-gated UI and hooks are **gone**: `src/components/settings/workflows/`,
  `src/components/jobs/workflows/`, `useWorkflowTemplates`, `useWorkflowExecution`,
  and every `isEnabled('workflow_templates')` gate.
- `verify-step-evidence` no longer accepts `step_execution_id` — the branch that
  read `workflow_step_executions` / `workflow_template_steps` was deleted. **This
  also resolved security Gap 3** (PR-SEC-6 audit): that branch looked up
  `step_execution_id` without verifying it belonged to the caller's job/tenant.
  Any revival MUST reintroduce that lookup WITH tenant/job scoping.
- Two deliberate survivors still reference the stream's table names:
  `collect-workflow-intelligence` (live production telemetry on job completion —
  see its header comment) and Sentinel's `fetchWorkflowExecutionContext` in
  `field-assistant/workflow.ts` (dead in production, parked for removal as the
  first commit of the form-engine work).

## Why it was pulled out of `supabase/migrations/` (PR-DB-4)

Production (`fgemfxhwushaiiguqxfe`) never received this stream, but later migrations
(`20260520000000` onward) were applied on top with newer timestamps. That left the
eight versions **out of order** relative to the remote ledger. The Supabase CLI
refuses a normal `supabase db push` in that state and demands `--include-all`, which
would drag the entire dormant stream into production. Parking the files permanently
means `supabase db push` proposes only genuinely-pending active migrations.

## Hard rules — do not break these

1. **Never `supabase db push --include-all`.** It would execute this stream against
   production, materializing a parked feature and colliding with the parts of
   `20260513000000` that are already live out-of-band.
2. **Never `supabase migration repair --status applied` for any of these eight.**
   Seven were never applied anywhere; `20260513000000` is only *partially* applied
   (see below). Marking any of them "applied" would record a false history and could
   mask the missing sections if the stream is ever revived.
3. **Do not edit the SQL in these files, renumber them, or delete them.** They are a
   preserved, coherent stream. If the feature is revived, it ships forward from here.

### `20260513000000` partial-application history (PR-DB-3 finding; reconciled Week 0)

Production received a *partial, out-of-band* application of this migration:

- **Live in production — and since 2026-07-23 ALSO promoted into the applied
  ledger** by `supabase/migrations/20260723050000_reconcile_intelligence_flywheel_ledger.sql`
  (verbatim, idempotent copy; live definitions verified against this file by
  catalog query before the push — the only delta was two stripped comment lines
  in the live function body): `notify_collect_workflow_intelligence()`, the
  `trg_collect_workflow_intelligence` trigger on `scheduled_jobs`, and the
  `workflow_diagnostic_statistics.tenant_id` nullability + replacement SELECT
  policy (sections A and C1). A db-replay CI assertion now pins all three, so a
  rebuild-from-migrations can no longer silently lose the telemetry flywheel.
- **Absent in production and NOT ledgered:** the four platform-admin policies on
  the parked tables and the `workflow_pattern_clusters` ALTER (sections B and
  C2) — their target tables do not exist there. These remain exclusively in
  this parked file.

The ledger now truthfully represents the applied portion; the repair prohibition
below still stands for this FILE (marking `20260513000000` itself "applied" would
still be false — sections B/C2 never ran). The live trigger posts
`Authorization: Bearer <vault service_role_key>` to `collect-workflow-intelligence`
and is a real production caller of that function.

## Conditions for revival

1. **The form engine has shipped.** Forms own documents/checklists; guided
   procedures own step-by-step execution. The boundary must be designed, not
   discovered.
2. **Re-scope first:** decide what survives as "guided procedures" (probably the
   step/execution model and evidence requirements; probably not a parallel
   template-authoring UI competing with the form builder).
3. **Local development / testing:** copy the eight files back into
   `supabase/migrations/`, then `supabase db reset`. See
   [docs/intelligence-system-test.md](../../../docs/intelligence-system-test.md).
4. **Before shipping to production, resolve the ordering deliberately** — do NOT just
   `--include-all`. Re-timestamp the stream forward (past the remote ledger maximum)
   as a fresh, ordered set so a normal `supabase db push` applies it in order, and
   reconcile `20260513000000` against what is already live (drop its already-applied
   sections; ship only B/C2 plus the search_path companion for
   `upsert_workflow_step_statistic` / `fetch_clusterable_chains` /
   `convert_suggestion_to_template`, which were deliberately excluded from
   `20260610100000`).
5. **Re-add the `step_execution_id` scoping** that Gap 3 removal took out (see
   above), and run the read-only production truth-check from PR-DB-3 first, gated
   behind the migration-safety approval process ([docs/RUNBOOK.md §4](../../../docs/RUNBOOK.md)).
