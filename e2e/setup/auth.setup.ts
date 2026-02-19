/**
 * auth.setup.ts — Playwright setup test
 *
 * Runs under the `setup` project (after webServer is ready).
 * Logs in as each test user via the UI and saves browser storage states
 * so all other test projects can reuse them without logging in again.
 *
 * Storage states saved:
 *   .playwright/auth/admin.json         — admin/owner user
 *   .playwright/auth/technician.json    — technician user
 *   .playwright/auth/portal-client.json — customer portal user
 *   .playwright/auth/platform-admin.json — platform admin user
 */
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { TEST_USERS } from '../helpers/test-data';

const AUTH_DIR = path.join(process.cwd(), '.playwright', 'auth');

setup.beforeAll(() => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
});

setup('save admin auth state', async ({ page }) => {
  await page.goto('/auth');
  await page.getByTestId('auth-email-input').fill(TEST_USERS.admin.email);
  await page.getByTestId('auth-password-input').fill(TEST_USERS.admin.password);
  await page.getByTestId('auth-submit-button').click();

  // Wait until redirected away from /auth (to /dashboard or /onboarding)
  await page.waitForURL(
    (url) => !url.pathname.includes('/auth'),
    { timeout: 30_000 }
  );

  await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') });
  console.log('[auth.setup] ✓ Saved admin.json');
});

setup('save technician auth state', async ({ page }) => {
  await page.goto('/auth');
  await page.getByTestId('auth-email-input').fill(TEST_USERS.technician.email);
  await page.getByTestId('auth-password-input').fill(TEST_USERS.technician.password);
  await page.getByTestId('auth-submit-button').click();

  await page.waitForURL(
    (url) => !url.pathname.includes('/auth'),
    { timeout: 30_000 }
  );

  await page.context().storageState({ path: path.join(AUTH_DIR, 'technician.json') });
  console.log('[auth.setup] ✓ Saved technician.json');
});

setup('save portal-client auth state', async ({ page }) => {
  await page.goto('/portal/login');
  await page.getByTestId('portal-login-email').fill(TEST_USERS.portalClient.email);
  await page.getByTestId('portal-login-password').fill(TEST_USERS.portalClient.password);
  await page.getByTestId('portal-login-submit').click();

  // Portal redirects to /portal after successful login
  await page.waitForURL(
    (url) => !url.pathname.includes('/login'),
    { timeout: 30_000 }
  );

  await page.context().storageState({ path: path.join(AUTH_DIR, 'portal-client.json') });
  console.log('[auth.setup] ✓ Saved portal-client.json');
});

setup('save platform-admin auth state', async ({ page }) => {
  // Must use /admin/login so AdminLogin.tsx validates platform admin status
  // and redirects to /admin (not to /dashboard or /onboarding)
  await page.goto('/admin/login');
  await page.getByTestId('admin-login-email').fill(TEST_USERS.platformAdmin.email);
  await page.getByTestId('admin-login-password').fill(TEST_USERS.platformAdmin.password);
  await page.getByTestId('admin-login-submit').click();

  await page.waitForURL(
    (url) => url.pathname.startsWith('/admin') && !url.pathname.includes('/login'),
    { timeout: 30_000 }
  );

  await page.context().storageState({ path: path.join(AUTH_DIR, 'platform-admin.json') });
  console.log('[auth.setup] ✓ Saved platform-admin.json');
});
