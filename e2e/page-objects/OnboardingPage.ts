import { Page, expect } from '@playwright/test';

export class OnboardingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/onboarding');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForPage() {
    await expect(this.page.getByTestId('onboarding-page')).toBeVisible({ timeout: 15_000 });
  }

  async fillCompanyName(name: string) {
    await this.page.getByTestId('onboarding-company-name').fill(name);
  }

  async clickContinue() {
    await this.page.getByTestId('onboarding-continue').click();
  }

  async clickBack() {
    await this.page.getByTestId('onboarding-back').click();
  }

  async selectIndustry(industryId: string) {
    await this.page.getByTestId(`onboarding-industry-${industryId}`).click();
  }

  async clickLaunch() {
    await this.page.getByTestId('onboarding-launch').click();
  }

  async waitForDashboard() {
    await this.page.waitForURL('**/dashboard', { timeout: 30_000 });
  }

  async completeOnboarding(companyName: string, industryId = 'hvac') {
    await this.waitForPage();
    // Step 1: Company name
    await this.fillCompanyName(companyName);
    await this.clickContinue();
    // Step 2: Industry
    await this.selectIndustry(industryId);
    await this.clickContinue();
    // Step 3: Branding (optional, just continue)
    await this.clickContinue();
    // Step 4: Launch
    await this.clickLaunch();
    await this.waitForDashboard();
  }
}
