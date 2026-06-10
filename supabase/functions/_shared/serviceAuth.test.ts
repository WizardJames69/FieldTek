import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  decodeJwtPayload,
  isServiceRoleBearer,
  unverifiedJwtRole,
} from "./serviceAuth.ts";

// serviceAuth.ts is side-effect-free, so it is imported directly. The
// remote GoTrue verifier is injected per-test; a real network call in a
// unit test would be a bug, so every stub records whether it was hit.

const EXACT_KEY = "runtime-injected-service-role-key";

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Build a JWT-shaped token. The signature is garbage by construction —
 * exactly what an attacker minting a forged service_role claim would send. */
function fakeJwt(payload: Record<string, unknown>): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.${b64url("sig")}`;
}

function stubVerifier(result: boolean | Error) {
  const calls: string[] = [];
  const verify = (token: string): Promise<boolean> => {
    calls.push(token);
    if (result instanceof Error) return Promise.reject(result);
    return Promise.resolve(result);
  };
  return { verify, calls };
}

// ── decode helpers ──────────────────────────────────────────────

Deno.test("decodeJwtPayload: decodes a base64url payload", () => {
  const payload = decodeJwtPayload(fakeJwt({ role: "service_role", iss: "supabase" }));
  assertEquals(payload?.role, "service_role");
  assertEquals(payload?.iss, "supabase");
});

Deno.test("decodeJwtPayload: null for non-JWT tokens (opaque sb_secret-style keys)", () => {
  assertEquals(decodeJwtPayload("sb_secret_abc123"), null);
  assertEquals(decodeJwtPayload(""), null);
  assertEquals(decodeJwtPayload("a.b"), null);
  assertEquals(decodeJwtPayload("not.base64!.payload"), null);
});

Deno.test("unverifiedJwtRole: extracts role claim without trusting it", () => {
  assertEquals(unverifiedJwtRole(fakeJwt({ role: "anon" })), "anon");
  assertEquals(unverifiedJwtRole(fakeJwt({ sub: "user-id" })), null);
  assertEquals(unverifiedJwtRole(fakeJwt({ role: 42 })), null);
});

// ── isServiceRoleBearer ─────────────────────────────────────────

Deno.test("exact match against injected key: accepted without remote verification", async () => {
  const { verify, calls } = stubVerifier(new Error("must not be called"));
  const ok = await isServiceRoleBearer(EXACT_KEY, {
    exactKey: EXACT_KEY,
    verifyServiceClaim: verify,
  });
  assert(ok);
  assertEquals(calls.length, 0);
});

Deno.test("valid service-role JWT (GoTrue confirms): accepted for retry/internal invocation", async () => {
  const { verify, calls } = stubVerifier(true);
  const legacyServiceJwt = fakeJwt({ role: "service_role", iss: "supabase" });
  const ok = await isServiceRoleBearer(legacyServiceJwt, {
    exactKey: EXACT_KEY,
    verifyServiceClaim: verify,
  });
  assert(ok);
  assertEquals(calls, [legacyServiceJwt]);
});

Deno.test("forged service_role claim (GoTrue rejects signature): rejected", async () => {
  const { verify, calls } = stubVerifier(false);
  const forged = fakeJwt({ role: "service_role" });
  const ok = await isServiceRoleBearer(forged, {
    exactKey: EXACT_KEY,
    verifyServiceClaim: verify,
  });
  assertEquals(ok, false);
  assertEquals(calls.length, 1); // claim was checked remotely, and denied
});

Deno.test("anon JWT: rejected from service-role behavior, no remote probe", async () => {
  const { verify, calls } = stubVerifier(new Error("must not be called"));
  const ok = await isServiceRoleBearer(fakeJwt({ role: "anon", iss: "supabase" }), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: verify,
  });
  assertEquals(ok, false);
  assertEquals(calls.length, 0);
});

Deno.test("regular user JWT (role=authenticated): cannot access service-role behavior", async () => {
  const { verify, calls } = stubVerifier(new Error("must not be called"));
  const userJwt = fakeJwt({ role: "authenticated", sub: crypto.randomUUID(), email: "tech@example.com" });
  const ok = await isServiceRoleBearer(userJwt, {
    exactKey: EXACT_KEY,
    verifyServiceClaim: verify,
  });
  // False here means callers fall through to their normal user-auth path
  // (GoTrue getUser + tenant checks) — the user keeps working, but gets
  // no service privileges.
  assertEquals(ok, false);
  assertEquals(calls.length, 0);
});

Deno.test("invalid bearer (garbage / opaque key): rejected without remote probe", async () => {
  const { verify, calls } = stubVerifier(new Error("must not be called"));
  for (const bad of ["sb_secret_abc123", "garbage", "", "a.b.c"]) {
    const ok = await isServiceRoleBearer(bad, {
      exactKey: EXACT_KEY,
      verifyServiceClaim: verify,
    });
    assertEquals(ok, false, `expected rejection for ${JSON.stringify(bad)}`);
  }
  assertEquals(calls.length, 0);
});

Deno.test("verifier network failure: fails closed", async () => {
  const { verify } = stubVerifier(new Error("gotrue unreachable"));
  const ok = await isServiceRoleBearer(fakeJwt({ role: "service_role" }), {
    exactKey: EXACT_KEY,
    verifyServiceClaim: verify,
  });
  assertEquals(ok, false);
});

Deno.test("empty exact key never matches empty token", async () => {
  const { verify, calls } = stubVerifier(new Error("must not be called"));
  const ok = await isServiceRoleBearer("", { exactKey: "", verifyServiceClaim: verify });
  assertEquals(ok, false);
  assertEquals(calls.length, 0);
});
