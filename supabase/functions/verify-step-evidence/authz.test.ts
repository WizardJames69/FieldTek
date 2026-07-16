import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isValidJobId, verifyJobTenantOwnership } from "../field-assistant/jobOwnership.ts";

// verify-step-evidence job-ownership gate (PR-SEC-5). The handler stamps
// tenant_id from the caller's own membership but keys every service-role
// read/write on the caller-supplied job_id (workflow_step_executions,
// workflow_template_steps, and the workflow_step_evidence insert carry no
// tenant scoping of their own). index.ts gates the handler on
//   isValidJobId(job_id) && await verifyJobTenantOwnership(client, job_id, tenantId)
// returning a non-enumerating 404 otherwise. This file pins that composition:
// an invalid id is rejected WITHOUT a query, a foreign-tenant job is denied,
// and a same-tenant job proceeds. The guard primitives themselves are covered
// in field-assistant/jobOwnership.test.ts. Pure/stubbed — run via
// `deno test --allow-env`.

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB_A = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";
const JOB_MISSING = "33333333-3333-4333-8333-333333333333";

interface JobRow { id: string; tenant_id: string }

function makeStubClient(rows: JobRow[]) {
  let queries = 0;
  const filters: Record<string, string> = {};
  // deno-lint-ignore no-explicit-any
  const builder: any = {
    select() { return builder; },
    eq(col: string, val: string) { filters[col] = val; return builder; },
    maybeSingle() {
      queries++;
      const match = rows.find((r) =>
        Object.entries(filters).every((e) => r[e[0] as keyof JobRow] === e[1])
      ) ?? null;
      return Promise.resolve({ data: match ? { id: match.id } : null, error: null });
    },
  };
  const client = { from() { return builder; } };
  return { client, queryCount: () => queries };
}

const DB: JobRow[] = [
  { id: JOB_A, tenant_id: TENANT_A },
  { id: JOB_B, tenant_id: TENANT_B },
];

// Mirror of the handler's gate composition.
async function authorizeEvidenceJob(
  // deno-lint-ignore no-explicit-any
  client: any,
  jobId: unknown,
  tenantId: string,
): Promise<boolean> {
  return isValidJobId(jobId) && await verifyJobTenantOwnership(client, jobId as string, tenantId);
}

Deno.test("same-tenant job is authorized (evidence submission proceeds)", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await authorizeEvidenceJob(client, JOB_A, TENANT_A), true);
});

Deno.test("foreign-tenant job is denied (would 404)", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await authorizeEvidenceJob(client, JOB_B, TENANT_A), false);
});

Deno.test("missing job is denied", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await authorizeEvidenceJob(client, JOB_MISSING, TENANT_A), false);
});

Deno.test("non-enumeration: foreign and missing jobs are indistinguishable", async () => {
  const foreign = await authorizeEvidenceJob(makeStubClient(DB).client, JOB_B, TENANT_A);
  const missing = await authorizeEvidenceJob(makeStubClient(DB).client, JOB_MISSING, TENANT_A);
  assertEquals(foreign, missing);
  assertEquals(foreign, false);
});

Deno.test("invalid (non-UUID) job id is rejected WITHOUT any DB query", async () => {
  const { client, queryCount } = makeStubClient(DB);
  assertEquals(await authorizeEvidenceJob(client, `${JOB_A} OR 1=1`, TENANT_A), false);
  assertEquals(queryCount(), 0); // short-circuit before the ownership lookup
});
