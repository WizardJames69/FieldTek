import { Page, Locator, expect } from '@playwright/test';

type MyJobsTab = 'Today' | 'Upcoming' | 'Completed';

/**
 * Page object for the technician My Jobs screen (/my-jobs).
 *
 * Selectors lean on roles/labels that don't shift with industry terminology:
 * the three view tabs are Radix `role="tab"` triggers, the job detail opens in a
 * Radix Sheet (`role="dialog"`) titled with the job name, and the offline status
 * panel surfaces stable copy ("Offline Mode", "All synced").
 */
export class MyJobsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/my-jobs');
    await this.waitForLoaded();
  }

  /** Tabs render above the data, so this resolves even while jobs are loading. */
  async waitForLoaded() {
    await expect(this.tab('Today')).toBeVisible({ timeout: 20_000 });
  }

  tab(name: MyJobsTab): Locator {
    return this.page.getByRole('tab', { name: new RegExp(name, 'i') });
  }

  async selectTab(name: MyJobsTab) {
    await this.tab(name).click();
  }

  /** First on-screen occurrence of a job's title (the card in the active list). */
  jobCard(title: string): Locator {
    return this.page.getByText(title).first();
  }

  async openJob(title: string) {
    await this.jobCard(title).click();
  }

  /** The job detail Sheet (Radix dialog). */
  sheet(): Locator {
    return this.page.getByRole('dialog');
  }

  /** The "Back to My Jobs" control inside the detail sheet. */
  backButton(): Locator {
    return this.page.getByRole('button', { name: /back to my jobs/i });
  }

  async closeJob() {
    await this.backButton().click();
  }

  errorState(): Locator {
    return this.page.getByTestId('my-jobs-error-state');
  }
}
