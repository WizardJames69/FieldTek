import { Page, expect } from '@playwright/test';
import { waitForDataLoad, waitForDialogClose, waitForToast } from '../helpers/wait-helpers';

export class InvoicesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/invoices');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByTestId('invoices-create-button')).toBeVisible({ timeout: 15_000 });
  }

  async clickCreate() {
    await this.page.getByTestId('invoices-create-button').click();
    await expect(this.page.getByTestId('invoice-form-dialog')).toBeVisible({ timeout: 10_000 });
  }

  async saveInvoice() {
    await this.page.getByTestId('invoice-form-save').click();
    await waitForDialogClose(this.page);
    await waitForToast(this.page);
  }

  async filterByStatus(status: 'all' | 'draft' | 'sent' | 'paid' | 'overdue') {
    // Status filter is implemented as tab triggers
    await this.page.getByRole('tab', { name: new RegExp(status, 'i') }).click();
    await this.page.waitForTimeout(300);
  }

  getInvoiceRows() {
    return this.page.getByTestId('invoice-row');
  }

  getInvoicesTable() {
    return this.page.getByTestId('invoices-table');
  }

  getEmptyState() {
    return this.page.getByTestId('invoices-empty-state');
  }
}
