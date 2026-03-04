import { Page, Locator, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

export class AssistantPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/assistant');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByText('AI Field Assistant')).toBeVisible({ timeout: 20_000 });
  }

  async sendMessage(text: string) {
    const input = this.page.getByPlaceholder('Ask about troubleshooting');
    await input.fill(text);
    await this.page.locator('button:has(svg.lucide-send)').click();
  }

  async waitForResponse(timeout = 30_000) {
    // Wait for an assistant message bubble to appear
    await expect(
      this.page.locator('[data-role="assistant"]').last(),
    ).toBeVisible({ timeout });
  }

  async getLastAssistantMessage(): Promise<string> {
    const messages = this.page.locator('[data-role="assistant"]');
    return (await messages.last().textContent()) ?? '';
  }

  async getLastUserMessage(): Promise<string> {
    const messages = this.page.locator('[data-role="user"]');
    return (await messages.last().textContent()) ?? '';
  }

  async selectJobContext(jobTitle: string) {
    await this.page.locator('button[role="combobox"]').click();
    await this.page.getByPlaceholder('Search jobs...').fill(jobTitle);
    await this.page.getByRole('option', { name: jobTitle }).click();
  }

  async clearJobContext() {
    // Click the X button on the context indicator
    const clearButton = this.page.locator('[data-testid="clear-job-context"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  }

  async clearConversation() {
    await this.page.getByRole('button', { name: /New Chat/i }).click();
  }

  async toggleCodeReference(on: boolean) {
    const toggle = this.page.locator('button:has-text("Code Ref")');
    const isActive = await toggle.getAttribute('data-state');
    if ((on && isActive !== 'on') || (!on && isActive === 'on')) {
      await toggle.click();
    }
  }

  getConfidenceBadge(): Locator {
    return this.page.locator('text=/High confidence|Medium confidence|Low confidence/');
  }

  getCitationBadges(): Locator {
    return this.page.locator('[data-testid="document-citation"]');
  }

  getSuggestedQuestions(): Locator {
    return this.page.locator('button').filter({ hasText: /\?$/ });
  }

  getRateLimitDisplay(): Locator {
    return this.page.locator('text=/\\d+\\/\\d+\\s+today/');
  }

  async isNoDocsWarningVisible(): Promise<boolean> {
    return this.page.getByText('No Documentation Uploaded').isVisible();
  }

  async isDocsAvailableVisible(): Promise<boolean> {
    return this.page.getByText(/Document\(s\) Available/).isVisible();
  }

  async isRateLimitWarningVisible(): Promise<boolean> {
    return this.page.getByText('Daily limit reached').isVisible();
  }

  async getMessageCount(): Promise<number> {
    const user = await this.page.locator('[data-role="user"]').count();
    const assistant = await this.page.locator('[data-role="assistant"]').count();
    return user + assistant;
  }
}
