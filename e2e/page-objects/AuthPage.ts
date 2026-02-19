import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    await this.page.getByTestId('auth-email-input').fill(email);
    await this.page.getByTestId('auth-password-input').fill(password);
    await this.page.getByTestId('auth-submit-button').click();
  }

  async expectLoginError() {
    // After a failed login attempt, the form should still be visible
    await expect(this.page.getByTestId('auth-login-form')).toBeVisible();
  }

  async expectRedirectToDashboard() {
    await this.page.waitForURL('**/dashboard', { timeout: 20_000 });
  }

  async expectRedirectToOnboarding() {
    await this.page.waitForURL('**/onboarding', { timeout: 20_000 });
  }

  get emailInput() {
    return this.page.getByTestId('auth-email-input');
  }

  get passwordInput() {
    return this.page.getByTestId('auth-password-input');
  }

  get submitButton() {
    return this.page.getByTestId('auth-submit-button');
  }
}
