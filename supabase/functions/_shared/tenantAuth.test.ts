import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  decideTenantResourceAccess,
  getAuthenticatedUser,
  isUuid,
  userHasTenantMembership,
  type SupabaseEnv,
} from "./tenantAuth.ts";

// tenantAuth.ts is side-effect-free and its IO helpers take an injectable
// fetch, so no network/env is touched here. A real fetch in these tests would
// be a bug; every stub records whether (and how) it was called.

const ENV: SupabaseEnv = {
  supabaseUrl: "https://proj.supabase.co",
  serviceKey: "service-key",
  anonKey: "anon-key",
};
const UID = "11111111-1111-4111-8111-111111111111";
const TID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── isUuid ──────────────────────────────────────────────────

Deno.test("isUuid accepts canonical UUIDs, rejects everything else", () => {
  assert(isUuid(UID));
  assert(isUuid("22222222-2222-4222-a222-222222222222"));
  assert(!isUuid("not-a-uuid"));
  assert(!isUuid("11111111111141118111111111111111"));
  assert(!isUuid(""));
  assert(!isUuid(undefined));
  assert(!isUuid(123));
  // No PostgREST-operator injection sneaking through the filter guard.
  assert(!isUuid(`${UID}&role=eq.owner`));
});

// ── decideTenantResourceAccess (pure) ───────────────────────

Deno.test("service role is always allowed", () => {
  const d = decideTenantResourceAccess({ isServiceRole: true, userId: null, isMember: false });
  assertEquals(d.allowed, true);
});

Deno.test("unauthenticated caller → 401", () => {
  const d = decideTenantResourceAccess({ isServiceRole: false, userId: null, isMember: false });
  assertEquals(d, { allowed: false, status: 401, reason: "unauthenticated" });
});

Deno.test("authenticated non-member → 404 by default (no existence leak)", () => {
  const d = decideTenantResourceAccess({ isServiceRole: false, userId: UID, isMember: false });
  assertEquals(d, { allowed: false, status: 404, reason: "not_a_tenant_member" });
});

Deno.test("authenticated non-member → 403 when denyStatus overridden", () => {
  const d = decideTenantResourceAccess({
    isServiceRole: false, userId: UID, isMember: false, denyStatus: 403,
  });
  assertEquals(d, { allowed: false, status: 403, reason: "not_a_tenant_member" });
});

Deno.test("authenticated member → allowed", () => {
  const d = decideTenantResourceAccess({ isServiceRole: false, userId: UID, isMember: true });
  assertEquals(d.allowed, true);
});

// ── getAuthenticatedUser (fail closed) ──────────────────────

Deno.test("getAuthenticatedUser returns the user on a 2xx GoTrue response", async () => {
  const user = await getAuthenticatedUser(
    `Bearer usertoken`,
    ENV,
    () => Promise.resolve(jsonResponse({ id: UID, email: "u@example.com" })),
  );
  assertEquals(user, { id: UID, email: "u@example.com" });
});

Deno.test("getAuthenticatedUser returns null without a Bearer header (no fetch)", async () => {
  let called = false;
  const user = await getAuthenticatedUser(null, ENV, () => {
    called = true;
    return Promise.resolve(jsonResponse({ id: UID }));
  });
  assertEquals(user, null);
  assert(!called);
});

Deno.test("getAuthenticatedUser returns null on a non-2xx response", async () => {
  const user = await getAuthenticatedUser(
    "Bearer bad",
    ENV,
    () => Promise.resolve(jsonResponse({ error: "unauthorized" }, 401)),
  );
  assertEquals(user, null);
});

Deno.test("getAuthenticatedUser fails closed when fetch throws", async () => {
  const user = await getAuthenticatedUser(
    "Bearer x",
    ENV,
    () => Promise.reject(new Error("network down")),
  );
  assertEquals(user, null);
});

// ── userHasTenantMembership (fail closed) ───────────────────

Deno.test("userHasTenantMembership true when an active membership row exists", async () => {
  let capturedUrl = "";
  const ok = await userHasTenantMembership(UID, TID, ENV, {}, (url) => {
    capturedUrl = String(url);
    return Promise.resolve(jsonResponse([{ role: "technician" }]));
  });
  assert(ok);
  assert(capturedUrl.includes("user_id=eq." + UID));
  assert(capturedUrl.includes("tenant_id=eq." + TID));
  assert(capturedUrl.includes("is_active=eq.true"));
});

Deno.test("userHasTenantMembership false when no row matches", async () => {
  const ok = await userHasTenantMembership(UID, TID, ENV, {}, () =>
    Promise.resolve(jsonResponse([])));
  assert(!ok);
});

Deno.test("userHasTenantMembership applies a role filter when roles given", async () => {
  let capturedUrl = "";
  await userHasTenantMembership(UID, TID, ENV, { roles: ["owner", "admin", "dispatcher"] }, (url) => {
    capturedUrl = String(url);
    return Promise.resolve(jsonResponse([]));
  });
  assert(decodeURIComponent(capturedUrl).includes("role=in.(owner,admin,dispatcher)"));
});

Deno.test("userHasTenantMembership fails closed on a malformed id (no fetch)", async () => {
  let called = false;
  const ok = await userHasTenantMembership("not-a-uuid", TID, ENV, {}, () => {
    called = true;
    return Promise.resolve(jsonResponse([{ role: "owner" }]));
  });
  assert(!ok);
  assert(!called);
});

Deno.test("userHasTenantMembership fails closed on a non-2xx response", async () => {
  const ok = await userHasTenantMembership(UID, TID, ENV, {}, () =>
    Promise.resolve(jsonResponse({ error: "boom" }, 500)));
  assert(!ok);
});

Deno.test("userHasTenantMembership fails closed when fetch throws", async () => {
  const ok = await userHasTenantMembership(UID, TID, ENV, {}, () =>
    Promise.reject(new Error("network down")));
  assert(!ok);
});
