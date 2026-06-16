// ============================================================
// Sentinel AI eval harness — corpus seeding (PR-2.1)
// ============================================================
// Resolves the eval tenant and ensures the fixture-backed HVAC corpus + AI
// policy are present, reusing the E2E seed helpers (service-role, pre-computed
// embeddings — no OpenAI cost at seed time). Idempotent: it does not re-insert
// documents when chunks already exist for the tenant.

import { getAdminClient } from "../e2e/helpers/supabase-admin";
import { EVAL_TENANT_NAME } from "./evalIdentity";
import {
  seedTestDocuments,
  seedDocumentChunks,
  seedTenantAIPolicy,
} from "../e2e/helpers/ai-seed-helpers";

/**
 * Resolve the dedicated eval tenant id by name. This tenant is separate from
 * the E2E suite's tenant (see evalIdentity.ts), so it is NOT created or deleted
 * by E2E global-setup/teardown — it is provisioned by evals/provision.ts.
 */
export async function resolveTenantId(): Promise<string> {
  const client = getAdminClient();
  const { data, error } = await client
    .from("tenants")
    .select("id")
    .eq("name", EVAL_TENANT_NAME)
    .maybeSingle();
  if (error) throw new Error(`resolveTenantId failed: ${error.message}`);
  if (!data) {
    throw new Error(
      `Eval tenant "${EVAL_TENANT_NAME}" not found on this backend. Provision it ` +
        `first: npx tsx evals/provision.ts --confirm-project <ref> (before a live eval run).`,
    );
  }
  return data.id;
}

export async function chunkCount(tenantId: string): Promise<number> {
  const client = getAdminClient();
  const { count } = await client
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}

/** Ensure AI is enabled and the fixture corpus is present (idempotent). */
export async function ensureCorpusSeeded(
  tenantId: string,
): Promise<{ seeded: boolean; chunkCount: number }> {
  await seedTenantAIPolicy(tenantId);
  const existing = await chunkCount(tenantId);
  if (existing > 0) return { seeded: false, chunkCount: existing };
  const docIds = await seedTestDocuments(tenantId);
  await seedDocumentChunks(tenantId, docIds);
  return { seeded: true, chunkCount: await chunkCount(tenantId) };
}
