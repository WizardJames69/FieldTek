import { test, expect } from '@playwright/test';
import { SettingsPage } from '../page-objects/SettingsPage';
import { getAdminClient } from '../helpers/supabase-admin';
import { adminSelect, invokeFunction, pollUntil } from '../helpers/authz-http';
import { TEST_TENANT } from '../helpers/test-data';

test.describe('Settings', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.waitForPage();
  });

  test('settings page loads with tab navigation', async ({ page }) => {
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('General tab shows save button', async ({ page }) => {
    await settingsPage.clickTab('general');
    await expect(page.getByTestId('general-settings-save')).toBeVisible({ timeout: 10_000 });
  });

  test('Billing tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('billing');
    // Billing tab content renders
    await page.waitForTimeout(1000);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Branding tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('branding');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Notifications tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('notification');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Calendar tab is accessible', async ({ page }) => {
    await settingsPage.clickTab('calendar');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();
  });
});

// ── Invoice reminder opt-in (Week 0 D2, founder decision 3) ────────────────
// The automated overdue-invoice email sweep is per-tenant opt-in, DEFAULT OFF.
// These tests pin the two halves the founder required at e2e level: the
// Settings toggle (off by default, persists across reload) and the flag-OFF
// sweep path (an opted-out tenant's invoice is skipped, with zero side
// effects). The flag-ON send matrix deliberately lives in the Deno tests
// (send-invoice-reminder/sweepPolicy.test.ts) — asserting a real send here
// would email live addresses on every CI run.
test.describe('Invoice reminder opt-in', () => {
  async function fixtureTenantId(): Promise<string> {
    const rows = await adminSelect('tenants', 'id', { name: TEST_TENANT.name });
    if (rows.length !== 1) throw new Error(`Expected 1 fixture tenant, found ${rows.length}`);
    return rows[0].id as string;
  }

  async function setReminderFlag(tenantId: string, value: boolean): Promise<void> {
    const admin = getAdminClient();
    const { error } = await admin
      .from('tenant_settings')
      .update({ invoice_reminders_enabled: value })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`setReminderFlag: ${error.message}`);
  }

  async function reminderFlag(tenantId: string): Promise<boolean> {
    const rows = await adminSelect('tenant_settings', 'invoice_reminders_enabled', {
      tenant_id: tenantId,
    });
    return rows[0]?.invoice_reminders_enabled === true;
  }

  test.afterEach(async () => {
    // The fixture tenant is shared across the whole suite — never leave the
    // sweep opted in behind a failed test.
    await setReminderFlag(await fixtureTenantId(), false);
  });

  test('toggle is off by default and persists across reload', async ({ page }) => {
    const tenantId = await fixtureTenantId();
    await setReminderFlag(tenantId, false);

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.waitForPage();
    await settingsPage.clickTab('notification');

    const toggle = page.getByTestId('invoice-reminders-toggle');
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await pollUntil(async () => ((await reminderFlag(tenantId)) ? true : null), {
      label: 'invoice_reminders_enabled to persist true',
    });

    await page.reload();
    await settingsPage.waitForPage();
    await settingsPage.clickTab('notification');
    await expect(page.getByTestId('invoice-reminders-toggle')).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 10_000 },
    );

    // Restore off through the UI (also exercises the off-save path).
    await page.getByTestId('invoice-reminders-toggle').click();
    await pollUntil(async () => (!(await reminderFlag(tenantId)) ? true : null), {
      label: 'invoice_reminders_enabled to persist false',
    });
  });

  test('flag-OFF sweep skips the tenant with zero side effects', async () => {
    const tenantId = await fixtureTenantId();
    await setReminderFlag(tenantId, false);

    const admin = getAdminClient();
    // Disposable client with NO email: even if the opt-in gate were broken,
    // the no-email skip means this test can never send a real message.
    const { data: client, error: clientErr } = await admin
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'E2E Reminder Sweep Client' })
      .select('id')
      .single();
    if (clientErr) throw new Error(`create client: ${clientErr.message}`);
    const { data: invoice, error: invoiceErr } = await admin
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        client_id: client.id,
        invoice_number: `E2E-SWEEP-${Date.now()}`,
        status: 'sent', // past-due 'sent' is sweep-eligible AND would be flipped to 'overdue' on send
        subtotal: 100,
        tax_amount: 0,
        total: 100,
        due_date: '2026-01-01',
      })
      .select('id')
      .single();
    if (invoiceErr) throw new Error(`create invoice: ${invoiceErr.message}`);

    try {
      const res = await invokeFunction('send-invoice-reminder', {
        serviceRole: true,
        body: { tenant_id: tenantId },
      });
      expect(res.status).toBe(200);
      expect(res.json?.sent).toBe(0);
      const results = (res.json?.results ?? []) as Array<Record<string, unknown>>;
      const row = results.find((r) => r.invoice_id === invoice.id);
      expect(row?.status).toBe('skipped');
      // The exact skipReason proves the OPT-IN gate fired, not the
      // no-client-email fallback.
      expect(row?.error).toBe('Reminders disabled for tenant');

      // Zero side effects: the sent→overdue status flip must not have run.
      const after = await adminSelect('invoices', 'status', { id: invoice.id });
      expect(after[0]?.status).toBe('sent');
    } finally {
      await admin.from('invoices').delete().eq('id', invoice.id);
      await admin.from('clients').delete().eq('id', client.id);
    }
  });
});
