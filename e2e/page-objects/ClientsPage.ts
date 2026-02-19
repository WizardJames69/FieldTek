import { Page, expect } from '@playwright/test';
import { waitForDataLoad, waitForDialogClose, waitForToast } from '../helpers/wait-helpers';

interface ClientFormData {
  name: string;
  email?: string;
  phone?: string;
}

export class ClientsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/clients');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByTestId('clients-create-button')).toBeVisible({ timeout: 15_000 });
  }

  async clickCreate() {
    await this.page.getByTestId('clients-create-button').click();
    await expect(this.page.getByTestId('client-form-dialog')).toBeVisible({ timeout: 10_000 });
  }

  async fillClientForm({ name, email, phone }: ClientFormData) {
    await this.page.getByTestId('client-form-name').fill(name);
    if (email) await this.page.getByTestId('client-form-email').fill(email);
    if (phone) await this.page.getByLabel(/phone/i).fill(phone);
  }

  async saveClient() {
    await this.page.getByTestId('client-form-save').click();
    await waitForDialogClose(this.page);
    await waitForToast(this.page);
  }

  async createClient(data: ClientFormData) {
    await this.clickCreate();
    await this.fillClientForm(data);
    await this.saveClient();
  }

  async searchClients(query: string) {
    await this.page.getByTestId('clients-search-input').fill(query);
    await this.page.waitForTimeout(500);
  }

  getClientCards() {
    return this.page.getByTestId('client-card');
  }

  getEmptyState() {
    return this.page.getByTestId('clients-empty-state');
  }

  getClientsList() {
    return this.page.getByTestId('clients-list');
  }
}
