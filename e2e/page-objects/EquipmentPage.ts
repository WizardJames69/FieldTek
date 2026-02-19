import { Page, expect } from '@playwright/test';
import { waitForDataLoad, waitForDialogClose, waitForToast } from '../helpers/wait-helpers';

interface EquipmentFormData {
  brand: string;
  model: string;
  type?: string; // Equipment type — required by the form; defaults to 'Air Handler'
}

export class EquipmentPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/equipment');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByTestId('equipment-create-button')).toBeVisible({ timeout: 15_000 });
  }

  async clickCreate() {
    await this.page.getByTestId('equipment-create-button').click();
    await expect(this.page.getByTestId('equipment-form-dialog')).toBeVisible({ timeout: 10_000 });
  }

  async fillEquipmentForm({ brand, model, type = 'Air Handler' }: EquipmentFormData) {
    // Select the required equipment type
    await this.page.getByTestId('equipment-form-type').click();
    await this.page.getByRole('option', { name: type }).click();
    await this.page.getByTestId('equipment-form-brand').fill(brand);
    await this.page.getByTestId('equipment-form-model').fill(model);
  }

  async saveEquipment() {
    await this.page.getByTestId('equipment-form-save').click();
    await waitForDialogClose(this.page);
    await waitForToast(this.page);
  }

  async createEquipment(data: EquipmentFormData) {
    await this.clickCreate();
    await this.fillEquipmentForm(data);
    await this.saveEquipment();
  }

  getEquipmentRows() {
    return this.page.getByTestId('equipment-row');
  }

  getEquipmentTable() {
    return this.page.getByTestId('equipment-table');
  }
}
