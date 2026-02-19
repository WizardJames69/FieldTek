import { test, expect } from '@playwright/test';
import { AuthPage } from '../page-objects/AuthPage';
import { TEST_USERS } from '../helpers/test-data';

test.describe('Authentication', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('login form renders with correct fields', async ({ page }) => {
    await expect(page.getByTestId('auth-login-form')).toBeVisible();
    await expect(page.getByTestId('auth-email-input')).toBeVisible();
    await expect(page.getByTestId('auth-password-input')).toBeVisible();
    await expect(page.getByTestId('auth-submit-button')).toBeVisible();
  });

  test('login with valid credentials redirects to app', async () => {
    await authPage.login(TEST_USERS.admin.email, TEST_USERS.admin.password);
    await authPage.expectRedirectToDashboard();
  });

  test('login with invalid email shows validation error', async ({ page }) => {
    await page.getByTestId('auth-email-input').fill('not-an-email');
    await page.getByTestId('auth-password-input').fill('somepassword');
    await page.getByTestId('auth-submit-button').click();
    // Form should remain visible — not redirect
    await expect(page.getByTestId('auth-login-form')).toBeVisible();
  });

  test('login with wrong password stays on auth page', async ({ page }) => {
    await page.getByTestId('auth-email-input').fill(TEST_USERS.admin.email);
    await page.getByTestId('auth-password-input').fill('WrongPassword999!');
    await page.getByTestId('auth-submit-button').click();
    // Should not redirect to dashboard
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/auth');
  });

  test('submit button shows loading state during login', async ({ page }) => {
    await page.getByTestId('auth-email-input').fill(TEST_USERS.admin.email);
    await page.getByTestId('auth-password-input').fill(TEST_USERS.admin.password);
    await page.getByTestId('auth-submit-button').click();
    // Button text changes to loading state (briefly)
    await expect(page.getByTestId('auth-submit-button')).toBeDisabled();
  });

  test('forgot password button navigates to reset page', async ({ page }) => {
    // Auth.tsx renders a Button with variant="link" (a <button>, not an <a> tag)
    await page.getByRole('button', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/forgot-password/, { timeout: 10_000 });
  });
});
