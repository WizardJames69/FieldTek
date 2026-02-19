import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { AuthPage } from '../page-objects/AuthPage';
import { OnboardingPage } from '../page-objects/OnboardingPage';

config({ path: '.env.test' });

/**
 * Onboarding tests create a fresh user for each test run so we can
 * test the full onboarding wizard from scratch. After onboarding, the
 * test cleans up by deleting the tenant and user.
 */
test.describe('Onboarding Flow', () => {
  const ONBOARDING_TEST_EMAIL = `e2e-onboarding-${Date.now()}@fieldtek-test.dev`;
  const ONBOARDING_TEST_PASSWORD = 'E2eOnboard123!Test';
  let createdUserId: string | null = null;
  let createdTenantId: string | null = null;

  test.beforeEach(async () => {
    // Create a fresh confirmed user via admin API
    const adminClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error } = await adminClient.auth.admin.createUser({
      email: ONBOARDING_TEST_EMAIL,
      password: ONBOARDING_TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    createdUserId = data.user!.id;

    // Ensure profile exists
    await adminClient
      .from('profiles')
      .upsert({ user_id: createdUserId, full_name: 'Onboarding Test User', email: ONBOARDING_TEST_EMAIL }, { onConflict: 'user_id' });
  });

  test.afterEach(async () => {
    // Cleanup: delete test tenant (cascade) and user
    const adminClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    if (createdTenantId) {
      await adminClient.from('tenants').delete().eq('id', createdTenantId);
      createdTenantId = null;
    }
    if (createdUserId) {
      await adminClient.auth.admin.deleteUser(createdUserId);
      createdUserId = null;
    }
  });

  test('new user is redirected to onboarding after login', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.login(ONBOARDING_TEST_EMAIL, ONBOARDING_TEST_PASSWORD);
    // New user has no tenant, should go to onboarding
    await authPage.expectRedirectToOnboarding();
  });

  test('onboarding page has all 4 steps', async ({ page }) => {
    // Login first
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.login(ONBOARDING_TEST_EMAIL, ONBOARDING_TEST_PASSWORD);
    await authPage.expectRedirectToOnboarding();

    const onboardingPage = new OnboardingPage(page);
    await onboardingPage.waitForPage();

    // Step 1: Company name field should be visible
    await expect(page.getByTestId('onboarding-company-name')).toBeVisible();
    await expect(page.getByTestId('onboarding-continue')).toBeVisible();
    await expect(page.getByTestId('onboarding-back')).toBeVisible();
  });

  test('continue is disabled until company name is entered (step 1)', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.login(ONBOARDING_TEST_EMAIL, ONBOARDING_TEST_PASSWORD);
    await authPage.expectRedirectToOnboarding();

    const onboardingPage = new OnboardingPage(page);
    await onboardingPage.waitForPage();

    // Continue should be disabled initially (before any input)
    await expect(page.getByTestId('onboarding-continue')).toBeDisabled();

    // Enter a valid company name — button should become enabled
    await onboardingPage.fillCompanyName('Test Company');
    await expect(page.getByTestId('onboarding-continue')).toBeEnabled();
  });

  test('industry selection step shows all 7 industries', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.login(ONBOARDING_TEST_EMAIL, ONBOARDING_TEST_PASSWORD);

    const onboardingPage = new OnboardingPage(page);
    await onboardingPage.waitForPage();
    await onboardingPage.fillCompanyName('Test Co');
    await onboardingPage.clickContinue();

    // All 7 industries should be visible
    const industries = ['hvac', 'plumbing', 'electrical', 'mechanical', 'elevator', 'home_automation', 'general'];
    for (const id of industries) {
      await expect(page.getByTestId(`onboarding-industry-${id}`)).toBeVisible();
    }
  });

  test('full 4-step onboarding flow creates tenant and redirects to dashboard', async ({ page }) => {
    const adminClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.login(ONBOARDING_TEST_EMAIL, ONBOARDING_TEST_PASSWORD);

    const onboardingPage = new OnboardingPage(page);
    await onboardingPage.completeOnboarding('E2E Onboarding Company', 'hvac');

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify tenant was created in DB
    const { data: tenantUser } = await adminClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', createdUserId!)
      .single();
    expect(tenantUser?.tenant_id).toBeTruthy();
    createdTenantId = tenantUser?.tenant_id ?? null;
  });
});
