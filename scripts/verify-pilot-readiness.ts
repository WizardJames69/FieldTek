/**
 * Read-only pilot-readiness preflight.
 *
 * Why this exists
 * ───────────────
 * FieldTek's onboarding path works, but there is no single command an operator
 * can run to confirm a fresh pilot tenant is actually ready before inviting a
 * real beta user. This script is that preflight. It is READ-ONLY BY
 * CONSTRUCTION: it only issues `GET` (health-check) and `.select(...)` reads.
 * It never inserts, updates, deletes, upserts, or calls a mutating RPC, and it
 * never creates a tenant. Pair it with docs/pilot-onboarding-runbook.md.
 *
 * What it checks
 * ──────────────
 *   - GET <SUPABASE_URL>/functions/v1/health-check  (DB / Stripe / auth)
 *   - With --tenant-id <uuid>: observable seed state for that tenant —
 *       counts of clients, jobs, equipment, documents, and document_chunks
 *       that carry an embedding; documents with embedding_status='completed';
 *       subscription tier / trial / AI-policy state; and the effective
 *       feature-flag posture for the pilot-relevant flags.
 *
 * What it CANNOT verify directly (reported as observable proxies instead)
 * ──────────────────────────────────────────────────────────────────────
 *   Edge-function secrets such as OPENAI_API_KEY are not readable from outside
 *   the edge runtime. This script does NOT claim to read them. Instead it
 *   reports the *observable* end-to-end proxies: health-check status, the count
 *   of documents that reached embedding_status='completed', and the count of
 *   document_chunks that actually carry an embedding. A tenant with no indexed
 *   document yet is flagged with a clear warning — that is the signal that doc
 *   ingestion (OPENAI_API_KEY + pgvector + storage bucket) is not yet proven.
 *
 * Run
 * ───
 *   npm run verify:pilot                         # health-check only
 *   npm run verify:pilot -- --tenant-id <uuid>   # + tenant readiness
 *   npm run verify:pilot -- --tenant-id <uuid> --json
 *
 * Requires .env.test with VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (the
 * same read credentials the eval/E2E tooling uses). Exit 0 if every hard check
 * passes, 1 otherwise.
 */

import { config } from "dotenv";
config({ path: ".env.test" });

import { getAdminClient } from "../e2e/helpers/supabase-admin";
import {
  PILOT_RELEVANT_FLAGS,
  resolveFlagForTenant,
  summarizeReadiness,
  type FeatureFlagRow,
  type ReadinessInput,
  type TenantReadinessInput,
} from "./lib/pilotReadiness";

interface Args {
  tenantId: string | null;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  let tenantId: string | null = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--tenant-id") {
      tenantId = argv[i + 1] ?? null;
      i++;
    } else if (arg.startsWith("--tenant-id=")) {
      tenantId = arg.slice("--tenant-id=".length);
    }
  }
  return { tenantId, json };
}

type HealthStatus = "healthy" | "degraded" | "unhealthy" | null;

async function fetchHealthStatus(): Promise<{ status: HealthStatus; raw: unknown }> {
  const baseUrl = process.env.VITE_SUPABASE_URL;
  if (!baseUrl) return { status: null, raw: "VITE_SUPABASE_URL not set" };

  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `${baseUrl.replace(/\/$/, "")}/functions/v1/health-check`;
  try {
    const headers: Record<string, string> = {};
    if (anonKey) {
      headers["apikey"] = anonKey;
      headers["Authorization"] = `Bearer ${anonKey}`;
    }
    const res = await fetch(url, { method: "GET", headers });
    const raw = await res.json().catch(() => null);
    const status =
      raw && typeof raw === "object" && "status" in raw
        ? ((raw as { status: HealthStatus }).status ?? null)
        : null;
    return { status, raw };
  } catch (err) {
    return { status: null, raw: `unreachable: ${(err as Error).message}` };
  }
}

// Read-only exact count for a tenant-scoped table. `head: true` returns no rows,
// just the count — a HEAD request, never a mutation.
async function countForTenant(
  client: ReturnType<typeof getAdminClient>,
  table: string,
  tenantId: string,
  extra?: (q: any) => any,
): Promise<number> {
  let query = client.from(table).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (extra) query = extra(query);
  const { count, error } = await query;
  if (error) {
    console.error(`  ! count(${table}) failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

async function loadTenantReadiness(
  client: ReturnType<typeof getAdminClient>,
  tenantId: string,
): Promise<{ readiness: TenantReadinessInput; tier: Record<string, unknown> | null; aiEnabled: boolean | null }> {
  const { data: tenantRow } = await client
    .from("tenants")
    .select("id, name, subscription_tier, subscription_status, trial_ends_at")
    .eq("id", tenantId)
    .maybeSingle();

  const exists = !!tenantRow;

  if (!exists) {
    return {
      readiness: {
        tenantId,
        exists: false,
        clients: 0,
        jobs: 0,
        equipment: 0,
        documents: 0,
        embeddedChunks: 0,
        indexedDocuments: 0,
      },
      tier: null,
      aiEnabled: null,
    };
  }

  const [clients, jobs, equipment, documents, embeddedChunks, indexedDocuments] = await Promise.all([
    countForTenant(client, "clients", tenantId),
    countForTenant(client, "scheduled_jobs", tenantId),
    countForTenant(client, "equipment_registry", tenantId),
    countForTenant(client, "documents", tenantId),
    countForTenant(client, "document_chunks", tenantId, (q) => q.not("embedding", "is", null)),
    countForTenant(client, "documents", tenantId, (q) => q.eq("embedding_status", "completed")),
  ]);

  const { data: policyRow } = await client
    .from("tenant_ai_policies")
    .select("ai_enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return {
    readiness: { tenantId, exists: true, clients, jobs, equipment, documents, embeddedChunks, indexedDocuments },
    tier: tenantRow as Record<string, unknown>,
    aiEnabled: policyRow ? (policyRow as { ai_enabled: boolean }).ai_enabled : null,
  };
}

async function loadFlagPosture(
  client: ReturnType<typeof getAdminClient>,
  tenantId: string,
): Promise<Array<{ key: string; expected: string; effective: boolean; note: string }>> {
  const { data, error } = await client
    .from("feature_flags")
    .select("key, is_enabled, rollout_percentage, allowed_tenant_ids, blocked_tenant_ids, starts_at, ends_at");
  if (error) {
    console.error(`  ! feature_flags read failed: ${error.message}`);
    return [];
  }
  const rows = (data ?? []) as FeatureFlagRow[];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const now = new Date();
  return PILOT_RELEVANT_FLAGS.map((f) => ({
    key: f.key,
    expected: f.expected,
    effective: resolveFlagForTenant(byKey.get(f.key), tenantId, now),
    note: f.note,
  }));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const health = await fetchHealthStatus();

  let tenant: TenantReadinessInput | null = null;
  let tier: Record<string, unknown> | null = null;
  let aiEnabled: boolean | null = null;
  let flagPosture: Array<{ key: string; expected: string; effective: boolean; note: string }> = [];

  if (args.tenantId) {
    const client = getAdminClient();
    const loaded = await loadTenantReadiness(client, args.tenantId);
    tenant = loaded.readiness;
    tier = loaded.tier;
    aiEnabled = loaded.aiEnabled;
    if (loaded.readiness.exists) {
      flagPosture = await loadFlagPosture(client, args.tenantId);
    }
  }

  const summaryInput: ReadinessInput = { healthStatus: health.status, tenant };
  const summary = summarizeReadiness(summaryInput);

  if (args.json) {
    console.log(
      JSON.stringify(
        { health: health.status, tenant, tier, aiEnabled, flagPosture, summary },
        null,
        2,
      ),
    );
    process.exit(summary.pass ? 0 : 1);
  }

  // Human-readable report.
  console.log("\n  FieldTek — Pilot Readiness Preflight (read-only)\n");
  console.log(`  health-check: ${health.status ?? "UNREACHABLE"}`);

  if (args.tenantId && tenant) {
    console.log(`\n  tenant ${args.tenantId}: ${tenant.exists ? "found" : "NOT FOUND"}`);
    if (tenant.exists) {
      if (tier) {
        console.log(
          `    tier=${tier.subscription_tier} status=${tier.subscription_status} trial_ends_at=${tier.trial_ends_at}`,
        );
      }
      console.log(`    ai_policy.ai_enabled=${aiEnabled === null ? "(no row → permissive/enabled)" : aiEnabled}`);
      console.log(
        `    clients=${tenant.clients} jobs=${tenant.jobs} equipment=${tenant.equipment} ` +
          `documents=${tenant.documents} indexedDocuments=${tenant.indexedDocuments} embeddedChunks=${tenant.embeddedChunks}`,
      );
      if (flagPosture.length > 0) {
        console.log("\n  feature-flag posture (effective for this tenant):");
        for (const f of flagPosture) {
          const drift = f.expected === "on" && !f.effective ? "  <-- EXPECTED ON" : "";
          const decisionA = f.expected === "off-decision-a" && f.effective ? "  <-- UNEXPECTED: Decision A holds this OFF" : "";
          console.log(`    ${f.effective ? "ON " : "off"}  ${f.key}  (expected: ${f.expected})${drift}${decisionA}`);
        }
      }
    }
  } else {
    console.log("\n  (no --tenant-id given; ran health-check only. Pass --tenant-id <uuid> for tenant readiness.)");
  }

  console.log("\n  hard checks:");
  for (const c of summary.hardChecks) {
    console.log(`    [${c.pass ? "PASS" : "FAIL"}] ${c.name} — ${c.detail}`);
  }
  if (summary.warnings.length > 0) {
    console.log("\n  warnings (non-blocking):");
    for (const w of summary.warnings) {
      console.log(`    - ${w}`);
    }
  }

  console.log(`\n  RESULT: ${summary.pass ? "READY (hard checks passed)" : "NOT READY (a hard check failed)"}\n`);
  process.exit(summary.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
