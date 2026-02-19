import { Page, expect } from '@playwright/test';

/**
 * Waits for any toast notification to appear and optionally checks its text.
 * The app uses two toast systems:
 *   - shadcn/ui Radix toast: `li[role="status"][data-state="open"]` (ClientFormDialog, JobFormDialog, etc.)
 *   - Sonner toast: `[data-sonner-toast]` (EquipmentFormDialog)
 */
export async function waitForToast(page: Page, text?: string | RegExp): Promise<void> {
  const radixToast = page.locator('li[role="status"][data-state="open"]');
  const sonnerToast = page.locator('[data-sonner-toast]');
  const toastLocator = radixToast.or(sonnerToast);
  await expect(toastLocator.first()).toBeVisible({ timeout: 10_000 });
  if (text) {
    await expect(toastLocator.first()).toContainText(text);
  }
}

/**
 * Waits for a Radix Dialog or Sheet to close (aria-hidden or removed from DOM).
 */
export async function waitForDialogClose(page: Page): Promise<void> {
  await page
    .locator('[role="dialog"]')
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => {
      // Dialog may not use role="dialog" — fall through silently
    });
  // Brief pause for React state to settle
  await page.waitForTimeout(300);
}

/**
 * Waits for React Query to finish loading (no loading spinners visible).
 * Useful after navigation when data is being fetched.
 */
export async function waitForDataLoad(page: Page): Promise<void> {
  // Wait for any skeleton loaders or spinners to disappear
  await page
    .locator('.animate-pulse, [data-loading="true"]')
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {
      // Not all pages have loading indicators — OK to continue
    });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

/**
 * Navigates to a route and waits for the page to stabilize.
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  await waitForDataLoad(page);
}
