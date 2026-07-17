// PR-SEC-6 (Gap 2): send-beta-approval platform-admin authorization. Pure/stubbed
// only — no network; run via `deno test --allow-env --allow-read
// supabase/functions/send-beta-approval/`.
//
// Proves: the decision matrix; the platform_admins lookup fails CLOSED; and the
// handler authorizes BEFORE any side effect — every denied caller gets a generic
// 401/403 and NO email is sent and NO beta_applications write occurs, even when a
// full valid body (with applicationId) is supplied.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  BetaApprovalDeps,
  decideBetaApprovalAccess,
  handleBetaApproval,
  lookupPlatformAdmin,
} from "./authz.ts";

// ── decideBetaApprovalAccess (pure) ─────────────────────────

Deno.test("decision: valid platform admin → allowed", () => {
  assertEquals(decideBetaApprovalAccess({ userId: "u1", isPlatformAdmin: true }), { allowed: true });
});

Deno.test("decision: no authenticated user → 401", () => {
  assertEquals(decideBetaApprovalAccess({ userId: null, isPlatformAdmin: false }), {
    allowed: false,
    status: 401,
  });
});

Deno.test("decision: authenticated ordinary user → 403", () => {
  assertEquals(decideBetaApprovalAccess({ userId: "u1", isPlatformAdmin: false }), {
    allowed: false,
    status: 403,
  });
});

Deno.test("decision: authenticated tenant-admin (not platform admin) → 403", () => {
  // A tenant admin is only an authenticated user here; platform-admin membership
  // is false, so it is denied exactly like any other non-platform-admin.
  assertEquals(decideBetaApprovalAccess({ userId: "tenant-admin", isPlatformAdmin: false }), {
    allowed: false,
    status: 403,
  });
});

// ── lookupPlatformAdmin (fail-closed IO helper) ─────────────

function adminStub(
  rows: Array<{ user_id: string }>,
  opts: { error?: { message: string }; throws?: boolean } = {},
) {
  // deno-lint-ignore no-explicit-any
  const b: any = {
    select() {
      return b;
    },
    eq(_col: string, value: string) {
      b._uid = value;
      return b;
    },
    maybeSingle() {
      if (opts.throws) throw new Error("connection reset");
      if (opts.error) return Promise.resolve({ data: null, error: opts.error });
      const match = rows.find((r) => r.user_id === b._uid) ?? null;
      return Promise.resolve({ data: match ? { id: "row" } : null, error: null });
    },
  };
  return { from: () => b };
}

Deno.test("lookupPlatformAdmin: admin row present → true", async () => {
  assertEquals(await lookupPlatformAdmin(adminStub([{ user_id: "u1" }]), "u1"), true);
});

Deno.test("lookupPlatformAdmin: no row → false", async () => {
  assertEquals(await lookupPlatformAdmin(adminStub([]), "u1"), false);
});

Deno.test("lookupPlatformAdmin: query error → false (fail closed)", async () => {
  assertEquals(
    await lookupPlatformAdmin(adminStub([{ user_id: "u1" }], { error: { message: "denied" } }), "u1"),
    false,
  );
});

Deno.test("lookupPlatformAdmin: throws → false (fail closed)", async () => {
  assertEquals(
    await lookupPlatformAdmin(adminStub([{ user_id: "u1" }], { throws: true }), "u1"),
    false,
  );
});

// ── handleBetaApproval (auth-first, no side effect on deny) ──

const VALID_BODY = {
  email: "founder@example.com",
  companyName: "Acme HVAC",
  promoCode: "BETA-FOUNDING-ABC123",
  applicationId: "app-123",
};

function spyDeps(over: { userId?: string | null; admin?: boolean; emailOk?: boolean } = {}) {
  const calls = {
    getUserId: 0,
    isPlatformAdmin: 0,
    email: 0,
    lastEmailInput: null as unknown,
    record: [] as Array<{ id: string; result: unknown }>,
  };
  const deps: BetaApprovalDeps = {
    getUserId: (_t) => {
      calls.getUserId++;
      return Promise.resolve(over.userId ?? null);
    },
    isPlatformAdmin: (_u) => {
      calls.isPlatformAdmin++;
      return Promise.resolve(over.admin ?? false);
    },
    sendApprovalEmail: (input) => {
      calls.email++;
      calls.lastEmailInput = input;
      return Promise.resolve(
        over.emailOk === false
          ? { ok: false, status: 500, error: "resend down" }
          : { ok: true, status: 200, messageId: "m-1" },
      );
    },
    recordEmailResult: (id, result) => {
      calls.record.push({ id, result });
      return Promise.resolve();
    },
  };
  return { deps, calls };
}

function makeReq(headers: Record<string, string>, body?: unknown): Request {
  return new Request("https://x.functions.supabase.co/send-beta-approval", {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

Deno.test("handler: OPTIONS preflight → 200, no deps touched", async () => {
  const { deps, calls } = spyDeps();
  const res = await handleBetaApproval(
    new Request("https://x/send-beta-approval", { method: "OPTIONS" }),
    deps,
  );
  assertEquals(res.status, 200);
  assertEquals(calls.getUserId, 0);
  assertEquals(calls.email, 0);
});

Deno.test("handler: missing Authorization header → 401, NO auth lookup, email, or write", async () => {
  const { deps, calls } = spyDeps({ userId: "u1", admin: true });
  const res = await handleBetaApproval(makeReq({}, VALID_BODY), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.getUserId, 0);
  assertEquals(calls.isPlatformAdmin, 0);
  assertEquals(calls.email, 0);
  assertEquals(calls.record.length, 0);
});

Deno.test("handler: malformed Authorization header → 401, no side effects", async () => {
  const { deps, calls } = spyDeps({ userId: "u1", admin: true });
  const res = await handleBetaApproval(makeReq({ Authorization: "Token abc" }, VALID_BODY), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.getUserId, 0);
  assertEquals(calls.email, 0);
  assertEquals(calls.record.length, 0);
});

Deno.test("handler: invalid/rejected token → 401, admin lookup skipped, no side effects", async () => {
  const { deps, calls } = spyDeps({ userId: null });
  const res = await handleBetaApproval(makeReq({ Authorization: "Bearer bad" }, VALID_BODY), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.getUserId, 1);
  assertEquals(calls.isPlatformAdmin, 0); // never probe membership for an unauthenticated caller
  assertEquals(calls.email, 0);
  assertEquals(calls.record.length, 0);
});

Deno.test("handler: valid ordinary user → 403, no email, no write", async () => {
  const { deps, calls } = spyDeps({ userId: "u1", admin: false });
  const res = await handleBetaApproval(makeReq({ Authorization: "Bearer good" }, VALID_BODY), deps);
  assertEquals(res.status, 403);
  assertEquals(calls.isPlatformAdmin, 1);
  assertEquals(calls.email, 0);
  assertEquals(calls.record.length, 0);
});

Deno.test("handler: valid tenant-admin (not platform admin) → 403, no email, no write", async () => {
  const { deps, calls } = spyDeps({ userId: "tenant-admin", admin: false });
  const res = await handleBetaApproval(makeReq({ Authorization: "Bearer good" }, VALID_BODY), deps);
  assertEquals(res.status, 403);
  assertEquals(calls.email, 0);
  assertEquals(calls.record.length, 0);
});

Deno.test("handler: denied caller with a full valid body (incl applicationId) still causes NO side effect", async () => {
  // Proves the auth gate runs before any request-controlled email/promo/appId reaches a side effect.
  const { deps, calls } = spyDeps({ userId: "u1", admin: false });
  const res = await handleBetaApproval(makeReq({ Authorization: "Bearer good" }, VALID_BODY), deps);
  assertEquals(res.status, 403);
  assertEquals(calls.email, 0);
  assertEquals(calls.record.length, 0);
});

Deno.test("handler: valid platform admin → email sent, result recorded, 200", async () => {
  const { deps, calls } = spyDeps({ userId: "admin-1", admin: true });
  const res = await handleBetaApproval(makeReq({ Authorization: "Bearer good" }, VALID_BODY), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.email, 1);
  assertEquals((calls.lastEmailInput as { email: string }).email, VALID_BODY.email);
  assertEquals(calls.record.length, 1);
  assertEquals(calls.record[0].id, VALID_BODY.applicationId);
});

Deno.test("handler: platform admin but Resend fails → records error, 502, no success", async () => {
  const { deps, calls } = spyDeps({ userId: "admin-1", admin: true, emailOk: false });
  const res = await handleBetaApproval(makeReq({ Authorization: "Bearer good" }, VALID_BODY), deps);
  assertEquals(res.status, 502);
  assertEquals(calls.email, 1);
  assertEquals(calls.record.length, 1); // error recorded
});

Deno.test("handler: platform admin but missing required fields → 400, email NOT sent", async () => {
  const { deps, calls } = spyDeps({ userId: "admin-1", admin: true });
  const res = await handleBetaApproval(
    makeReq({ Authorization: "Bearer good" }, { email: "a@b.com", companyName: "Acme" }), // no promoCode
    deps,
  );
  assertEquals(res.status, 400);
  assertEquals(calls.email, 0);
  assertEquals(calls.record.length, 0);
});
