import { test, expect } from '@playwright/test';
import { DashboardPage } from '../page-objects/DashboardPage';

test.describe('Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
  });

  test('dashboard page loads and shows main container', async () => {
    await dashboardPage.waitForPage();
    await expect(dashboardPage.statsGrid).toBeVisible();
  });

  test('stats grid shows 4 stat cards', async ({ page }) => {
    await dashboardPage.waitForPage();
    await dashboardPage.waitForStatsLoad();
    const grid = page.getByTestId('dashboard-stats-grid');
    await expect(grid).toBeVisible({ timeout: 10_000 });
    // Grid renders exactly 4 Card3D wrappers as direct children
    await expect(grid.locator('> *')).toHaveCount(4, { timeout: 10_000 });
  });

  test("today's jobs card is visible", async () => {
    await dashboardPage.waitForPage();
    await expect(dashboardPage.todaysJobsCard).toBeVisible();
  });

  test('service requests card is visible', async () => {
    await dashboardPage.waitForPage();
    await expect(dashboardPage.serviceRequestsCard).toBeVisible();
  });

  test('sidebar navigation links are present', async ({ page }) => {
    await dashboardPage.waitForPage();
    await expect(page.getByTestId('sidebar-nav-jobs')).toBeVisible();
    await expect(page.getByTestId('sidebar-nav-clients')).toBeVisible();
    await expect(page.getByTestId('sidebar-nav-schedule')).toBeVisible();
  });

  test('navigating via sidebar goes to jobs page', async ({ page }) => {
    await dashboardPage.waitForPage();
    await page.getByTestId('sidebar-nav-jobs').click();
    await expect(page).toHaveURL(/\/jobs/);
  });
});
