import { test, expect } from '@playwright/test';
import { AdminLoginPage } from '../page-objects/AdminLoginPage';

test.describe('Platform Admin', () => {
  let adminLogin: AdminLoginPage;

  test.beforeEach(async ({ page }) => {
    adminLogin = new AdminLoginPage(page);
  });

  test.describe('Admin Login', () => {
    // Clear project-level storageState — the saved platform-admin session causes
    // AdminLogin.tsx checkExistingSession() to auto-redirect to /admin on mount.
    test.use({ storageState: { cookies: [], origins: [] } });

    test('admin login page renders', async ({ page }) => {
      await adminLogin.goto();
      await expect(page.getByTestId('admin-login-email')).toBeVisible();
      await expect(page.getByTestId('admin-login-password')).toBeVisible();
      await expect(page.getByTestId('admin-login-submit')).toBeVisible();
    });

    test('admin login shows error for invalid credentials', async ({ page }) => {
      await adminLogin.goto();
      await page.getByTestId('admin-login-email').fill('notanadmin@example.com');
      await page.getByTestId('admin-login-password').fill('wrongpassword');
      await page.getByTestId('admin-login-submit').click();
      // Should stay on admin login page
      await page.waitForTimeout(3000);
      await expect(page).toHaveURL(/\/admin\/login/);
    });

    test('admin login redirects non-platform-admin users', async ({ page }) => {
      await adminLogin.goto();
      // A regular tenant user should not be able to access the admin panel
      await page.getByTestId('admin-login-email').fill(
        process.env.E2E_ADMIN_EMAIL || 'e2e-admin@fieldtek-test.dev'
      );
      await page.getByTestId('admin-login-password').fill(
        process.env.E2E_ADMIN_PASSWORD || 'E2eAdmin123!Test'
      );
      await page.getByTestId('admin-login-submit').click();
      // Regular admin is NOT a platform admin — should be rejected
      await page.waitForTimeout(3000);
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  });

  test.describe('Authenticated admin panel', () => {
    test.use({ storageState: '.playwright/auth/platform-admin.json' });

    test('platform admin dashboard renders', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      // Redirects to /admin/dashboard or similar
      await expect(page.locator('main, [data-testid="admin-dashboard-page"]')).toBeVisible({ timeout: 10_000 });
    });

    test('tenants page is accessible', async ({ page }) => {
      await page.goto('/admin/tenants');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page.locator('main')).toBeVisible();
      // Tenants heading visible
      await expect(page.getByText(/tenant/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('feature flags page is accessible', async ({ page }) => {
      await page.goto('/admin/feature-flags');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByText(/feature/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('demo requests page is accessible', async ({ page }) => {
      await page.goto('/admin/demo-requests');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page.locator('main')).toBeVisible();
    });

    test('beta applications page is accessible', async ({ page }) => {
      await page.goto('/admin/beta-applications');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page.locator('main')).toBeVisible();
    });

    test('analytics page is accessible', async ({ page }) => {
      await page.goto('/admin/analytics');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page.locator('main')).toBeVisible();
    });

    test('system health page is accessible', async ({ page }) => {
      await page.goto('/admin/system-health');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page.locator('main')).toBeVisible();
    });
  });
});
