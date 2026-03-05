import { Page, Locator, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

const SELECTORS = {
  chatMessageUser: '[data-testid="chat-message-user"]',
  chatMessageAssistant: '[data-testid="chat-message-assistant"]',
  assistantLoading: '[data-testid="assistant-loading"]',
  sendMessageButton: '[data-testid="send-message-button"]',
  confidenceBadge: '[data-testid="confidence-badge"]',
  documentCitation: '[data-testid="document-citation"]',
  rateLimitDisplay: '[data-testid="rate-limit-display"]',
  clearJobContext: '[data-testid="clear-job-context"]',
  chatInput: '[data-testid="chat-input"]',
  emptyState: '[data-testid="assistant-empty-state"]',
} as const;

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
    await this.page.locator(SELECTORS.sendMessageButton).click();
  }

  async sendMessageAndWait(text: string, timeout = 45_000) {
    const countBefore = await this.page.locator(SELECTORS.chatMessageAssistant).count();
    await this.sendMessage(text);
    // Wait for user bubble to appear with the sent text
    await expect(
      this.page.locator(SELECTORS.chatMessageUser).last(),
    ).toContainText(text.substring(0, 20), { timeout: 10_000 });
    // Wait for new assistant message (count increased)
    await this.waitForResponse(countBefore + 1, timeout);
  }

  async waitForResponse(expectedCount: number, timeout = 30_000) {
    // Wait for assistant message count to reach expected value
    await expect(
      this.page.locator(SELECTORS.chatMessageAssistant),
    ).toHaveCount(expectedCount, { timeout });
    // Then wait for streaming to complete (loading indicator gone)
    await this.page
      .locator(SELECTORS.assistantLoading)
      .waitFor({ state: 'hidden', timeout })
      .catch(() => {}); // May already be gone
  }

  async getLastAssistantMessage(): Promise<string> {
    const messages = this.page.locator(SELECTORS.chatMessageAssistant);
    return (await messages.last().textContent()) ?? '';
  }

  async getLastUserMessage(): Promise<string> {
    const messages = this.page.locator(SELECTORS.chatMessageUser);
    return (await messages.last().textContent()) ?? '';
  }

  async selectJobContext(jobTitle: string) {
    await this.page.locator('button[role="combobox"]').click();
    await this.page.getByPlaceholder('Search jobs...').fill(jobTitle);
    await this.page.getByRole('option', { name: jobTitle }).click();
  }

  async clearJobContext() {
    const clearButton = this.page.locator(SELECTORS.clearJobContext);
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
    return this.page.locator(SELECTORS.confidenceBadge);
  }

  getCitationBadges(): Locator {
    return this.page.locator(SELECTORS.documentCitation);
  }

  getSuggestedQuestions(): Locator {
    return this.page.locator('button').filter({ hasText: /\?$/ });
  }

  getRateLimitDisplay(): Locator {
    return this.page.locator(SELECTORS.rateLimitDisplay);
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
    const user = await this.page.locator(SELECTORS.chatMessageUser).count();
    const assistant = await this.page.locator(SELECTORS.chatMessageAssistant).count();
    return user + assistant;
  }
}
