import { Page, Locator, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

export class AdminFeatureFlagsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/feature-flags');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByRole('heading', { name: 'Feature Flags' })).toBeVisible({ timeout: 20_000 });
  }

  async searchFlags(query: string) {
    await this.page.getByPlaceholder('Search flags...').fill(query);
    await this.page.waitForTimeout(300); // debounce
  }

  getFlagRow(flagKey: string): Locator {
    return this.page.locator('tr').filter({ hasText: flagKey });
  }

  async toggleFlag(flagKey: string) {
    const row = this.getFlagRow(flagKey);
    await row.locator('button[role="switch"]').click();
  }

  async getStatCardValue(label: string): Promise<string> {
    const card = this.page.locator('div[class*="rounded"]').filter({ hasText: label }).first();
    const value = card.locator('.text-2xl, .text-xl').first();
    return (await value.textContent({ timeout: 10_000 })) ?? '';
  }

  async getFlagCount(): Promise<number> {
    return this.page.locator('tbody tr').count();
  }
}
