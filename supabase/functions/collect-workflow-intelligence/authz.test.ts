import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isServiceRoleBearer } from "../_shared/serviceAuth.ts";

// B2 trust contract for collect-workflow-intelligence (PR-SEC-5). The function
// runs privileged service-role work driven by a caller-supplied job_id with
// verify_jwt=false, and its ONLY intended caller is the
// trg_collect_workflow_intelligence DB trigger, which posts
// `Authorization: Bearer <vault service_role_key>`. index.ts gates the handler
// on `isServiceRoleBearer(bearer)`; this file pins the exact decisions that
// gate must make. Pure/stubbed (verifier injected) — no network; run via
// `deno test --allow-env`.
//
// Why isServiceRoleBearer and not an exact-string compare: the trigger sends
// the Vault legacy JWT-format service_role key, which is NOT byte-identical to
// the runtime-injected SUPABASE_SERVICE_ROLE_KEY. An exact compare would 401
// the legitimate trigger; the GoTrue-verified path below accepts it.

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

Deno.test("accepts a different-but-valid service_role JWT confirmed by GoTrue (the Vault key case)", async () => {
  const ok = await isServiceRoleBearer(makeJwt("service_role"), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => Promise.resolve(true),
  });
  assertEquals(ok, true);
});

Deno.test("empty bearer is denied (missing Authorization -> 401)", async () => {
  assertEquals(await isServiceRoleBearer("", { exactKey: EXACT_KEY }), false);
});

Deno.test("a user JWT (role=authenticated) is denied WITHOUT a network probe", async () => {
  let probed = false;
  const ok = await isServiceRoleBearer(makeJwt("authenticated"), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: () => { probed = true; return Promise.resolve(true); },
  });
  assertEquals(ok, false);
  assertEquals(probed, false); // pre-filter short-circuits anon/user tokens
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
