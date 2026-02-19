import { Page, expect } from '@playwright/test';
import { waitForDataLoad, waitForToast } from '../helpers/wait-helpers';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await this.page.waitForSelector('[role="tablist"]', { timeout: 15_000 });
  }

  async clickTab(name: string) {
    await this.page.getByRole('tab', { name: new RegExp(name, 'i') }).click();
    await this.page.waitForTimeout(300);
  }

  async saveGeneralSettings() {
    await this.page.getByTestId('general-settings-save').click();
    await waitForToast(this.page);
  }
}
