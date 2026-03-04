import { Page, Locator, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

export class AdminRAGQualityPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/rag-quality');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByText('RAG Quality Dashboard')).toBeVisible({ timeout: 20_000 });
  }

  async selectDateRange(label: '7d' | '30d' | '90d') {
    await this.page.getByRole('tab', { name: label }).click();
    await waitForDataLoad(this.page);
  }

  async switchTab(name: 'Overview' | 'Retrieval' | 'Judge' | 'Compliance' | 'Workflow') {
    await this.page.getByRole('tab', { name, exact: true }).click();
    await waitForDataLoad(this.page);
  }

  async getStatCardValue(title: string): Promise<string> {
    const card = this.page.locator('.card').filter({ hasText: title });
    const value = card.locator('.text-2xl, .text-xl').first();
    return (await value.textContent()) ?? '';
  }

  async isChartVisible(): Promise<boolean> {
    return this.page.locator('.recharts-responsive-container').first().isVisible();
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return this.page.locator('.text-muted-foreground').filter({ hasText: /No .* found|No .* data/ }).first().isVisible();
  }

  getFailurePathsTable(): Locator {
    return this.page.locator('table').filter({ hasText: 'Symptom' });
  }
}
