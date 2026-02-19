import { Page, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await expect(this.page.getByTestId('dashboard-page')).toBeVisible({ timeout: 20_000 });
  }

  async waitForStatsLoad() {
    await expect(this.page.getByTestId('dashboard-stats-grid')).toBeVisible({ timeout: 15_000 });
    // Wait for skeletons to disappear
    await this.page.waitForTimeout(1500);
  }

  get statsGrid() {
    return this.page.getByTestId('dashboard-stats-grid');
  }

  get todaysJobsCard() {
    return this.page.getByTestId('dashboard-todays-jobs');
  }

  get serviceRequestsCard() {
    return this.page.getByTestId('dashboard-service-requests');
  }

  async navigateTo(section: 'jobs' | 'clients' | 'invoices' | 'equipment' | 'schedule' | 'team' | 'settings') {
    await this.page.getByTestId(`sidebar-nav-${section}`).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async signOut() {
    await this.page.getByTestId('sidebar-signout-button').click();
    await this.page.waitForURL('**/', { timeout: 15_000 });
  }
}
