import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load E2E-specific environment variables from .env.test
config({ path: '.env.test' });

export default defineConfig({
  testDir: './e2e',

  // Prevent parallel runs to avoid Supabase rate-limiting
  fullyParallel: false,
  workers: 2,

  // Fail CI on test.only leaks
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Block PWA service worker to prevent it interfering with test network requests
    serviceWorkers: 'block',
  },

  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: '.playwright/test-results',

  projects: [
    // Setup: runs browser-based login flows to save auth storage states
    {
      name: 'setup',
      testMatch: /e2e\/setup\/.*\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Main app tests using the admin/owner user's auth state
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.playwright/auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: [
        'e2e/specs/dashboard.spec.ts',
        'e2e/specs/jobs.spec.ts',
        'e2e/specs/clients.spec.ts',
        'e2e/specs/invoices.spec.ts',
        'e2e/specs/equipment.spec.ts',
        'e2e/specs/team.spec.ts',
        'e2e/specs/schedule.spec.ts',
        'e2e/specs/settings.spec.ts',
        'e2e/specs/navigation.spec.ts',
      ],
    },

    // Auth + onboarding tests run without stored state (need fresh browser)
    {
      name: 'chromium-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        'e2e/specs/auth.spec.ts',
        'e2e/specs/onboarding.spec.ts',
      ],
    },

    // Customer portal tests using portal client's auth state
    {
      name: 'chromium-portal',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.playwright/auth/portal-client.json',
      },
      dependencies: ['setup'],
      testMatch: ['e2e/specs/portal.spec.ts'],
    },

    // Platform admin panel tests
    {
      name: 'chromium-platform-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.playwright/auth/platform-admin.json',
      },
      dependencies: ['setup'],
      testMatch: ['e2e/specs/admin.spec.ts'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '',
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
      VITE_CF_TURNSTILE_SITE_KEY: process.env.VITE_CF_TURNSTILE_SITE_KEY ?? '',
    },
  },
});
