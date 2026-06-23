import { test, expect } from '@playwright/test';
import { AdminLessonReviewPage } from '../page-objects/AdminLessonReviewPage';
import { waitForToast } from '../helpers/wait-helpers';
import { seedAuditLogs, getLatestAuditLog, cleanupAuditLogs } from '../helpers/audit-log-helpers';
import {
  seedLessonCandidate,
  cleanupLessonCandidates,
  getLatestLessonCandidate,
} from '../helpers/lesson-candidate-helpers';
import * as fs from 'fs';
import * as path from 'path';

// Sentinel learning-loop PR-2 E2E. Uses only the E2E Test Company tenant
// (seeded by global-setup); never the Sentinel Eval Company tenant.
let tenantId: string;
let adminUserId: string;

test.beforeAll(async () => {
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
  );
  tenantId = ctx.tenantId;
  adminUserId = ctx.userIds.admin;
});

test.afterAll(async () => {
  await cleanupLessonCandidates(tenantId);
  await cleanupAuditLogs(tenantId);
});

// ── Review queue (seeded) ───────────────────────────────────────────────────
// These exercise the PR-1 approve/reject spine. They rely only on policies that
// already exist on fgem (platform-admin view-all + review-all), so they pass
// without the new PR-2 INSERT policy.
test.describe('Lesson Review queue', () => {
  let lessonPage: AdminLessonReviewPage;

  test.beforeEach(async ({ page }) => {
    await cleanupLessonCandidates(tenantId);
    lessonPage = new AdminLessonReviewPage(page);
  });

  test('renders the review queue with stat cards', async () => {
    await lessonPage.goto();
    await lessonPage.waitForPage();
    const total = await lessonPage.getStatCardValue('Total');
    expect(parseInt(total) || 0).toBeGreaterThanOrEqual(0);
  });

  test('a seeded pending candidate can be approved with notes', async ({ page }) => {
    const marker = `E2E approve ${Date.now()}`;
    await seedLessonCandidate(tenantId, adminUserId, { status: 'pending', question: marker });

    await lessonPage.goto();
    await lessonPage.waitForPage();
    await lessonPage.filterByStatus('pending');
    await lessonPage.openDetailByText(marker);
    await lessonPage.approveWithNotes('Verified against the equipment manual.');

    await waitForToast(page, /approved/i);

    // Confirm it persisted as approved (service-role read; deterministic).
    const latest = await getLatestLessonCandidate(tenantId);
    expect(latest?.status).toBe('approved');
    expect(latest?.review_notes).toContain('Verified against the equipment manual.');
  });

  test('a seeded pending candidate can be rejected with notes', async ({ page }) => {
    const marker = `E2E reject ${Date.now()}`;
    await seedLessonCandidate(tenantId, adminUserId, { status: 'pending', question: marker });

    await lessonPage.goto();
    await lessonPage.waitForPage();
    await lessonPage.filterByStatus('pending');
    await lessonPage.openDetailByText(marker);
    await lessonPage.rejectWithNotes('Not grounded in any source document.');

    await waitForToast(page, /rejected/i);

    const latest = await getLatestLessonCandidate(tenantId);
    expect(latest?.status).toBe('rejected');
  });

  // PR-3b: with lesson_citations OFF (its default on fgem), an approved lesson
  // shows the disabled message and NO Publish button. This asserts the gate is
  // respected without enabling the flag, deploying promote-lesson, or creating
  // any lesson document — all of which are out of scope for this pass.
  test('an approved lesson hides Publish while lesson_citations is off', async () => {
    const marker = `E2E publish-gate ${Date.now()}`;
    await seedLessonCandidate(tenantId, adminUserId, { status: 'approved', question: marker });

    await lessonPage.goto();
    await lessonPage.waitForPage();
    await lessonPage.filterByStatus('approved');
    await lessonPage.openDetailByText(marker);

    await expect(lessonPage.publishSection()).toBeVisible();
    await expect(lessonPage.publishDisabledMessage()).toBeVisible();
    await expect(lessonPage.publishButton()).toHaveCount(0);
  });
});

// ── Intake from AI audit log (browser) ──────────────────────────────────────
// REQUIRES the PR-2 platform-admin INSERT policy on fgem. The intake surface is
// platform-admin-only and cross-tenant; the platform admin is not a tenant
// member, so the PR-1 tenant-member INSERT policy denies the insert. Until
// `20260618000000_lesson_candidates_admin_insert.sql` is applied to fgem, the
// submit step returns an RLS error and this block fails by design.
test.describe('Lesson candidate intake from AI audit log', () => {
  let lessonPage: AdminLessonReviewPage;

  test.beforeEach(async ({ page }) => {
    await cleanupLessonCandidates(tenantId);
    await cleanupAuditLogs(tenantId);
    await seedAuditLogs(tenantId, adminUserId, 1);
    lessonPage = new AdminLessonReviewPage(page);
  });

  test('admin creates a pending candidate from an audit log', async ({ page }) => {
    const seededLog = await getLatestAuditLog(tenantId);
    expect(seededLog).toBeTruthy();

    await lessonPage.gotoAudit();
    await lessonPage.openFirstAuditDetail();
    await lessonPage.clickCreateCandidate();

    const question = `E2E intake ${Date.now()}`;
    await lessonPage.fillCandidate({
      question,
      answer: 'Curated answer captured from this AI interaction.',
      equipment: 'HVAC Compressor',
    });
    await lessonPage.submitCandidate();

    await waitForToast(page, /lesson candidate created/i);

    // The new row is pending, carries provenance, and appears in the queue.
    const latest = await getLatestLessonCandidate(tenantId);
    expect(latest?.status).toBe('pending');
    expect(latest?.source_type).toBe('ai_interaction');
    expect(latest?.audit_log_id).toBe((seededLog as { id: string }).id);
    expect(latest?.question).toBe(question);

    await lessonPage.goto();
    await lessonPage.waitForPage();
    await lessonPage.filterByStatus('pending');
    await expect(lessonPage.rows().filter({ hasText: question })).toHaveCount(1);
  });

  test('a second intake from the same audit log shows the duplicate warning', async ({ page }) => {
    const seededLog = await getLatestAuditLog(tenantId);
    await seedLessonCandidate(tenantId, adminUserId, {
      status: 'pending',
      auditLogId: (seededLog as { id: string }).id,
      question: 'Pre-existing candidate for this interaction',
    });

    await lessonPage.gotoAudit();
    await lessonPage.openFirstAuditDetail();
    await lessonPage.clickCreateCandidate();

    await expect(lessonPage.duplicateWarning()).toBeVisible();
  });
});
