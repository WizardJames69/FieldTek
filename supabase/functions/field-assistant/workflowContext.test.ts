import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { fetchWorkflowExecutionContext } from "./workflow.ts";

// PR-SEC-4: fetchWorkflowExecutionContext runs on the service-role client
// (RLS bypassed), so tenant isolation must hold inside the function itself:
// (1) the workflow_executions lookup filters by BOTH job_id AND tenant_id,
// and (2) the module-level cache — which persists across requests within an
// edge isolate — is keyed by tenantId:jobId, never jobId alone. Stubbed only,
// no I/O; run via `deno test --allow-env`.
//
// The stub applies ONLY the filters the production code supplies, like a
// service-role query would. Regressions these tests catch:
// - drop the tenant_id filter → the cross-tenant test sees tenant B's data
// - key the cache by jobId alone → the cross-tenant test gets B's cached
//   context served to tenant A
// - break same-tenant caching → the cache-hit test sees extra queries
//
// NOTE: the module cache is shared across tests in this file, so every test
// uses its own unique job/tenant UUIDs.

type Row = Record<string, unknown>;

function makeStubDb(tables: Record<string, Row[]>) {
  const state = {
    queryCount: 0,
    captured: [] as Array<{ table: string; eq: Record<string, unknown> }>,
  };
  const client = {
    from(table: string) {
      state.queryCount++;
      const q = { table, eq: {} as Record<string, unknown>, in: {} as Record<string, unknown[]> };
      state.captured.push(q);
      const matches = () =>
        (tables[table] ?? []).filter((row) =>
          Object.entries(q.eq).every(([col, val]) => row[col] === val) &&
          Object.entries(q.in).every(([col, vals]) => vals.includes(row[col]))
        );
      // deno-lint-ignore no-explicit-any
      const builder: any = {
        select(_cols: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          q.eq[col] = val;
          return builder;
        },
        in(col: string, vals: unknown[]) {
          q.in[col] = vals;
          return builder;
        },
        order(_col: string, _opts?: unknown) {
          return builder;
        },
        limit(_n: number) {
          return builder;
        },
        maybeSingle() {
          const rows = matches();
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        single() {
          const rows = matches();
          return Promise.resolve({
            data: rows[0] ?? null,
            error: rows[0] ? null : { message: "no rows" },
          });
        },
        // Awaitable builder for the list queries (steps, executions, outcomes, stats)
        // deno-lint-ignore no-explicit-any
        then(resolve: any, reject: any) {
          return Promise.resolve({ data: matches(), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, state };
}

// Seed one tenant's complete workflow execution for a job.
function seedTables(
  tables: Record<string, Row[]>,
  ids: { jobId: string; tenantId: string; execId: string; workflowId: string; stepId: string },
  marker: string,
) {
  tables["workflow_executions"] = (tables["workflow_executions"] ?? []).concat({
    id: ids.execId,
    workflow_id: ids.workflowId,
    job_id: ids.jobId,
    tenant_id: ids.tenantId,
    status: "in_progress",
    current_step_number: 1,
    started_at: "2026-07-01T00:00:00Z",
  });
  tables["workflow_templates"] = (tables["workflow_templates"] ?? []).concat({
    id: ids.workflowId,
    name: `${marker} workflow`,
  });
  tables["workflow_template_steps"] = (tables["workflow_template_steps"] ?? []).concat({
    id: ids.stepId,
    workflow_id: ids.workflowId,
    step_number: 1,
    title: `${marker} step`,
    instruction: `${marker} instruction`,
    stage_name: "Service",
    evidence_requirements: {},
    validation_rules: {},
  });
  tables["workflow_step_executions"] = (tables["workflow_step_executions"] ?? []).concat({
    execution_id: ids.execId,
    step_id: ids.stepId,
    step_number: 1,
    status: "completed",
    measurement_value: null,
    measurement_unit: null,
    technician_notes: `${marker} private note`,
    skipped_reason: null,
  });
  tables["workflow_step_outcomes"] = tables["workflow_step_outcomes"] ?? [];
  tables["workflow_step_statistics"] = tables["workflow_step_statistics"] ?? [];
  return tables;
}

Deno.test("workflow_executions is queried with BOTH job_id and tenant_id filters", async () => {
  const jobId = "10000000-0000-4000-8000-000000000001";
  const tenantId = "10000000-0000-4000-8000-0000000000aa";
  const tables = seedTables({}, {
    jobId,
    tenantId,
    execId: "10000000-0000-4000-8000-0000000000e1",
    workflowId: "10000000-0000-4000-8000-0000000000f1",
    stepId: "10000000-0000-4000-8000-0000000000d1",
  }, "T1");
  const { client, state } = makeStubDb(tables);

  const ctx = await fetchWorkflowExecutionContext(client, jobId, null, tenantId);
  assertEquals(ctx?.workflowName, "T1 workflow");

  const execQuery = state.captured.find((c) => c.table === "workflow_executions");
  assertEquals(execQuery?.eq["job_id"], jobId);
  assertEquals(execQuery?.eq["tenant_id"], tenantId);
});

Deno.test("cross-tenant: another tenant's job returns null — no data, no cached context reuse", async () => {
  const jobId = "20000000-0000-4000-8000-000000000001";
  const tenantB = "20000000-0000-4000-8000-0000000000bb";
  const tenantA = "20000000-0000-4000-8000-0000000000aa";
  const tables = seedTables({}, {
    jobId,
    tenantId: tenantB,
    execId: "20000000-0000-4000-8000-0000000000e1",
    workflowId: "20000000-0000-4000-8000-0000000000f1",
    stepId: "20000000-0000-4000-8000-0000000000d1",
  }, "TenantB-secret");
  const { client } = makeStubDb(tables);

  // Tenant B fetches its own job first — populates the cache for this job id.
  const ctxB = await fetchWorkflowExecutionContext(client, jobId, null, tenantB);
  assertEquals(ctxB?.workflowName, "TenantB-secret workflow");

  // Tenant A then supplies tenant B's job id. This must be null:
  // - if the cache were keyed by jobId alone, B's cached context would leak;
  // - if the workflow_executions tenant filter were missing, B's execution
  //   (with technician notes) would be fetched fresh.
  const ctxA = await fetchWorkflowExecutionContext(client, jobId, null, tenantA);
  assertEquals(ctxA, null);
  assertNotEquals(ctxA, ctxB);
});

Deno.test("cache hit preserved: same tenant + same job served from cache on second call", async () => {
  const jobId = "30000000-0000-4000-8000-000000000001";
  const tenantId = "30000000-0000-4000-8000-0000000000cc";
  const tables = seedTables({}, {
    jobId,
    tenantId,
    execId: "30000000-0000-4000-8000-0000000000e1",
    workflowId: "30000000-0000-4000-8000-0000000000f1",
    stepId: "30000000-0000-4000-8000-0000000000d1",
  }, "T3");
  const { client, state } = makeStubDb(tables);

  const first = await fetchWorkflowExecutionContext(client, jobId, null, tenantId);
  const queriesAfterFirst = state.queryCount;
  const second = await fetchWorkflowExecutionContext(client, jobId, null, tenantId);

  assertEquals(second, first);
  assertEquals(state.queryCount, queriesAfterFirst); // no new queries — cache hit
});

Deno.test("no execution row: returns null and caches null under the tenant-scoped key", async () => {
  const jobId = "40000000-0000-4000-8000-000000000001";
  const tenantId = "40000000-0000-4000-8000-0000000000dd";
  const { client, state } = makeStubDb({ workflow_executions: [] });

  const first = await fetchWorkflowExecutionContext(client, jobId, null, tenantId);
  assertEquals(first, null);
  const queriesAfterFirst = state.queryCount;

  const second = await fetchWorkflowExecutionContext(client, jobId, null, tenantId);
  assertEquals(second, null);
  assertEquals(state.queryCount, queriesAfterFirst); // null was cached, no refetch
});
