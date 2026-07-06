import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decideInvoiceReminderAccess } from "./authz.ts";

// Pure decision over injected resolvers — no network. decideInvoiceReminderAccess
// is only reached for NON-service callers; the service-role/cron path is handled
// in the function before this runs and never calls it.

const UID = "11111111-1111-4111-8111-111111111111";
const TID = "22222222-2222-4222-8222-222222222222";
const OTHER_TID = "33333333-3333-4333-8333-333333333333";
const INV = "44444444-4444-4444-8444-444444444444";

const never = (label: string) => () => {
  throw new Error(`resolver '${label}' should not have been called`);
};

Deno.test("same-tenant user with ONLY invoice_id is allowed (tenant derived)", async () => {
  let resolvedFor = "";
  const r = await decideInvoiceReminderAccess({
    userId: UID,
    tenantId: null,
    invoiceId: INV,
    resolveInvoiceTenant: (id) => {
      resolvedFor = id;
      return Promise.resolve(TID);
    },
    isMember: (uid, tid) => Promise.resolve(uid === UID && tid === TID),
  });
  assertEquals(r, { allowed: true, effectiveTenantId: TID });
  assertEquals(resolvedFor, INV);
});

Deno.test("non-member with a FOREIGN invoice_id is blocked with 404 (no existence leak)", async () => {
  const r = await decideInvoiceReminderAccess({
    userId: UID,
    tenantId: null,
    invoiceId: INV,
    resolveInvoiceTenant: () => Promise.resolve(OTHER_TID),
    isMember: () => Promise.resolve(false),
  });
  assertEquals(r, { allowed: false, status: 404 });
});

Deno.test("anon caller (no user) with invoice_id is blocked with 401 (resolvers untouched)", async () => {
  const r = await decideInvoiceReminderAccess({
    userId: null,
    tenantId: null,
    invoiceId: INV,
    resolveInvoiceTenant: never("resolveInvoiceTenant"),
    isMember: never("isMember"),
  });
  assertEquals(r, { allowed: false, status: 401 });
});

Deno.test("explicit tenant_id + member is allowed (invoice lookup skipped)", async () => {
  const r = await decideInvoiceReminderAccess({
    userId: UID,
    tenantId: TID,
    invoiceId: INV,
    resolveInvoiceTenant: never("resolveInvoiceTenant"),
    isMember: () => Promise.resolve(true),
  });
  assertEquals(r, { allowed: true, effectiveTenantId: TID });
});

Deno.test("explicit tenant_id + non-member is blocked with 403", async () => {
  const r = await decideInvoiceReminderAccess({
    userId: UID,
    tenantId: OTHER_TID,
    invoiceId: null,
    resolveInvoiceTenant: never("resolveInvoiceTenant"),
    isMember: () => Promise.resolve(false),
  });
  assertEquals(r, { allowed: false, status: 403 });
});

Deno.test("neither tenant_id nor invoice_id → 400 (prevents a user-triggered all-tenants sweep)", async () => {
  const r = await decideInvoiceReminderAccess({
    userId: UID,
    tenantId: null,
    invoiceId: null,
    resolveInvoiceTenant: never("resolveInvoiceTenant"),
    isMember: never("isMember"),
  });
  assertEquals(r, { allowed: false, status: 400 });
});

Deno.test("invoice_id that resolves to no tenant → 404", async () => {
  const r = await decideInvoiceReminderAccess({
    userId: UID,
    tenantId: null,
    invoiceId: INV,
    resolveInvoiceTenant: () => Promise.resolve(null),
    isMember: never("isMember"),
  });
  assertEquals(r, { allowed: false, status: 404 });
});
