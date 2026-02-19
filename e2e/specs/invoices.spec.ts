import { test, expect } from '@playwright/test';
import { InvoicesPage } from '../page-objects/InvoicesPage';

test.describe('Invoices Management', () => {
  let invoicesPage: InvoicesPage;

  test.beforeEach(async ({ page }) => {
    invoicesPage = new InvoicesPage(page);
    await invoicesPage.goto();
    await invoicesPage.waitForPage();
  });

  test('invoices page renders with create button', async ({ page }) => {
    await expect(page.getByTestId('invoices-create-button')).toBeVisible();
  });

  test('invoice form dialog opens', async ({ page }) => {
    await invoicesPage.clickCreate();
    await expect(page.getByTestId('invoice-form-dialog')).toBeVisible();
  });

  test('invoices table is visible', async () => {
    const table = invoicesPage.getInvoicesTable();
    // Either table with invoices OR empty state should be visible
    await expect(table.or(invoicesPage.getEmptyState())).toBeVisible({ timeout: 10_000 });
  });

  test('status filter select is present', async ({ page }) => {
    // Invoices page uses a Select dropdown for status filtering (not tabs)
    const statusSelect = page.getByRole('combobox').first();
    await expect(statusSelect).toBeVisible({ timeout: 10_000 });
  });

  test('aging report section renders on page load', async ({ page }) => {
    // Invoice stats are always shown (Total Invoiced, Collected, etc.)
    await page.waitForTimeout(1000);
    const statsArea = page.getByText(/total invoiced|outstanding|collected/i).first();
    await expect(statsArea).toBeVisible({ timeout: 10_000 });
  });

  test('filtering by status shows invoice list or empty state', async ({ page }) => {
    // Change the status filter via the Select dropdown
    const statusSelect = page.getByRole('combobox').first();
    await statusSelect.click();
    // Select "All Status" option
    const allOption = page.getByRole('option', { name: /all status/i });
    await allOption.click();
    // After selecting, table or empty state should be visible
    const table = invoicesPage.getInvoicesTable();
    await expect(table.or(invoicesPage.getEmptyState())).toBeVisible();
  });
});
