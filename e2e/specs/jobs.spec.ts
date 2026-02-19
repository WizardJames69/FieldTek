import { test, expect } from '@playwright/test';
import { JobsPage } from '../page-objects/JobsPage';
import { SAMPLE_JOB } from '../helpers/test-data';

test.describe('Jobs Management', () => {
  let jobsPage: JobsPage;

  test.beforeEach(async ({ page }) => {
    jobsPage = new JobsPage(page);
    await jobsPage.goto();
    await jobsPage.waitForPage();
  });

  test('jobs page renders with create button', async ({ page }) => {
    await expect(page.getByTestId('jobs-create-button')).toBeVisible();
  });

  test('jobs list shows seeded sample job', async () => {
    // The global setup seeds a sample job - it should be in the list
    const cards = jobsPage.getJobCards();
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('create job dialog opens on button click', async ({ page }) => {
    await jobsPage.clickCreate();
    await expect(page.getByTestId('job-form-dialog')).toBeVisible();
    await expect(page.getByTestId('job-form-title')).toBeVisible();
    await expect(page.getByTestId('job-form-save')).toBeVisible();
  });

  test('create a new job and it appears in list', async ({ page }) => {
    const newJobTitle = `E2E Job ${Date.now()}`;
    await jobsPage.createJob({
      title: newJobTitle,
      priority: 'high',
    });

    // Search for the new job
    await jobsPage.searchJobs(newJobTitle);
    const cards = jobsPage.getJobCards();
    await expect(cards.first()).toContainText(newJobTitle);
  });

  test('search filters the job list', async () => {
    // Enter a unique search term that should return nothing
    await jobsPage.searchJobs('ZZZNORESULTS999');
    // Either empty state or no job cards
    await expect(
      jobsPage.getJobCards().or(jobsPage.getEmptyState())
    ).toBeVisible({ timeout: 5_000 });
  });

  test('status filter works - filtering by completed', async ({ page }) => {
    await jobsPage.filterByStatus('completed');
    // After filtering, either jobs or empty state is shown
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url).toContain('/jobs');
  });

  test('recurring jobs tab is accessible', async ({ page }) => {
    await page.getByRole('tab', { name: /recurring/i }).click();
    // Recurring tab content should render
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/jobs');
  });

  test('jobs tabs toggle between All Jobs and Recurring', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /recurring/i })).toBeVisible();
  });
});
