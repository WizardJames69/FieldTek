import { test as base, Page } from '@playwright/test';

type AuthFixtures = {
  /** Page pre-authenticated as the admin/owner user */
  adminPage: Page;
  /** Page pre-authenticated as the technician user */
  technicianPage: Page;
};

/**
 * Extended test fixture that provides pre-authenticated pages.
 * The auth states are loaded from .playwright/auth/*.json (written by global-setup).
 *
 * Usage:
 *   import { test } from '../fixtures';
 *   test('my test', async ({ adminPage }) => { ... });
 */
export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: '.playwright/auth/admin.json',
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  technicianPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: '.playwright/auth/technician.json',
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
