// ============================================================
// Sentinel AI eval harness — corpus seeding (PR-2.1)
// ============================================================
// Resolves the eval tenant and ensures the fixture-backed HVAC corpus + AI
// policy are present, reusing the E2E seed helpers (service-role, pre-computed
// embeddings — no OpenAI cost at seed time). Idempotent: it does not re-insert
// documents when chunks already exist for the tenant.

import { getAdminClient } from "../e2e/helpers/supabase-admin";
import { TEST_TENANT } from "../e2e/helpers/test-data";
import {
  seedTestDocuments,
  seedDocumentChunks,
  seedTenantAIPolicy,
} from "../e2e/helpers/ai-seed-helpers";

/** Resolve the eval tenant id by name (the same tenant the E2E suite seeds). */
export async function resolveTenantId(): Promise<string> {
  const client = getAdminClient();
  const { data, error } = await client
    .from("tenants")
    .select("id")
    .eq("name", TEST_TENANT.name)
    .maybeSingle();
  if (error) throw new Error(`resolveTenantId failed: ${error.message}`);
  if (!data) {
    throw new Error(
      `Eval tenant "${TEST_TENANT.name}" not found on this backend. Seed it first ` +
        `(e.g. run the E2E global-setup) before a live eval run.`,
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
