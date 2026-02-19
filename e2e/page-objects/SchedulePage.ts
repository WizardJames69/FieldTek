import { Page, expect } from '@playwright/test';
import { waitForDataLoad } from '../helpers/wait-helpers';

export class SchedulePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/schedule');
    await waitForDataLoad(this.page);
  }

  async waitForCalendar() {
    // Calendar renders as a grid - wait for the calendar container to appear
    await this.page
      .locator('[data-testid="schedule-page"], .fc, [class*="calendar"]')
      .first()
      .waitFor({ timeout: 20_000 });
  }

  async clickMonthView() {
    await this.page.getByRole('button', { name: /month/i }).click();
  }

  async clickWeekView() {
    await this.page.getByRole('button', { name: /week/i }).click();
  }

  async clickDayView() {
    await this.page.getByRole('button', { name: /day/i }).click();
  }
}
