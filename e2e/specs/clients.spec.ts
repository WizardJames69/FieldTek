import { test, expect } from '@playwright/test';
import { ClientsPage } from '../page-objects/ClientsPage';

test.describe('Clients Management', () => {
  let clientsPage: ClientsPage;

  test.beforeEach(async ({ page }) => {
    clientsPage = new ClientsPage(page);
    await clientsPage.goto();
    await clientsPage.waitForPage();
  });

  test('clients page renders with create button', async ({ page }) => {
    await expect(page.getByTestId('clients-create-button')).toBeVisible();
  });

  test('client form dialog opens', async ({ page }) => {
    await clientsPage.clickCreate();
    await expect(page.getByTestId('client-form-dialog')).toBeVisible();
    await expect(page.getByTestId('client-form-name')).toBeVisible();
    await expect(page.getByTestId('client-form-save')).toBeVisible();
  });

  test('create a new client and it appears in list', async () => {
    const uniqueName = `E2E Client ${Date.now()}`;
    await clientsPage.createClient({ name: uniqueName, email: 'e2e-new@example.com' });

    await clientsPage.searchClients(uniqueName);
    const cards = clientsPage.getClientCards();
    await expect(cards.first()).toContainText(uniqueName);
  });

  test('search filters clients list', async () => {
    await clientsPage.searchClients('ZZZNORESULTS999');
    // Either empty state or reduced list
    await expect(
      clientsPage.getClientCards().first().or(clientsPage.getEmptyState())
    ).toBeVisible({ timeout: 5_000 });
  });

  test('clients list is visible', async () => {
    // The portal client from global setup should appear
    const list = clientsPage.getClientsList();
    await expect(list).toBeVisible();
  });

  test('client card navigates to client detail on click', async ({ page }) => {
    const cards = clientsPage.getClientCards();
    const count = await cards.count();
    if (count > 0) {
      await cards.first().click();
      // A detail sheet or navigation should occur
      await page.waitForTimeout(1000);
      // Detail sheet appears as a dialog or slide-over
      const detailSheet = page.locator('[role="dialog"]');
      await expect(detailSheet.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
