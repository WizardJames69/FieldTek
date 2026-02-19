import { test, expect } from '@playwright/test';
import { EquipmentPage } from '../page-objects/EquipmentPage';

test.describe('Equipment Registry', () => {
  let equipmentPage: EquipmentPage;

  test.beforeEach(async ({ page }) => {
    equipmentPage = new EquipmentPage(page);
    await equipmentPage.goto();
    await equipmentPage.waitForPage();
  });

  test('equipment page renders with create button', async ({ page }) => {
    await expect(page.getByTestId('equipment-create-button')).toBeVisible();
  });

  test('equipment form dialog opens', async ({ page }) => {
    await equipmentPage.clickCreate();
    await expect(page.getByTestId('equipment-form-dialog')).toBeVisible();
    await expect(page.getByTestId('equipment-form-brand')).toBeVisible();
    await expect(page.getByTestId('equipment-form-model')).toBeVisible();
    await expect(page.getByTestId('equipment-form-save')).toBeVisible();
  });

  test('equipment page content renders', async ({ page }) => {
    // Shows either the equipment table (if data exists) or the empty state
    await page.waitForTimeout(1000);
    const table = equipmentPage.getEquipmentTable();
    const emptyState = page.getByText(/no.*equipment.*found|start by adding/i).first();
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: 10_000 });
  });

  test('create equipment and it appears in table', async () => {
    await equipmentPage.createEquipment({ brand: 'E2E Carrier', model: 'E2E-TEST-001' });
    const rows = equipmentPage.getEquipmentRows();
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });
});
