import { test, expect } from '@playwright/test';

// Routes that redirect unauthenticated users to /auth.
// RoleGuard handles auth redirects for role-protected routes.
// FeatureGate-only routes (e.g. /equipment) rely on the page component's own auth guard.
const PROTECTED_ROUTES = [
  '/dashboard',
  '/jobs',
  '/equipment',
  '/schedule',
];

const ADMIN_ONLY_ROUTES = [
  '/clients',
  '/invoices',
  '/team',
  '/settings',
  '/reports',
];

test.describe('Navigation & Route Guards', () => {
  test.describe('Unauthenticated redirects', () => {
    // Clear the project-level storageState so these run as truly unauthenticated
    test.use({ storageState: { cookies: [], origins: [] } });

    for (const route of PROTECTED_ROUTES) {
      test(`unauthenticated access to ${route} redirects to /auth`, async ({ page }) => {
        await page.goto(route);
        await page.waitForURL(/\/auth/, { timeout: 10_000 });
        await expect(page).toHaveURL(/\/auth/);
      });
    }
  });

  test.describe('Admin user access', () => {
    test.use({ storageState: '.playwright/auth/admin.json' });

    test('admin can access /dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('admin can access /clients', async ({ page }) => {
      await page.goto('/clients');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page).toHaveURL(/\/clients/);
    });

    test('admin can access /invoices', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page).toHaveURL(/\/invoices/);
    });

    test('admin can access /team', async ({ page }) => {
      await page.goto('/team');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page).toHaveURL(/\/team/);
    });

    test('admin can access /settings', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page).toHaveURL(/\/settings/);
    });

    test('authenticated admin is not redirected from /dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      // Should NOT redirect to /auth
      await page.waitForTimeout(2000);
      await expect(page).not.toHaveURL(/\/auth/);
    });
  });

  test.describe('Technician role restrictions', () => {
    test.use({ storageState: '.playwright/auth/technician.json' });

    test('technician can access /dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      // Technician should be able to see dashboard
      await expect(page).not.toHaveURL(/\/auth/);
    });

    test('technician can access /jobs', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page).not.toHaveURL(/\/auth/);
    });

    test('technician can access /schedule', async ({ page }) => {
      await page.goto('/schedule');
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page).not.toHaveURL(/\/auth/);
    });

    test('technician is redirected or denied access to /clients', async ({ page }) => {
      await page.goto('/clients');
      // Wait for tenant data to load (RoleGuard shows skeleton until loaded)
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      // RoleGuard should redirect technician away from /clients
      await expect(page).not.toHaveURL(/\/clients/, { timeout: 15_000 });
      // After redirect chain completes, the page should render with content
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    });

    test('technician is redirected or denied access to /settings', async ({ page }) => {
      await page.goto('/settings');
      // Wait for tenant data to load (RoleGuard shows skeleton until loaded)
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      // RoleGuard should redirect technician away from /settings
      await expect(page).not.toHaveURL(/\/settings/, { timeout: 15_000 });
      // After redirect chain completes, the page should render with content
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('Sidebar navigation links', () => {
    test.use({ storageState: '.playwright/auth/admin.json' });

    test('sidebar nav dashboard link navigates correctly', async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('domcontentloaded');
      const navLink = page.getByTestId('sidebar-nav-dashboard');
      await expect(navLink).toBeVisible({ timeout: 10_000 });
      await navLink.click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    });

    test('sidebar nav jobs link navigates correctly', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      const navLink = page.getByTestId('sidebar-nav-jobs');
      await expect(navLink).toBeVisible({ timeout: 10_000 });
      await navLink.click();
      await expect(page).toHaveURL(/\/jobs/, { timeout: 10_000 });
    });

    test('sidebar sign-out button is present', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByTestId('sidebar-signout-button')).toBeVisible({ timeout: 10_000 });
    });
  });
});
