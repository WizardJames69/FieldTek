import { Page, Locator, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

/**
 * Page object for the platform-admin Lesson Review queue (/admin/lesson-review)
 * and the lesson-candidate intake flow that originates on the AI Audit Logs
 * page (/admin/ai-audit). Both surfaces are platform-admin-only.
 */
export class AdminLessonReviewPage {
  constructor(private page: Page) {}

  // ── Lesson Review queue ──────────────────────────────────────────────────
  async goto() {
    await this.page.goto('/admin/lesson-review');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByRole('heading', { name: 'Lesson Review' })).toBeVisible({
      timeout: 20_000,
    });
  }

  async filterByStatus(status: 'all' | 'pending' | 'approved' | 'rejected' | 'archived') {
    const valueMap = {
      all: 'All Statuses',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      archived: 'Archived',
    };
    await this.page.getByTestId('lesson-status-filter').click();
    await this.page.getByRole('option', { name: valueMap[status], exact: true }).click();
    await waitForDataLoad(this.page);
  }

  async search(query: string) {
    await this.page.getByTestId('lesson-search').fill(query);
    await this.page.waitForTimeout(300);
  }

  rows(): Locator {
    return this.page.getByTestId('lesson-row');
  }

  async rowCount(): Promise<number> {
    return this.rows().count();
  }

  async openFirstDetail() {
    await this.rows().first().getByTestId('lesson-view').click();
    await expect(this.page.getByRole('heading', { name: 'Lesson Candidate' })).toBeVisible();
  }

  /** Find the row containing the given question text and open its detail sheet. */
  async openDetailByText(text: string) {
    const row = this.rows().filter({ hasText: text }).first();
    await row.getByTestId('lesson-view').click();
    await expect(this.page.getByRole('heading', { name: 'Lesson Candidate' })).toBeVisible();
  }

  async approveWithNotes(notes: string) {
    await this.page.getByTestId('lesson-review-notes').fill(notes);
    await this.page.getByTestId('lesson-approve').click();
  }

  async rejectWithNotes(notes: string) {
    await this.page.getByTestId('lesson-review-notes').fill(notes);
    await this.page.getByTestId('lesson-reject').click();
  }

  async getStatCardValue(label: string): Promise<string> {
    const card = this.page.locator('div[class*="rounded"]').filter({ hasText: label }).first();
    return (await card.locator('.text-2xl, .text-xl').first().textContent({ timeout: 10_000 })) ?? '';
  }

  // ── Knowledge Base / Publish gating (PR-3b) ──────────────────────────────
  publishSection(): Locator {
    return this.page.getByTestId('lesson-publish-section');
  }

  publishButton(): Locator {
    return this.page.getByTestId('lesson-publish');
  }

  publishDisabledMessage(): Locator {
    return this.page.getByTestId('lesson-publish-disabled');
  }

  publishedState(): Locator {
    return this.page.getByTestId('lesson-published-state');
  }

  republishButton(): Locator {
    return this.page.getByTestId('lesson-republish');
  }

  unpublishButton(): Locator {
    return this.page.getByTestId('lesson-unpublish');
  }

  /** Click Publish and wait for the published state to appear. */
  async clickPublish() {
    await this.publishButton().click();
    await expect(this.publishedState()).toBeVisible({ timeout: 20_000 });
  }

  /** Open the Unpublish confirm dialog and confirm the removal. */
  async confirmUnpublish() {
    await this.unpublishButton().click();
    await expect(this.page.getByTestId('lesson-unpublish-dialog')).toBeVisible();
    await this.page.getByTestId('lesson-unpublish-confirm').click();
  }

  // ── Intake flow (originates on the AI Audit Logs page) ───────────────────
  async gotoAudit() {
    await this.page.goto('/admin/ai-audit');
    await waitForDataLoad(this.page);
    await expect(this.page.getByRole('heading', { name: 'AI Audit Logs' })).toBeVisible({
      timeout: 20_000,
    });
  }

  /** Open the detail sheet for the first audit log row. */
  async openFirstAuditDetail() {
    await this.page.locator('tbody tr').first().locator('button:has(svg.lucide-eye)').click();
    await expect(this.page.getByText('AI Interaction Details')).toBeVisible();
  }

  async clickCreateCandidate() {
    await this.page.getByTestId('audit-create-candidate').click();
    await expect(this.page.getByTestId('candidate-dialog')).toBeVisible();
  }

  async fillCandidate(opts: { question?: string; answer?: string; equipment?: string }) {
    if (opts.question !== undefined) await this.page.getByTestId('candidate-question').fill(opts.question);
    if (opts.answer !== undefined)
      await this.page.getByTestId('candidate-proposed-answer').fill(opts.answer);
    if (opts.equipment !== undefined)
      await this.page.getByTestId('candidate-equipment-type').fill(opts.equipment);
  }

  async submitCandidate() {
    await this.page.getByTestId('candidate-submit').click();
  }

  duplicateWarning(): Locator {
    return this.page.getByTestId('candidate-duplicate-warning');
  }
}
