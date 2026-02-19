import { Page, expect } from '@playwright/test';
import { waitForDataLoad, waitForToast } from '../helpers/wait-helpers';

export class TeamPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/team');
    await waitForDataLoad(this.page);
  }

  async waitForPage() {
    await this.page.waitForSelector('[data-testid="team-invite-button"], button:has-text("Invite")', {
      timeout: 15_000,
    });
  }

  async clickInvite() {
    await this.page.getByRole('button', { name: /invite/i }).first().click();
  }

  async fillInviteForm(email: string, role: 'admin' | 'dispatcher' | 'technician') {
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByRole('combobox').click();
    await this.page.getByRole('option', { name: new RegExp(role, 'i') }).click();
  }

  async sendInvite() {
    await this.page.getByRole('button', { name: /send invite|invite/i }).last().click();
    await waitForToast(this.page);
  }

  getTeamMemberCards() {
    return this.page.locator('[data-testid="team-member-card"]');
  }
}
