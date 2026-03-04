import { Page, Locator, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

export class AdminAIAuditLogsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/ai-audit');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByText('AI Audit Logs')).toBeVisible({ timeout: 20_000 });
  }

  async searchLogs(query: string) {
    await this.page.getByPlaceholder('Search messages, responses, equipment...').fill(query);
    await this.page.waitForTimeout(300);
  }

  async filterByStatus(status: 'all' | 'blocked' | 'passed') {
    const select = this.page.locator('select').first();
    const valueMap = { all: 'All Interactions', blocked: 'Blocked Only', passed: 'Passed Only' };
    await select.selectOption({ label: valueMap[status] });
    await waitForDataLoad(this.page);
  }

  async openLogDetail(rowIndex: number) {
    const row = this.page.locator('tbody tr').nth(rowIndex);
    await row.locator('button:has(svg.lucide-eye)').click();
    await expect(this.page.getByText('AI Interaction Details')).toBeVisible();
  }

  async closeLogDetail() {
    await this.page.locator('[data-testid="sheet-close"], button:has(svg.lucide-x)').first().click();
  }

  async getStatCardValue(label: string): Promise<string> {
    const card = this.page.locator('.card').filter({ hasText: label });
    const value = card.locator('.text-2xl, .text-xl').first();
    return (await value.textContent()) ?? '';
  }

  async isDetailSheetOpen(): Promise<boolean> {
    return this.page.getByText('AI Interaction Details').isVisible();
  }

  async getLogRowCount(): Promise<number> {
    return this.page.locator('tbody tr').count();
  }
}
