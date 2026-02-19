import { test, expect } from '@playwright/test';
import { PortalLoginPage } from '../page-objects/PortalLoginPage';

// Unauthenticated tests — explicitly clear any project-level storageState
test.describe('Customer Portal - Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let portalLogin: PortalLoginPage;

  test.beforeEach(async ({ page }) => {
    portalLogin = new PortalLoginPage(page);
  });

  test('portal login page renders', async ({ page }) => {
    await portalLogin.goto();
    await expect(page.getByTestId('portal-login-form')).toBeVisible();
    await expect(page.getByTestId('portal-login-email')).toBeVisible();
    await expect(page.getByTestId('portal-login-password')).toBeVisible();
    await expect(page.getByTestId('portal-login-submit')).toBeVisible();
  });

  test('portal login shows error for invalid credentials', async ({ page }) => {
    await portalLogin.goto();
    await page.getByTestId('portal-login-email').fill('notauser@example.com');
    await page.getByTestId('portal-login-password').fill('wrongpassword');
    await page.getByTestId('portal-login-submit').click();
    // Should stay on login page (not redirect)
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test('portal login requires valid email format', async ({ page }) => {
    await portalLogin.goto();
    await page.getByTestId('portal-login-email').fill('not-an-email');
    await page.getByTestId('portal-login-password').fill('password123');
    await page.getByTestId('portal-login-submit').click();
    // The input has type="email" so browser HTML5 validation prevents submission.
    // Either the native validation popup blocks it OR Zod shows the error.
    // In either case the URL must stay on /portal/login (no successful login).
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/portal\/login/);
  });
});

// Authenticated tests — uses portal-client.json storageState from the chromium-portal project
test.describe('Customer Portal - Authenticated', () => {
  test.use({ storageState: '.playwright/auth/portal-client.json' });

  test('portal dashboard loads after login', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('portal jobs tab is accessible', async ({ page }) => {
    await page.goto('/portal/jobs');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.locator('main')).toBeVisible();
  });

  test('portal invoices tab is accessible', async ({ page }) => {
    await page.goto('/portal/invoices');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.locator('main')).toBeVisible();
  });

  test('portal service request form is accessible', async ({ page }) => {
    await page.goto('/portal/request');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.locator('main')).toBeVisible();
  });
});
