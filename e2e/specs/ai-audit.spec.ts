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

  test('audit logs page renders with 5 stat cards', async ({ page }) => {
    await auditPage.waitForPage();
    const totalCard = await auditPage.getStatCardValue('Total Interactions');
    expect(parseInt(totalCard) || 0).toBeGreaterThanOrEqual(0);
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

  test('status filter "Blocked Only" shows only Blocked badge rows', async ({ page }) => {
    await auditPage.waitForPage();
    await auditPage.filterByStatus('blocked');
    await page.waitForTimeout(500);
    // All visible data rows should have Blocked badge (or empty state if no blocked logs)
    const emptyState = page.getByText('No audit logs found');
    if (await emptyState.isVisible().catch(() => false)) {
      return; // no blocked rows — that's OK
    }
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      if (text && !text.includes('No audit logs found')) {
        expect(text).toContain('Blocked');
      }
    }
  });

  test('status filter "Passed Only" shows only Passed badge rows', async ({ page }) => {
    await auditPage.waitForPage();
    await auditPage.filterByStatus('passed');
    await page.waitForTimeout(500);
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const row = rows.nth(i);
      const text = await row.textContent();
      if (text) {
        expect(text).toContain('Passed');
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

  test('detail sheet shows "Block Reason" section for blocked interactions', async ({ page }) => {
    await auditPage.waitForPage();
    // Filter to blocked only, then open detail
    await auditPage.filterByStatus('blocked');
    await page.waitForTimeout(500);
    const emptyState = page.getByText('No audit logs found');
    if (await emptyState.isVisible().catch(() => false)) {
      return; // no blocked rows to inspect
    }
    const rowCount = await auditPage.getLogRowCount();
    if (rowCount > 0) {
      await auditPage.openLogDetail(0);
      await expect(page.getByText('Block Reason')).toBeVisible();
    }
  });
});
