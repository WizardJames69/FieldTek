import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isAuthorizedForInvoice } from "./authorize.ts";

// B1 invoice-access authorization (PR-SEC-5). Pure/stubbed — no I/O; run via
// `deno test --allow-env`. Proves: active staff (owner/admin/dispatcher) of the
// invoice's tenant are authorized; the portal customer who owns the invoice is
// authorized; a technician, an inactive member, a foreign-tenant member, a
// non-owning portal client, and an unrelated user are all denied; a foreign
// invoice and a missing one are indistinguishable (non-enumerating); and a
// lookup failure fails CLOSED.

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLIENT_1 = "c1111111-1111-4111-8111-111111111111";
const USER_STAFF = "d1111111-1111-4111-8111-111111111111";
const USER_PORTAL = "d2222222-2222-4222-8222-222222222222";
const USER_OUTSIDER = "d3333333-3333-4333-8333-333333333333";

interface TenantUserRow { user_id: string; tenant_id: string; role: string; is_active: boolean }
interface ClientRow { id: string; user_id: string }

function makeStubClient(
  seed: { tenant_users?: TenantUserRow[]; clients?: ClientRow[] },
  opts: { throwOnQuery?: boolean } = {},
) {
  const queriedTables: string[] = [];
  function builderFor(rows: Record<string, unknown>[]) {
    const filters: Record<string, unknown> = {};
    // deno-lint-ignore no-explicit-any
    const builder: any = {
      select() { return builder; },
      eq(col: string, val: unknown) { filters[col] = val; return builder; },
      maybeSingle() {
        if (opts.throwOnQuery) throw new Error("connection reset");
        const match = rows.find((r) =>
          Object.entries(filters).every((e) => r[e[0]] === e[1])
        ) ?? null;
        return Promise.resolve({ data: match, error: null });
      },
    };
    return builder;
  }
  return {
    from(table: string) {
      queriedTables.push(table);
      if (table === "tenant_users") return builderFor((seed.tenant_users ?? []) as unknown as Record<string, unknown>[]);
      if (table === "clients") return builderFor((seed.clients ?? []) as unknown as Record<string, unknown>[]);
      throw new Error(`unexpected table ${table}`);
    },
    queriedTables,
  };
}

const INVOICE_A = { tenant_id: TENANT_A, client_id: CLIENT_1 };

// ── Staff branch ────────────────────────────────────────────
for (const role of ["owner", "admin", "dispatcher"]) {
  Deno.test(`staff ${role} of the invoice's tenant is authorized`, async () => {
    const client = makeStubClient({
      tenant_users: [{ user_id: USER_STAFF, tenant_id: TENANT_A, role, is_active: true }],
    });
    assertEquals(await isAuthorizedForInvoice(client, USER_STAFF, INVOICE_A), true);
  });
}

Deno.test("technician of the tenant is denied (not an invoice role)", async () => {
  const client = makeStubClient({
    tenant_users: [{ user_id: USER_STAFF, tenant_id: TENANT_A, role: "technician", is_active: true }],
  });
  assertEquals(await isAuthorizedForInvoice(client, USER_STAFF, INVOICE_A), false);
});

Deno.test("inactive membership is denied", async () => {
  const client = makeStubClient({
    tenant_users: [{ user_id: USER_STAFF, tenant_id: TENANT_A, role: "admin", is_active: false }],
  });
  assertEquals(await isAuthorizedForInvoice(client, USER_STAFF, INVOICE_A), false);
});

Deno.test("admin of a DIFFERENT tenant is denied (cross-tenant)", async () => {
  const client = makeStubClient({
    tenant_users: [{ user_id: USER_STAFF, tenant_id: TENANT_B, role: "admin", is_active: true }],
  });
  assertEquals(await isAuthorizedForInvoice(client, USER_STAFF, INVOICE_A), false);
});

// ── Portal branch ───────────────────────────────────────────
Deno.test("portal client who owns the invoice is authorized (no staff row)", async () => {
  const client = makeStubClient({ clients: [{ id: CLIENT_1, user_id: USER_PORTAL }] });
  assertEquals(await isAuthorizedForInvoice(client, USER_PORTAL, INVOICE_A), true);
});

Deno.test("portal client who does NOT own the invoice is denied", async () => {
  const client = makeStubClient({ clients: [{ id: "other-client", user_id: USER_PORTAL }] });
  assertEquals(await isAuthorizedForInvoice(client, USER_PORTAL, INVOICE_A), false);
});

// ── Neither / edge ──────────────────────────────────────────
Deno.test("unrelated authenticated user is denied", async () => {
  const client = makeStubClient({
    tenant_users: [{ user_id: USER_STAFF, tenant_id: TENANT_A, role: "owner", is_active: true }],
    clients: [{ id: CLIENT_1, user_id: USER_PORTAL }],
  });
  assertEquals(await isAuthorizedForInvoice(client, USER_OUTSIDER, INVOICE_A), false);
});

Deno.test("invoice with null client_id: no portal branch, staff still works", async () => {
  const client = makeStubClient({
    tenant_users: [{ user_id: USER_STAFF, tenant_id: TENANT_A, role: "owner", is_active: true }],
  });
  const invoiceNoClient = { tenant_id: TENANT_A, client_id: null };
  assertEquals(await isAuthorizedForInvoice(client, USER_STAFF, invoiceNoClient), true);
  // The clients table must not be queried when client_id is null.
  assertEquals(client.queriedTables.includes("clients"), false);
});

Deno.test("non-enumeration: outsider on a real invoice and on an unknown-client invoice both deny", async () => {
  const real = await isAuthorizedForInvoice(makeStubClient({}), USER_OUTSIDER, INVOICE_A);
  const unknown = await isAuthorizedForInvoice(makeStubClient({}), USER_OUTSIDER, { tenant_id: TENANT_B, client_id: "zzz" });
  assertEquals(real, unknown);
  assertEquals(real, false);
});

Deno.test("lookup throws: fails CLOSED (denied)", async () => {
  const client = makeStubClient({
    tenant_users: [{ user_id: USER_STAFF, tenant_id: TENANT_A, role: "owner", is_active: true }],
  }, { throwOnQuery: true });
  assertEquals(await isAuthorizedForInvoice(client, USER_STAFF, INVOICE_A), false);
});
