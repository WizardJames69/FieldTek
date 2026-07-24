import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isServiceRoleBearer } from "../_shared/serviceAuth.ts";

// Trust contract for generate-recurring-jobs (Week 0 D1). The function is a
// privileged batch writer — it sweeps every tenant's active
// recurring_job_templates with the service role and inserts scheduled_jobs —
// and its ONLY intended caller is the daily pg_cron wrapper
// invoke_generate_recurring_jobs(), which posts
// `Authorization: Bearer <vault service_role_key>`. index.ts gates the whole
// handler on `isServiceRoleBearer(bearer)` with NO user path (unlike
// send-invoice-reminder, there is no legitimate per-user invocation); this
// file pins the exact decisions that gate must make. Pure/stubbed (verifier
// injected) — no network; run via `deno test --allow-env`.
//
// Why isServiceRoleBearer and not an exact-string compare: the cron wrapper
// sends the Vault legacy JWT-format service_role key, which is NOT
// byte-identical to the runtime-injected SUPABASE_SERVICE_ROLE_KEY. An exact
// compare would 401 the legitimate cron; the GoTrue-verified path accepts it.

const EXACT_KEY = "sb-injected-service-role-key";

// A JWT-shaped token whose (unverified) payload carries the given role claim.
function makeJwt(role: string): string {
  const payload = btoa(JSON.stringify({ role }));
  return `header.${payload}.signature`;
}

Deno.test("accepts the exact injected service-role key (fast path, no probe)", async () => {
  let probed = false;
  const ok = await isServiceRoleBearer(EXACT_KEY, {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => { probed = true; return Promise.resolve(true); },
  });
  assertEquals(ok, true);
  assertEquals(probed, false);
});

Deno.test("accepts a different-but-valid service_role JWT confirmed by GoTrue (the Vault cron key case)", async () => {
  const ok = await isServiceRoleBearer(makeJwt("service_role"), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => Promise.resolve(true),
  });
  assertEquals(ok, true);
});

Deno.test("empty bearer is denied (missing Authorization -> 401)", async () => {
  assertEquals(await isServiceRoleBearer("", { exactKey: EXACT_KEY }), false);
});

Deno.test("an authenticated user's JWT is denied WITHOUT a network probe (the pre-gate PR-SEC-6 gap)", async () => {
  let probed = false;
  const ok = await isServiceRoleBearer(makeJwt("authenticated"), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => { probed = true; return Promise.resolve(true); },
  });
  assertEquals(ok, false);
  assertEquals(probed, false); // pre-filter short-circuits anon/user tokens
});

Deno.test("an anon-key-shaped JWT is denied without a probe", async () => {
  let probed = false;
  const ok = await isServiceRoleBearer(makeJwt("anon"), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => { probed = true; return Promise.resolve(true); },
  });
  assertEquals(ok, false);
  assertEquals(probed, false);
});

Deno.test("a forged service_role JWT that GoTrue rejects is denied", async () => {
  const ok = await isServiceRoleBearer(makeJwt("service_role"), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => Promise.resolve(false),
  });
  assertEquals(ok, false);
});

Deno.test("verifier error fails CLOSED (denied)", async () => {
  const ok = await isServiceRoleBearer(makeJwt("service_role"), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => { throw new Error("gotrue unreachable"); },
  });
  assertEquals(ok, false);
});
