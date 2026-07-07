import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isValidJobId, verifyJobTenantOwnership } from "./jobOwnership.ts";

// Tenant-ownership guard (PR-SEC-3 compliance block, PR-SEC-4 workflow
// execution context). Pure/stubbed only — no model, no I/O; run via
// `deno test --allow-env`. Both guarded sections in index.ts run on the
// service-role client (RLS bypassed) keyed off caller-supplied
// context.job.id; index.ts gates each ENTIRE section (workflow-state read,
// checklist/evidence reads, verdict persist, compliance_status write,
// workflow execution context fetch) on verifyJobTenantOwnership returning
// true. These tests prove: same-tenant jobs pass, foreign/missing/invalid
// jobs are skipped, lookups fail CLOSED, foreign and missing jobs are
// indistinguishable (no existence leak), and the lookup always filters by
// the caller's tenant.

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB_A = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";
const JOB_MISSING = "33333333-3333-4333-8333-333333333333";

interface JobRow {
  id: string;
  tenant_id: string;
}

// Stub supabase client simulating a service-role (RLS-free) view of
// scheduled_jobs: maybeSingle() applies ONLY the .eq() filters the code under
// test supplied. If the guard forgot the tenant_id filter, a foreign job
// would come back and the foreign-tenant tests below would fail.
function makeStubClient(
  rows: JobRow[],
  opts: { queryError?: { message: string }; throwOnQuery?: boolean } = {},
) {
  const captured: { table: string | null; filters: Record<string, string> } = {
    table: null,
    filters: {},
  };
  const builder = {
    select(_columns: string) {
      return builder;
    },
    eq(column: string, value: string) {
      captured.filters[column] = value;
      return builder;
    },
    maybeSingle() {
      if (opts.throwOnQuery) throw new Error("connection reset");
      if (opts.queryError) return Promise.resolve({ data: null, error: opts.queryError });
      const match = rows.find((row) =>
        Object.entries(captured.filters).every(
          (entry) => row[entry[0] as keyof JobRow] === entry[1],
        )
      ) ?? null;
      return Promise.resolve({ data: match ? { id: match.id } : null, error: null });
    },
  };
  const client = {
    from(table: string) {
      captured.table = table;
      return builder;
    },
  };
  return { client, captured };
}

const DB: JobRow[] = [
  { id: JOB_A, tenant_id: TENANT_A },
  { id: JOB_B, tenant_id: TENANT_B },
];

// ── isValidJobId ────────────────────────────────────────────

Deno.test("isValidJobId: accepts a lowercase UUID", () => {
  assertEquals(isValidJobId(JOB_A), true);
});

Deno.test("isValidJobId: accepts an uppercase UUID", () => {
  assertEquals(isValidJobId(JOB_A.toUpperCase()), true);
});

Deno.test("isValidJobId: rejects non-string input", () => {
  assertEquals(isValidJobId(null), false);
  assertEquals(isValidJobId(undefined), false);
  assertEquals(isValidJobId(42), false);
  assertEquals(isValidJobId({ id: JOB_A }), false);
});

Deno.test("isValidJobId: rejects non-UUID strings (incl. injection-shaped input)", () => {
  assertEquals(isValidJobId(""), false);
  assertEquals(isValidJobId("not-a-uuid"), false);
  assertEquals(isValidJobId(`${JOB_A} OR 1=1`), false);
  assertEquals(isValidJobId(JOB_A.slice(0, -1)), false);
});

// ── verifyJobTenantOwnership ────────────────────────────────

Deno.test("same-tenant job: ownership verified — compliance may proceed", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await verifyJobTenantOwnership(client, JOB_A, TENANT_A), true);
});

Deno.test("foreign-tenant job: ownership denied — compliance block skipped", async () => {
  const { client } = makeStubClient(DB);
  // Tenant A supplies tenant B's real job id: the row exists in the RLS-free
  // stub DB but the tenant filter excludes it.
  assertEquals(await verifyJobTenantOwnership(client, JOB_B, TENANT_A), false);
});

Deno.test("missing job: ownership denied — compliance block skipped", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await verifyJobTenantOwnership(client, JOB_MISSING, TENANT_A), false);
});

Deno.test("no existence leak: foreign job and missing job are indistinguishable", async () => {
  const foreign = await verifyJobTenantOwnership(makeStubClient(DB).client, JOB_B, TENANT_A);
  const missing = await verifyJobTenantOwnership(makeStubClient(DB).client, JOB_MISSING, TENANT_A);
  // Same boolean result → same skip path in index.ts → same HTTP response.
  assertEquals(foreign, missing);
  assertEquals(foreign, false);
});

Deno.test("lookup queries scheduled_jobs filtered by BOTH job id and caller tenant", async () => {
  const { client, captured } = makeStubClient(DB);
  await verifyJobTenantOwnership(client, JOB_A, TENANT_A);
  assertEquals(captured.table, "scheduled_jobs");
  assertEquals(captured.filters["id"], JOB_A);
  assertEquals(captured.filters["tenant_id"], TENANT_A);
});

Deno.test("lookup error object: fails CLOSED (denied)", async () => {
  const { client } = makeStubClient(DB, { queryError: { message: "permission denied" } });
  assertEquals(await verifyJobTenantOwnership(client, JOB_A, TENANT_A), false);
});

Deno.test("lookup throws: fails CLOSED (denied)", async () => {
  const { client } = makeStubClient(DB, { throwOnQuery: true });
  assertEquals(await verifyJobTenantOwnership(client, JOB_A, TENANT_A), false);
});
