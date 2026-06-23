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
  resolveChunkEmbedding,
} from "../e2e/helpers/ai-seed-helpers";
import {
  LESSON_DOCUMENT_NAME,
  LESSON_DOCUMENT_CATEGORY,
  LESSON_DOCUMENT_SOURCE,
  LESSON_EXTRACTED_TEXT,
  LESSON_CHUNKS,
} from "./lessonCorpus";

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

/**
 * Seed the PR-3c approved-lesson fixture as a promote-lesson-shaped document
 * (category "Approved Lesson", source "lesson", file_url null) + its chunks with
 * pre-computed embeddings. Idempotent: skips if the lesson document already
 * exists for the tenant. Field shapes mirror
 * supabase/functions/promote-lesson/lesson-publish.ts (buildLessonDocumentInsert).
 *
 * Seeding alone does NOT make the lesson citable — that stays gated by the
 * lesson_citations flag (retrieval-time exclusion when off, PR-3b). Tenant-scoped.
 */
export async function ensureEvalLessonSeeded(
  tenantId: string,
): Promise<{ seeded: boolean; documentId: string | null; chunkCount: number }> {
  const client = getAdminClient();

  // Idempotency: a lesson document already present for this tenant?
  const { data: existingDoc } = await client
    .from("documents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source", LESSON_DOCUMENT_SOURCE)
    .eq("name", LESSON_DOCUMENT_NAME)
    .maybeSingle();
  if (existingDoc) {
    const { count } = await client
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", existingDoc.id);
    return { seeded: false, documentId: existingDoc.id, chunkCount: count ?? 0 };
  }

  const { data: doc, error: docError } = await client
    .from("documents")
    .insert({
      tenant_id: tenantId,
      name: LESSON_DOCUMENT_NAME,
      category: LESSON_DOCUMENT_CATEGORY,
      source: LESSON_DOCUMENT_SOURCE,
      source_id: null,
      file_url: null,
      extraction_status: "completed",
      embedding_status: "completed",
      extracted_text: LESSON_EXTRACTED_TEXT,
    })
    .select("id")
    .single();
  if (docError || !doc) {
    throw new Error(`ensureEvalLessonSeeded: documents insert failed: ${docError?.message ?? "no row"}`);
  }

  for (let j = 0; j < LESSON_CHUNKS.length; j++) {
    const chunk = LESSON_CHUNKS[j];
    const { error: chunkError } = await client.from("document_chunks").insert({
      document_id: doc.id,
      tenant_id: tenantId,
      chunk_text: chunk.text,
      chunk_index: j,
      embedding: JSON.stringify(resolveChunkEmbedding(chunk.text)),
      // Mirror generate-embeddings: denormalize the parent category onto the chunk.
      document_category: LESSON_DOCUMENT_CATEGORY,
      equipment_type: null,
      brand: null,
      model: null,
      page_number: chunk.page_number ?? null,
      section_name: chunk.section_name ?? null,
    });
    if (chunkError) {
      throw new Error(
        `ensureEvalLessonSeeded: document_chunks insert failed (chunk ${j}): ${chunkError.message}`,
      );
    }
  }

  return { seeded: true, documentId: doc.id, chunkCount: LESSON_CHUNKS.length };
}

/** Ensure AI is enabled and the fixture corpus + approved-lesson fixture are present (idempotent). */
export async function ensureCorpusSeeded(
  tenantId: string,
): Promise<{ seeded: boolean; chunkCount: number; lessonSeeded: boolean }> {
  await seedTenantAIPolicy(tenantId);
  const existing = await chunkCount(tenantId);
  let seeded = false;
  if (existing === 0) {
    const docIds = await seedTestDocuments(tenantId);
    await seedDocumentChunks(tenantId, docIds);
    seeded = true;
  }
  // PR-3c: seed the approved-lesson fixture independently of the base-corpus
  // early return, so a durable eval tenant whose corpus already exists still
  // gets the lesson. Citability remains gated by lesson_citations.
  const lesson = await ensureEvalLessonSeeded(tenantId);
  return { seeded, chunkCount: await chunkCount(tenantId), lessonSeeded: lesson.seeded };
}
