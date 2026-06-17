// ============================================================
// Sentinel AI eval harness — narrow eval-only tenant provisioner (runner)
// ============================================================
// Creates the MINIMUM data the eval live baseline needs on the target backend:
// one eval tenant ("Sentinel Eval Company"), one eval admin login, that admin's
// profile + owner membership, the tenant AI policy, and the fixture HVAC corpus
// (pre-computed embeddings — NO paid model calls). It is idempotent, tenant-
// scoped, and safe to re-run.
//
// This is NOT the E2E global-setup. It deliberately does NOT write global
// feature flags, a second tenant ("Tenant B"), a platform admin, or any
// workflow / diagnostic / compliance / equipment-graph / sample-job data.
//
//   npx tsx evals/provision.ts --dry-run                              # preview, no DB connection, no writes
//   npx tsx evals/provision.ts --confirm-project fgemfxhwushaiiguqxfe # WRITE (must match VITE_SUPABASE_URL)
//
// A real write requires .env.test (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
// AND --confirm-project matching the project ref in VITE_SUPABASE_URL, so it
// cannot run against the wrong backend or without an explicit opt-in.

import { config } from "dotenv";
config({ path: ".env.test" });

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "../e2e/helpers/supabase-admin";
import { ensureCorpusSeeded, chunkCount } from "./seed";
import { seedTestDocuments, seedDocumentChunks } from "../e2e/helpers/ai-seed-helpers";
import {
  assertPlanWithinAllowlist,
  buildWritePlan,
  decideGate,
  describePlan,
  parseProvisionArgs,
  decideRefreshGate,
  buildRefreshDeletePlan,
  assertRefreshDeleteScoped,
  assertIsEvalTenant,
  extractProjectRef,
} from "./provisionPlan";
import {
  EVAL_TENANT_NAME,
  EVAL_TENANT_SLUG_PREFIX,
  EVAL_TENANT_INDUSTRY,
  EVAL_ADMIN_EMAIL,
  EVAL_ADMIN_PASSWORD,
  EVAL_ADMIN_FULL_NAME,
  EVAL_USER_MARKER,
} from "./evalIdentity";

// Marks eval-created auth users with a DEDICATED eval marker (not the E2E
// suite's `e2e_test_data` marker — see evalIdentity.ts). There is no metadata
// column on `tenants`, so the tenant is identified by its required name + the
// sentinel-eval-company-* slug instead.

interface Tally {
  [entity: string]: { found: number; created: number };
}

function bump(t: Tally, entity: string, created: boolean): void {
  t[entity] ??= { found: 0, created: 0 };
  if (created) t[entity].created += 1;
  else t[entity].found += 1;
}

// ── Provisioning steps (each idempotent, tenant-scoped) ─────

async function provisionAdminUser(
  admin: SupabaseClient,
  t: Tally,
): Promise<string> {
  const email = EVAL_ADMIN_EMAIL;
  const password = EVAL_ADMIN_PASSWORD;
  const fullName = EVAL_ADMIN_FULL_NAME;

  const { data: list } = await admin.auth.admin.listUsers();
  const users = (list?.users ?? []) as Array<{ id: string; email?: string | null }>;
  const existing = users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Keep credentials aligned with the harness so it can authenticate.
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    bump(t, "auth.user", false);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, [EVAL_USER_MARKER]: true, eval_provisioned: true },
    });
    if (error) throw new Error(`create eval admin user failed: ${error.message}`);
    userId = data.user!.id;
    bump(t, "auth.user", true);
  }

  // Profile row (normally created by a DB trigger; upsert to be safe).
  await admin
    .from("profiles")
    .upsert({ user_id: userId, full_name: fullName, email }, { onConflict: "user_id" });
  bump(t, "profiles", true);

  return userId;
}

async function provisionTenant(
  admin: SupabaseClient,
  ownerId: string,
  t: Tally,
): Promise<string> {
  const { data: existing } = await admin
    .from("tenants")
    .select("id")
    .eq("name", EVAL_TENANT_NAME)
    .maybeSingle();

  if (existing) {
    // Enterprise tier → unlimited rate limits for the eval, matching the E2E env.
    await admin
      .from("tenants")
      .update({ subscription_tier: "enterprise", subscription_status: "active" })
      .eq("id", existing.id);
    bump(t, "tenants", false);
    return existing.id as string;
  }

  const { data: created, error } = await admin
    .from("tenants")
    .insert({
      name: EVAL_TENANT_NAME,
      slug: `${EVAL_TENANT_SLUG_PREFIX}-${Date.now()}`,
      industry: EVAL_TENANT_INDUSTRY,
      owner_id: ownerId,
      subscription_tier: "enterprise",
      subscription_status: "active",
    })
    .select("id")
    .single();
  if (error) throw new Error(`create eval tenant failed: ${error.message}`);
  bump(t, "tenants", true);
  return created.id as string;
}

async function provisionMembership(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  t: Tally,
): Promise<void> {
  const { data: existing } = await admin
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    bump(t, "tenant_users", false);
    return;
  }
  const { error } = await admin
    .from("tenant_users")
    .insert({ tenant_id: tenantId, user_id: userId, role: "owner", is_active: true });
  if (error) throw new Error(`create eval membership failed: ${error.message}`);
  bump(t, "tenant_users", true);
}

// ── Reporting ───────────────────────────────────────────────

function printBanner(targetRef: string | null): void {
  console.log("=== NARROW EVAL-ONLY PROVISIONER ===");
  console.log("This is NOT the E2E global-setup.");
  console.log(`target project (VITE_SUPABASE_URL): ${targetRef ?? "(not set)"}`);
  console.log(`eval tenant: "${EVAL_TENANT_NAME}"`);
  console.log("\nplanned writes (only):");
  for (const line of describePlan(buildWritePlan())) console.log(line);
  console.log(
    "\nwill NOT touch: global feature_flags, Tenant B, platform_admins, " +
      "compliance/equipment/workflow/diagnostic data, sample jobs/clients.",
  );
}

function printResult(t: Tally, corpus: { seeded: boolean; chunkCount: number }): void {
  console.log("\n--- provisioning result ---");
  for (const entity of ["auth.user", "profiles", "tenants", "tenant_users"]) {
    const c = t[entity] ?? { found: 0, created: 0 };
    console.log(`  ${entity.padEnd(16)} found=${c.found} created=${c.created}`);
  }
  console.log(
    `  corpus           ${corpus.seeded ? "seeded now" : "already present"} ` +
      `(chunks=${corpus.chunkCount}, tenant_ai_policies upserted, embeddings=pre-computed)`,
  );
  console.log("\nconfirmations:");
  console.log("  ✓ no global feature_flags written");
  console.log("  ✓ no Tenant B created");
  console.log("  ✓ no platform admin / workflow / diagnostic / compliance / equipment data");
  console.log("  ✓ no model calls (corpus uses checked-in embeddings)");
}

// ── Corpus refresh (explicit, tenant-scoped delete + reseed) ─

interface RefreshResult {
  tenantId: string;
  deletedChunks: number;
  deletedDocs: number;
  seededDocs: number;
  chunkCount: number;
}

/**
 * Refresh ONLY the eval tenant's corpus: resolve + hard-verify the tenant, then
 * delete its document_chunks and documents (tenant-scoped), then reseed via the
 * current-main seed logic. Leaves the auth user, profile, tenant, owner
 * membership and tenant AI policy untouched.
 */
async function refreshCorpus(
  admin: SupabaseClient,
  confirmTenantId: string,
): Promise<RefreshResult> {
  // Resolve by name and hard-verify identity BEFORE any delete.
  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id,name,slug")
    .eq("name", EVAL_TENANT_NAME);
  if (error) throw new Error(`refresh: resolve tenant failed: ${error.message}`);
  if (!tenants || tenants.length !== 1) {
    throw new Error(
      `refresh: expected exactly one "${EVAL_TENANT_NAME}" tenant, found ${tenants?.length ?? 0}`,
    );
  }
  const t = tenants[0] as { id: string; name: string; slug: string | null };
  assertIsEvalTenant({ id: t.id, name: t.name, slug: t.slug }, confirmTenantId);

  // Build + assert the tenant-scoped, corpus-only delete plan.
  const deletePlan = buildRefreshDeletePlan(t.id);
  assertRefreshDeleteScoped(deletePlan, t.id);
  console.log("\n[refresh] tenant-scoped delete plan:");
  for (const d of deletePlan) {
    console.log(`  • DELETE ${d.table.padEnd(16)} WHERE tenant_id = ${d.scope.tenant_id}`);
  }

  // Execute deletes (chunks first — they reference documents), tenant-scoped.
  const { data: delChunks, error: ce } = await admin
    .from("document_chunks")
    .delete()
    .eq("tenant_id", t.id)
    .select("id");
  if (ce) throw new Error(`refresh: delete document_chunks failed: ${ce.message}`);
  const { data: delDocs, error: de } = await admin
    .from("documents")
    .delete()
    .eq("tenant_id", t.id)
    .select("id");
  if (de) throw new Error(`refresh: delete documents failed: ${de.message}`);

  // Reseed with the existing current-main seed logic (pre-computed embeddings).
  const docIds = await seedTestDocuments(t.id);
  await seedDocumentChunks(t.id, docIds);

  return {
    tenantId: t.id,
    deletedChunks: delChunks?.length ?? 0,
    deletedDocs: delDocs?.length ?? 0,
    seededDocs: docIds.length,
    chunkCount: await chunkCount(t.id),
  };
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseProvisionArgs(process.argv.slice(2));

  // Corpus refresh is a distinct, harder-gated path — handle it first.
  if (args.refreshCorpus) {
    const rgate = decideRefreshGate(args, process.env.VITE_SUPABASE_URL);
    if (!rgate.ok) {
      console.error("=== EVAL CORPUS REFRESH ===");
      console.error(`\n[refresh] REFUSED: ${rgate.reason}`);
      process.exitCode = 1;
      return;
    }
    console.log("=== EVAL CORPUS REFRESH (delete + reseed, eval tenant only) ===");
    console.log(`target project (VITE_SUPABASE_URL): ${extractProjectRef(process.env.VITE_SUPABASE_URL)}`);
    console.log(`eval tenant: "${EVAL_TENANT_NAME}"`);
    console.log(`confirm-tenant-id: ${rgate.tenantId}`);
    console.log(
      "\nwill NOT touch: auth user, profile, tenant row, owner membership, tenant AI policy, " +
        "or any non-corpus table.",
    );
    const admin = getAdminClient();
    const res = await refreshCorpus(admin, rgate.tenantId);
    console.log("\n--- refresh result ---");
    console.log(`  deleted document_chunks: ${res.deletedChunks}`);
    console.log(`  deleted documents:       ${res.deletedDocs}`);
    console.log(`  reseeded documents:      ${res.seededDocs}`);
    console.log(`  document_chunks now:     ${res.chunkCount}`);
    console.log(`\n[refresh] done. eval tenant id=${res.tenantId}`);
    return;
  }

  const gate = decideGate(args, process.env.VITE_SUPABASE_URL);

  if (!gate.ok) {
    printBanner(null);
    const reason = "reason" in gate ? gate.reason : "refused";
    console.error(`\n[provision] REFUSED: ${reason}`);
    process.exitCode = 1;
    return;
  }

  if (gate.mode === "dry-run") {
    printBanner(gate.projectRef);
    console.log("\n[provision] DRY RUN — no DB connection, no writes.");
    return;
  }

  // Write mode — explicit --confirm-project matched the target backend.
  printBanner(gate.projectRef);
  assertPlanWithinAllowlist(buildWritePlan()); // runtime guard: never broad
  console.log(`\n[provision] writing to ${gate.projectRef} …`);

  const admin = getAdminClient(); // throws if env missing
  const tally: Tally = {};
  const userId = await provisionAdminUser(admin, tally);
  const tenantId = await provisionTenant(admin, userId, tally);
  await provisionMembership(admin, tenantId, userId, tally);
  const corpus = await ensureCorpusSeeded(tenantId); // AI policy + fixture corpus (idempotent)

  printResult(tally, corpus);
  console.log(`\n[provision] done. eval tenant id=${tenantId}`);
}

main().catch((e) => {
  console.error("[provision] failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
