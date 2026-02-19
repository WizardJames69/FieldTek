import { Page, expect } from '@playwright/test';
import { waitForDataLoad, waitForDialogClose, waitForToast } from '../helpers/wait-helpers';

interface JobFormData {
  title: string;
  status?: string;
  priority?: string;
  description?: string;
}

export class JobsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/jobs');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByTestId('jobs-create-button')).toBeVisible({ timeout: 15_000 });
  }

  async clickCreate() {
    await this.page.getByTestId('jobs-create-button').click();
    await expect(this.page.getByTestId('job-form-dialog')).toBeVisible({ timeout: 10_000 });
  }

  async fillJobForm({ title, status, priority, description }: JobFormData) {
    await this.page.getByTestId('job-form-title').fill(title);
    if (status) {
      await this.page.getByTestId('job-form-status').click();
      await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
    }
    if (priority) {
      await this.page.getByTestId('job-form-priority').click();
      await this.page.getByRole('option', { name: new RegExp(priority, 'i') }).click();
    }
    if (description) {
      await this.page.getByLabel(/description/i).fill(description);
    }
  }

  async saveJob() {
    await this.page.getByTestId('job-form-save').click();
    await waitForDialogClose(this.page);
    await waitForToast(this.page);
  }

  async createJob(data: JobFormData) {
    await this.clickCreate();
    await this.fillJobForm(data);
    await this.saveJob();
  }

  async searchJobs(query: string) {
    await this.page.getByTestId('jobs-search-input').fill(query);
    await this.page.waitForTimeout(500); // debounce
  }

  async filterByStatus(status: string) {
    await this.page.getByTestId('jobs-status-filter').click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
    await this.page.waitForTimeout(300);
  }

  getJobCards() {
    return this.page.getByTestId('job-card');
  }

  getEmptyState() {
    return this.page.getByTestId('jobs-empty-state');
  }

  getJobsList() {
    return this.page.getByTestId('jobs-list');
  }

  async openJob(titleText: string) {
    await this.page.getByTestId('jobs-list').getByText(titleText).first().click();
  }
}
