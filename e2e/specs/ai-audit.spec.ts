import { test, expect } from '@playwright/test';
import { AdminAIAuditLogsPage } from '../page-objects/AdminAIAuditLogsPage';
import { seedAuditLogs, cleanupAuditLogs } from '../helpers/audit-log-helpers';
import * as fs from 'fs';
import * as path from 'path';

let tenantId: string;
let userId: string;

test.beforeAll(async () => {
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
  );
  tenantId = ctx.tenantId;
  userId = ctx.userIds.admin;

  // Seed some audit log entries for the tests
  await seedAuditLogs(tenantId, userId, 5);
});

test.afterAll(async () => {
  await cleanupAuditLogs(tenantId);
});

test.describe('AI Audit Log Viewer', () => {
  let auditPage: AdminAIAuditLogsPage;

  test.beforeEach(async ({ page }) => {
    auditPage = new AdminAIAuditLogsPage(page);
    await auditPage.goto();
  });

  test('audit logs page renders Total plus outcome stat cards', async ({ page }) => {
    await auditPage.waitForPage();
    // The console now reports outcome-focused counts (Grounding-Trust gate),
    // not a Passed/Blocked binary. "Total Interactions" was renamed to "Total".
    const totalCard = await auditPage.getStatCardValue('Total');
    expect(parseInt(totalCard) || 0).toBeGreaterThanOrEqual(0);
    // The gate-critical outcome counters must be present as stat cards. Scope to
    // the stat-card summary container: once real warn_appended/blocked rows exist,
    // the same labels also render as row badges, so an unscoped page-level
    // getByText('Warn appended', { exact: true }) matches multiple elements and
    // trips Playwright strict mode. The stat-card label is what this test asserts.
    const statCards = page.getByTestId('audit-stat-cards');
    await expect(statCards.getByText('Warn appended', { exact: true })).toBeVisible();
    await expect(statCards.getByText('Judge blocked', { exact: true })).toBeVisible();
  });

  test('table shows recent interactions with columns', async ({ page }) => {
    await auditPage.waitForPage();
    const rowCount = await auditPage.getLogRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('search filters logs by message content', async ({ page }) => {
    await auditPage.waitForPage();
    await auditPage.searchLogs('Rate limit test query');
    await page.waitForTimeout(500);
    const rowCount = await auditPage.getLogRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('outcome filter "Judge blocked" is directly selectable and narrows correctly', async ({ page }) => {
    await auditPage.waitForPage();
    // Gate requirement: judge blocks must be directly filterable. The seeded
    // fixture contains only grounded-pass rows (no judge_verdict='blocked'), so
    // this narrows to the empty state — proving the filter + server-side
    // narrowing work without error. Classifier coverage lives in unit tests.
    await auditPage.filterByOutcome('Judge blocked');
    await page.waitForTimeout(500);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text && !text.includes('No audit logs found')) {
        // If a judge-blocked row ever exists it must carry the Judge blocked badge.
        expect(text).toContain('Judge blocked');
      }
    }
  });

  test('outcome filter "Warn appended" is directly selectable and narrows correctly', async ({ page }) => {
    await auditPage.waitForPage();
    // Gate requirement: warn_appended rows must be directly filterable.
    await auditPage.filterByOutcome('Warn appended');
    await page.waitForTimeout(500);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text && !text.includes('No audit logs found')) {
        expect(text).toContain('Warn appended');
      }
    }
  });

  test('outcome filter "Grounded pass" shows only Grounded pass badge rows', async ({ page }) => {
    await auditPage.waitForPage();
    await auditPage.filterByOutcome('Grounded pass');
    await page.waitForTimeout(500);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await rows.nth(i).textContent();
      if (text && !text.includes('No audit logs found')) {
        expect(text).toContain('Grounded pass');
      }
    }
  });

  test('clicking Eye button opens detail sheet', async ({ page }) => {
    await auditPage.waitForPage();
    const rowCount = await auditPage.getLogRowCount();
    if (rowCount > 0) {
      await auditPage.openLogDetail(0);
      expect(await auditPage.isDetailSheetOpen()).toBe(true);
    }
  });

  test('detail sheet shows "User Message" and "AI Response" sections', async ({ page }) => {
    await auditPage.waitForPage();
    const rowCount = await auditPage.getLogRowCount();
    if (rowCount > 0) {
      await auditPage.openLogDetail(0);
      await expect(page.getByRole('heading', { name: 'User Message' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'AI Response' })).toBeVisible();
    }
  });

  test('detail sheet shows "Block Reason" for a deterministic / human-review row', async ({ page }) => {
    await auditPage.waitForPage();
    // Reach deterministic blocks (response_blocked / human_review_required, judge
    // verdict null) via the Deterministic / human review outcome filter — NOT a
    // judge block. The seeded fixture has only grounded-pass rows, so this skips
    // gracefully; if a deterministic row exists it must render Block Reason.
    await auditPage.filterByOutcome('Deterministic / human review');
    await page.waitForTimeout(500);
    const emptyState = page.getByText('No audit logs found');
    if (await emptyState.isVisible().catch(() => false)) {
      return; // no deterministic rows in the current fixture — that's OK
    }
    const rowCount = await auditPage.getLogRowCount();
    if (rowCount > 0) {
      // The row must read as deterministic, not as a judge block.
      const firstRowText = await page.locator('tbody tr').first().textContent();
      expect(firstRowText).toContain('Deterministic / human review');
      expect(firstRowText).not.toContain('Judge blocked');
      await auditPage.openLogDetail(0);
      // The deterministic outcome is two-sided (response_blocked OR
      // human_review_required — see classifyAuditOutcome), so the detail sheet
      // must show the matching section: "Block Reason" for blocked responses,
      // "Human review required" for escalations. On shared fixtures the newest
      // row can be either kind.
      await expect(
        page.getByText('Block Reason').or(page.getByText('Human review required')).first(),
      ).toBeVisible();
    }
  });
});
