import { test, expect } from '@playwright/test';
import { AdminLessonReviewPage } from '../page-objects/AdminLessonReviewPage';
import { waitForToast } from '../helpers/wait-helpers';
import {
  seedLessonCandidate,
  cleanupLessonCandidates,
  getLatestLessonCandidate,
} from '../helpers/lesson-candidate-helpers';
import { getFeatureFlag, setFeatureFlag } from '../helpers/feature-flag-helpers';
import { getAdminClient } from '../helpers/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Sentinel learning-loop PR-3 — REAL publish → unpublish lifecycle.
//
// This spec drives the actual edge functions: the Publish button calls
// promote-lesson (document + chunks) and the Unpublish button calls
// unpublish-lesson (document removed). Both must be deployed, so every test
// here is SKIPPED unless LESSON_FUNCTIONS_DEPLOYED=true. It is collected by the
// chromium-ai-admin project but does not run in default CI.
//
// It never touches the Sentinel Eval Company tenant. It uses only the E2E Test
// Company tenant (from global-setup), enables lesson_citations for that tenant
// via allowed_tenant_ids ONLY (rollout stays 0), and restores the original flag
// state afterward.

const FLAG_KEY = 'lesson_citations';
const RUN = process.env.LESSON_FUNCTIONS_DEPLOYED === 'true';

let tenantId: string;
let adminUserId: string;
let originalFlag: Awaited<ReturnType<typeof getFeatureFlag>> | null = null;

// ── Local helpers (service-role; E2E Test Company tenant only) ──────────────
async function getDocumentById(id: string) {
  const client = getAdminClient();
  const { data } = await client
    .from('documents')
    .select('id, tenant_id, source, source_id')
    .eq('id', id)
    .maybeSingle();
  return data;
}

async function cleanupLessonDocuments(tid: string): Promise<void> {
  const client = getAdminClient();
  await client.from('documents').delete().eq('tenant_id', tid).eq('source', 'lesson');
}

async function enableForEvalTenantOnly(tid: string): Promise<void> {
  // Allowlist-only enablement, rollout stays 0 — mirrors the eval-only pattern.
  await setFeatureFlag(FLAG_KEY, true, 0, { allowed_tenant_ids: [tid], blocked_tenant_ids: [] });
}

const describeFn = RUN ? test.describe : test.describe.skip;

describeFn('Lesson publish → unpublish lifecycle (live)', () => {
  test.beforeAll(async () => {
    const ctx = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
    );
    tenantId = ctx.tenantId;
    adminUserId = ctx.userIds.admin;

    originalFlag = await getFeatureFlag(FLAG_KEY);
    await enableForEvalTenantOnly(tenantId);
  });

  test.afterAll(async () => {
    await cleanupLessonDocuments(tenantId);
    await cleanupLessonCandidates(tenantId);
    // Restore the flag exactly as it was before this spec ran.
    if (originalFlag) {
      await setFeatureFlag(FLAG_KEY, originalFlag.is_enabled, originalFlag.rollout_percentage, {
        allowed_tenant_ids: originalFlag.allowed_tenant_ids ?? [],
        blocked_tenant_ids: originalFlag.blocked_tenant_ids ?? [],
      });
    }
  });

  test.beforeEach(async () => {
    await cleanupLessonDocuments(tenantId);
    await cleanupLessonCandidates(tenantId);
  });

  test('publishes an approved lesson into the knowledge base', async ({ page }) => {
    const marker = `E2E publish-live ${Date.now()}`;
    const lessonId = await seedLessonCandidate(tenantId, adminUserId, {
      status: 'approved',
      question: marker,
    });

    const lessonPage = new AdminLessonReviewPage(page);
    await lessonPage.goto();
    await lessonPage.waitForPage();
    await lessonPage.filterByStatus('approved');
    await lessonPage.openDetailByText(marker);
    await lessonPage.clickPublish();
    await waitForToast(page, /published to knowledge base/i);

    // DB truth: a lesson document exists and the lesson links to it.
    const lesson = await getLatestLessonCandidate(tenantId);
    expect(lesson?.published_document_id).toBeTruthy();
    const doc = await getDocumentById(lesson!.published_document_id as string);
    expect(doc?.source).toBe('lesson');
    expect(doc?.source_id).toBe(lessonId);
    expect(doc?.tenant_id).toBe(tenantId);
  });

  test('unpublish removes the document even when the flag is off (rollback)', async ({ page }) => {
    const marker = `E2E unpublish-live ${Date.now()}`;
    await seedLessonCandidate(tenantId, adminUserId, { status: 'approved', question: marker });

    const lessonPage = new AdminLessonReviewPage(page);
    await lessonPage.goto();
    await lessonPage.waitForPage();
    await lessonPage.filterByStatus('approved');
    await lessonPage.openDetailByText(marker);
    await lessonPage.clickPublish();
    await waitForToast(page, /published to knowledge base/i);

    const published = await getLatestLessonCandidate(tenantId);
    const documentId = published!.published_document_id as string;
    expect(documentId).toBeTruthy();

    // Simulate a rollback: disable lesson_citations for this tenant (allowlist
    // emptied). Publish would now be blocked — but Unpublish must remain usable.
    await setFeatureFlag(FLAG_KEY, true, 0, { allowed_tenant_ids: [], blocked_tenant_ids: [] });

    await lessonPage.goto();
    await lessonPage.waitForPage();
    await lessonPage.filterByStatus('approved');
    await lessonPage.openDetailByText(marker);

    // Republish is hidden (flag off); Unpublish is still available.
    await expect(lessonPage.republishButton()).toHaveCount(0);
    await expect(lessonPage.unpublishButton()).toBeVisible();

    await lessonPage.confirmUnpublish();
    await waitForToast(page, /removed from knowledge base/i);

    // DB truth: the document is gone and the lesson link is cleared.
    const after = await getLatestLessonCandidate(tenantId);
    expect(after?.published_document_id).toBeNull();
    expect(await getDocumentById(documentId)).toBeNull();

    // Restore the allowlist for any later tests in this file.
    await enableForEvalTenantOnly(tenantId);
  });
});
