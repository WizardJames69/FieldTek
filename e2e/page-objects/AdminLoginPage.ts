import { Page, expect } from '@playwright/test';

export class AdminLoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    await this.page.getByTestId('admin-login-email').fill(email);
    await this.page.getByTestId('admin-login-password').fill(password);
    await this.page.getByTestId('admin-login-submit').click();
    await this.page.waitForURL('**/admin**', { timeout: 20_000 });
  }

  get emailInput() {
    return this.page.getByTestId('admin-login-email');
  }

  get passwordInput() {
    return this.page.getByTestId('admin-login-password');
  }

  get submitButton() {
    return this.page.getByTestId('admin-login-submit');
  }
}
