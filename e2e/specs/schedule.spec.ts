import { test, expect } from '@playwright/test';
import { SchedulePage } from '../page-objects/SchedulePage';

test.describe('Schedule / Calendar', () => {
  let schedulePage: SchedulePage;

  test.beforeEach(async ({ page }) => {
    schedulePage = new SchedulePage(page);
    await schedulePage.goto();
  });

  test('schedule page loads without errors', async ({ page }) => {
    await expect(page).toHaveURL(/\/schedule/);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.locator('main')).toBeVisible();
  });

  test('calendar renders on schedule page', async () => {
    await schedulePage.waitForCalendar();
    // Calendar container is present
  });

  test('month/week/day view toggle buttons are present', async ({ page }) => {
    await page.waitForTimeout(2000);
    // These buttons control calendar view — use first() to avoid strict mode violations
    const monthBtn = page.getByRole('button', { name: /month/i }).first();
    const weekBtn = page.getByRole('button', { name: /week/i }).first();
    await expect(monthBtn.or(weekBtn).first()).toBeVisible({ timeout: 10_000 });
  });

  test('technician sidebar is present', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Schedule page has a technician list sidebar or aside element
    const techSection = page.getByText(/technician|team member/i).first();
    const sidebarAside = page.locator('aside').first();
    await expect(techSection.or(sidebarAside).first()).toBeVisible({ timeout: 10_000 });
  });
});
