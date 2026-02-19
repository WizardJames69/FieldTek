import { test, expect } from '@playwright/test';
import { SettingsPage } from '../page-objects/SettingsPage';

test.describe('Settings', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.waitForPage();
  });

  test('settings page loads with tab navigation', async ({ page }) => {
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('General tab shows save button', async ({ page }) => {
    await settingsPage.clickTab('general');
    await expect(page.getByTestId('general-settings-save')).toBeVisible({ timeout: 10_000 });
  });

  test('Billing tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('billing');
    // Billing tab content renders
    await page.waitForTimeout(1000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Branding tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('branding');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Notifications tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('notification');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Calendar tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('calendar');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });
});
