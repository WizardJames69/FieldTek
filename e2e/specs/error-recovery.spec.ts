import { test, expect } from '@playwright/test';

/**
 * PR-H2 regression: when a data fetch fails, the UI must show an actionable
 * error + "Try again" — never a silent zeros/empty state that looks like real
 * "no data". Uses route interception to force a failure, then verifies recovery.
 */
test.describe('Query error states', () => {
  test.use({ storageState: '.playwright/auth/admin.json' });

  test('Dashboard stats show an error + Try again when the stats RPC fails (not zeros)', async ({ page }) => {
    // Force the dashboard stats RPC to fail for every react-query attempt.
    await page.route('**/rest/v1/rpc/get_dashboard_stats', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'forced failure for test' }),
      })
    );

    await page.goto('/dashboard');

    // The dashboard itself rendered (not a blank screen)...
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: 20_000 });

    // ...and the stats section shows an actionable error instead of a zeros grid.
    const errorPanel = page.getByTestId('dashboard-stats-error');
    await expect(errorPanel).toBeVisible({ timeout: 20_000 });
    const retry = errorPanel.getByRole('button', { name: /try again/i });
    await expect(retry).toBeVisible();
    await expect(page.getByTestId('dashboard-stats-grid')).toHaveCount(0);

    // Recover: stop failing, click Try again, the stats grid returns.
    await page.unroute('**/rest/v1/rpc/get_dashboard_stats');
    await retry.click();
    await expect(page.getByTestId('dashboard-stats-grid')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('dashboard-stats-error')).toHaveCount(0);
  });
});
