/**
 * Shared test data constants used across global-setup and specs.
 * All values here are seeded into the staging database by global-setup.ts.
 */

export const TEST_ACCESS_CODE = 'E2E-TEST-ACCESS-CODE';

export const TEST_USERS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@fieldtek-test.dev',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin123!Test',
    fullName: 'E2E Admin User',
    role: 'owner' as const,
  },
  technician: {
    email: process.env.E2E_TECH_EMAIL ?? 'e2e-tech@fieldtek-test.dev',
    password: process.env.E2E_TECH_PASSWORD ?? 'E2eTech123!Test',
    fullName: 'E2E Technician User',
    role: 'technician' as const,
  },
  portalClient: {
    email: process.env.E2E_PORTAL_EMAIL ?? 'e2e-portal@fieldtek-test.dev',
    password: process.env.E2E_PORTAL_PASSWORD ?? 'E2ePortal123!Test',
    fullName: 'E2E Portal Client',
    role: 'client' as const,
  },
  platformAdmin: {
    email: process.env.E2E_PLATFORM_ADMIN_EMAIL ?? 'e2e-platform@fieldtek-test.dev',
    password: process.env.E2E_PLATFORM_ADMIN_PASSWORD ?? 'E2ePlatform123!Test',
    fullName: 'E2E Platform Admin',
    role: 'admin' as const,
  },
} as const;

export const TEST_TENANT = {
  name: 'E2E Test Company',
  industry: 'hvac' as const,
};

export const SAMPLE_JOB = {
  title: 'E2E - AC Unit Repair',
  description: 'Test job created by E2E suite',
  job_type: 'Repair',
  priority: 'high' as const,
  status: 'pending' as const,
};

export const SAMPLE_CLIENT = {
  name: 'E2E Test Client',
  email: 'e2e-client@example.com',
  phone: '555-0100',
  address: '123 Test Street',
  city: 'Test City',
  state: 'CA',
  zip_code: '90210',
};

export const SAMPLE_INVOICE_LINE_ITEM = {
  description: 'E2E Labor - 2 hours',
  quantity: 2,
  unit_price: 75,
  item_type: 'labor' as const,
};
