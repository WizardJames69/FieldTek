import { Page, expect } from '@playwright/test';

export class PortalLoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/portal/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    await this.page.getByTestId('portal-login-email').fill(email);
    await this.page.getByTestId('portal-login-password').fill(password);
    await this.page.getByTestId('portal-login-submit').click();
    await this.page.waitForURL('**/portal**', { timeout: 20_000 });
  }

  async expectLoginError() {
    await expect(this.page.getByTestId('portal-login-form')).toBeVisible();
  }
}
