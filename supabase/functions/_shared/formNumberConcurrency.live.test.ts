import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ============================================================================
// complete_form_instance — LIVE concurrency + idempotency proof
// (form-engine Slice Zero, design risk item 3; founder implementation order 3)
//
// Proves, against a real database:
//   1. Two PARALLEL completions on one tenant serialize to DISTINCT, DENSE
//      document numbers (fresh counter → {PREFIX-00001, PREFIX-00002}).
//   2. Replaying an already-completed instance — even with tampered answers —
//      returns the EXISTING number and writes nothing (answers, outcome,
//      completed_at all unchanged).
//
// This test is LIVE and therefore self-gating, unlike the rest of this suite:
//   - it IGNORES itself when .env.test credentials are unavailable or --allow-net
//     was not granted (so `npm run test:edge-authz` and the no-secrets CI edge
//     suite stay pure and green), and
//   - it SKIPS (pass + loud warning) when the complete_form_instance RPC does
//     not exist yet on the target project (i.e. the Slice Zero migration has
//     not been pushed) — so it can land in the same PR as the migration.
//
// Run for real, after the migration is applied:
//   deno test --allow-env --allow-read --allow-net \
//     supabase/functions/_shared/formNumberConcurrency.live.test.ts
//
// Fixtures are disposable and per-run-namespaced; teardown runs in `finally`
// and the test FAILS on any cleanup error or residue.
// ============================================================================

type Env = Record<string, string>;

function readEnvTest(): Env | null {
  try {
    const raw = Deno.readTextFileSync(new URL("../../../.env.test", import.meta.url));
    const env: Env = {};
    for (const line of raw.split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return null;
  }
}

const env = readEnvTest();
const URL_ = env?.VITE_SUPABASE_URL ?? "";
const SERVICE = env?.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON = env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? env?.VITE_SUPABASE_ANON_KEY ?? "";
const netGranted = (await Deno.permissions.query({ name: "net" })).state === "granted";
const RUNNABLE = Boolean(URL_ && SERVICE && ANON) && netGranted;

function svcHeaders(): HeadersInit {
  return {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function rest(
  method: string,
  path: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: token
      ? { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" }
      : svcHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

Deno.test({
  name: "complete_form_instance: parallel completions serialize to dense numbers; replay is a no-op",
  ignore: !RUNNABLE,
  // Live HTTP fetch keeps sockets in Deno's resource table across await points;
  // sanitizers would flake on that, not on real leaks.
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    // ── RPC presence gate (migration may not be pushed yet) ──
    const probe = await rest("POST", "/rest/v1/rpc/complete_form_instance", {
      p_instance_id: crypto.randomUUID(), p_answers: {}, p_outcome: "complete",
      p_fault_category: null, p_responsible_party: null, p_blocker: "none",
      p_serial_numbers: [], p_labor_hours: null, p_deficiencies: [],
    });
    const probeCode = (probe.json as { code?: string } | null)?.code ?? "";
    if (probe.status === 404 && probeCode === "PGRST202") {
      console.warn("SKIP: complete_form_instance not deployed on target project — push the Slice Zero migration, then re-run.");
      return;
    }

    const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const PASS = `Fnc-${crypto.randomUUID()}!`;
    const email = `fnc-${runId}@fieldtek-test.dev`;
    let userId = "";
    let tenantId = "";
    let templateId = "";
    const instanceIds: string[] = [];
    const cleanupErrors: string[] = [];

    try {
      // ── fixtures (service role) ──
      const u = await rest("POST", "/auth/v1/admin/users", { email, password: PASS, email_confirm: true });
      assertEquals(u.status, 200, `create user: ${JSON.stringify(u.json)}`);
      userId = (u.json as { id: string }).id;

      const t = await rest("POST", "/rest/v1/tenants", {
        name: `FNC ${runId}`, slug: `fnc-${runId}`, industry: "hvac",
        owner_id: userId, subscription_tier: "professional", subscription_status: "active",
      });
      assertEquals(t.status, 201, `create tenant: ${JSON.stringify(t.json)}`);
      tenantId = (t.json as Array<{ id: string }>)[0].id;

      const m = await rest("POST", "/rest/v1/tenant_users", {
        tenant_id: tenantId, user_id: userId, role: "owner", is_active: true,
      });
      assertEquals(m.status, 201, `membership: ${JSON.stringify(m.json)}`);

      const definition = { schema_version: 1, title: "FNC probe form", nodes: [] };
      const tpl = await rest("POST", "/rest/v1/form_templates", {
        tenant_id: tenantId, source_key: `fnc-${runId}`, name: "FNC probe", version: 1,
        status: "published", definition, created_by: userId,
      });
      assertEquals(tpl.status, 201, `template: ${JSON.stringify(tpl.json)}`);
      templateId = (tpl.json as Array<{ id: string }>)[0].id;

      for (let i = 0; i < 2; i++) {
        const id = crypto.randomUUID();
        instanceIds.push(id);
        const ins = await rest("POST", "/rest/v1/form_instances", {
          id, tenant_id: tenantId, template_id: templateId, template_version: 1,
          definition_snapshot: definition, answers: {}, created_by: userId,
        });
        assertEquals(ins.status, 201, `instance ${i}: ${JSON.stringify(ins.json)}`);
      }

      const tok = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: PASS }),
      });
      const tokJson = await tok.json();
      assert(tok.status === 200, `sign-in: ${JSON.stringify(tokJson)}`);
      const token = tokJson.access_token as string;

      const complete = (instanceId: string, answers: unknown) =>
        rest("POST", "/rest/v1/rpc/complete_form_instance", {
          p_instance_id: instanceId, p_answers: answers, p_outcome: "complete",
          p_fault_category: null, p_responsible_party: null, p_blocker: "none",
          p_serial_numbers: ["FNC-SN-1"], p_labor_hours: 1.5, p_deficiencies: [],
        }, token);

      // ── 1. PARALLEL completions serialize to distinct dense numbers ──
      const [r1, r2] = await Promise.all([
        complete(instanceIds[0], { q: "first" }),
        complete(instanceIds[1], { q: "second" }),
      ]);
      assertEquals(r1.status, 200, `parallel #1: ${JSON.stringify(r1.json)}`);
      assertEquals(r2.status, 200, `parallel #2: ${JSON.stringify(r2.json)}`);
      const row1 = (r1.json as Array<{ document_number: string; completed_at: string }>)[0];
      const row2 = (r2.json as Array<{ document_number: string; completed_at: string }>)[0];
      const seqOf = (d: string) => {
        const mch = d.match(/^([A-Z0-9]+)-(\d{5})$/);
        assert(mch, `document number shape: ${d}`);
        return { prefix: mch![1], n: Number(mch![2]) };
      };
      const s1 = seqOf(row1.document_number);
      const s2 = seqOf(row2.document_number);
      assertEquals(s1.prefix, "FT", "unseeded tenant falls back to FT prefix");
      assertEquals(s2.prefix, "FT");
      assert(row1.document_number !== row2.document_number, "numbers must be distinct");
      assertEquals(
        [s1.n, s2.n].sort((a, b) => a - b).join(","), "1,2",
        `fresh counter must issue a dense 1,2 — got ${row1.document_number} / ${row2.document_number}`,
      );

      // ── 2. Replay with TAMPERED payload returns existing number, writes nothing ──
      const replay = await rest("POST", "/rest/v1/rpc/complete_form_instance", {
        p_instance_id: instanceIds[0], p_answers: { q: "TAMPERED" },
        p_outcome: "failed", p_fault_category: "tampered", p_responsible_party: "tampered",
        p_blocker: "parts", p_serial_numbers: ["TAMPERED"], p_labor_hours: 99,
        p_deficiencies: [],
      }, token);
      assertEquals(replay.status, 200, `replay: ${JSON.stringify(replay.json)}`);
      const replayRow = (replay.json as Array<{ document_number: string; completed_at: string }>)[0];
      assertEquals(replayRow.document_number, row1.document_number, "replay must return the EXISTING number");
      assertEquals(replayRow.completed_at, row1.completed_at, "replay must return the ORIGINAL completed_at");

      const after = await rest("GET",
        `/rest/v1/form_instances?id=eq.${instanceIds[0]}&select=answers,outcome,fault_category,serial_numbers,labor_hours,document_number`, undefined);
      const row = (after.json as Array<Record<string, unknown>>)[0];
      assertEquals(row.answers, { q: "first" }, "replay must not rewrite answers");
      assertEquals(row.outcome, "complete", "replay must not rewrite outcome");
      assertEquals(row.fault_category, null, "replay must not rewrite fault_category");
      assertEquals(row.labor_hours, 1.5, "replay must not rewrite labor_hours");
      assertEquals(row.document_number, row1.document_number);

      // Counter advanced exactly twice — the replay minted nothing.
      const counter = await rest("GET", `/rest/v1/form_number_counters?tenant_id=eq.${tenantId}&select=next_value`, undefined);
      assertEquals((counter.json as Array<{ next_value: number }>)[0].next_value, 2, "replay must not advance the counter");
    } finally {
      // ── teardown (service role bypasses RLS; deletes are error-checked) ──
      const del = async (label: string, path: string) => {
        const r = await fetch(`${URL_}${path}`, { method: "DELETE", headers: svcHeaders() });
        if (!r.ok && r.status !== 404) cleanupErrors.push(`${label}: HTTP ${r.status} ${await r.text()}`);
        else await r.text();
      };
      if (tenantId) {
        await del("deficiencies", `/rest/v1/form_deficiencies?tenant_id=eq.${tenantId}`);
        await del("revisions", `/rest/v1/form_instance_revisions?tenant_id=eq.${tenantId}`);
        await del("instances", `/rest/v1/form_instances?tenant_id=eq.${tenantId}`);
        await del("counter", `/rest/v1/form_number_counters?tenant_id=eq.${tenantId}`);
        await del("template", `/rest/v1/form_templates?tenant_id=eq.${tenantId}`);
        await del("membership", `/rest/v1/tenant_users?tenant_id=eq.${tenantId}`);
        await del("tenant", `/rest/v1/tenants?id=eq.${tenantId}`);
      }
      if (userId) {
        await del("profile", `/rest/v1/profiles?user_id=eq.${userId}`);
        const r = await fetch(`${URL_}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: svcHeaders() });
        if (!r.ok && r.status !== 404) cleanupErrors.push(`auth user: HTTP ${r.status} ${await r.text()}`);
        else await r.text();
      }
      // Residue assertion — a silently failed cleanup must fail the test.
      if (tenantId) {
        const left = await rest("GET", `/rest/v1/tenants?id=eq.${tenantId}&select=id`, undefined);
        if (((left.json as unknown[]) ?? []).length > 0) cleanupErrors.push(`tenant ${tenantId} still present`);
      }
      assertEquals(cleanupErrors, [], `cleanup must be residue-free: ${cleanupErrors.join(" | ")}`);
    }
  },
});
