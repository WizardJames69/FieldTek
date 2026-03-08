import { Page, Locator, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

export class AdminAIAuditLogsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/ai-audit');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByRole('heading', { name: 'AI Audit Logs' })).toBeVisible({ timeout: 20_000 });
  }

  async searchLogs(query: string) {
    await this.page.getByPlaceholder('Search messages, responses, equipment...').fill(query);
    await this.page.waitForTimeout(300);
  }

  async filterByStatus(status: 'all' | 'blocked' | 'passed') {
    const valueMap = { all: 'All Interactions', blocked: 'Blocked Only', passed: 'Passed Only' };
    // shadcn Select renders as a custom button trigger, not native <select>
    const trigger = this.page.locator('button[role="combobox"]').first();
    await trigger.click();
    await this.page.getByRole('option', { name: valueMap[status] }).click();
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
    const card = this.page.locator('div[class*="rounded"]').filter({ hasText: label }).first();
    const value = card.locator('.text-2xl, .text-xl').first();
    return (await value.textContent({ timeout: 10_000 })) ?? '';
  }

  async isDetailSheetOpen(): Promise<boolean> {
    return this.page.getByText('AI Interaction Details').isVisible();
  }

  async getLogRowCount(): Promise<number> {
    return this.page.locator('tbody tr').count();
  }
}
