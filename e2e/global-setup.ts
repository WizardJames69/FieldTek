import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env.test before anything else
config({ path: '.env.test' });

import { TEST_USERS, TEST_TENANT, TEST_ACCESS_CODE, SAMPLE_JOB, SAMPLE_CLIENT } from './helpers/test-data';
import {
  seedTestDocuments,
  seedDocumentChunks,
  seedFeatureFlags,
  seedTenantAIPolicy,
  seedComplianceRules,
  seedEquipmentComponents,
  seedWorkflowIntelligence,
  seedDiagnosticStatistics,
  seedTenantB,
} from './helpers/ai-seed-helpers';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = 'http://localhost:8080';
const E2E_MARKER = 'e2e_test_data';

async function globalSetup(config: FullConfig) {
  console.log('\n[global-setup] Starting E2E test setup...');

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      '[global-setup] VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test\n' +
        'See .env.test for setup instructions.'
    );
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── Step 1: Create/upsert all test auth users ──────────────────────────

  console.log('[global-setup] Creating test auth users...');
  const userIds: Record<string, string> = {};

  for (const [key, userData] of Object.entries(TEST_USERS)) {
    const { data: list } = await adminClient.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === userData.email);

    if (existing) {
      userIds[key] = existing.id;
      // Reset password to ensure tests use the correct credentials
      await adminClient.auth.admin.updateUserById(existing.id, {
        password: userData.password,
        email_confirm: true,
      });
      console.log(`[global-setup]   ✓ Reused user: ${userData.email}`);
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Bypasses email verification requirement
        user_metadata: {
          full_name: userData.fullName,
          [E2E_MARKER]: true,
        },
      });
      if (error) throw new Error(`[global-setup] Failed to create user "${key}": ${error.message}`);
      userIds[key] = data.user!.id;
      console.log(`[global-setup]   ✓ Created user: ${userData.email}`);
    }

    // Ensure profile row exists (normally created by DB trigger)
    await adminClient.from('profiles').upsert(
      { user_id: userIds[key], full_name: userData.fullName, email: userData.email },
      { onConflict: 'user_id' }
    );
  }

  // ─── Step 2: Create test tenant ─────────────────────────────────────────

  console.log('[global-setup] Setting up test tenant...');

  const { data: existingTenant } = await adminClient
    .from('tenants')
    .select('id')
    .eq('name', TEST_TENANT.name)
    .maybeSingle();

  let tenantId: string;

  if (existingTenant) {
    tenantId = existingTenant.id;
    // Ensure enterprise tier for unlimited rate limits during tests
    await adminClient.from('tenants').update({ subscription_tier: 'enterprise' }).eq('id', tenantId);
    console.log(`[global-setup]   ✓ Reused tenant: ${tenantId}`);
  } else {
    const { data: tenant, error } = await adminClient
      .from('tenants')
      .insert({
        name: TEST_TENANT.name,
        slug: `e2e-test-company-${Date.now()}`,
        industry: TEST_TENANT.industry,
        owner_id: userIds.admin,
        subscription_tier: 'enterprise',
        subscription_status: 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`[global-setup] Failed to create tenant: ${error.message}`);
    tenantId = tenant.id;

    // Tenant memberships
    await adminClient.from('tenant_users').insert([
      { tenant_id: tenantId, user_id: userIds.admin, role: 'owner', is_active: true },
      { tenant_id: tenantId, user_id: userIds.technician, role: 'technician', is_active: true },
    ]);

    // Tenant settings (required for dashboard to load)
    await adminClient.from('tenant_settings').insert({
      tenant_id: tenantId,
      equipment_types: ['Air Handler', 'Condenser', 'Furnace', 'Heat Pump'],
      job_types: ['Installation', 'Repair', 'Maintenance', 'Inspection'],
      workflow_stages: ['Scheduled', 'En Route', 'On Site', 'Complete'],
      document_categories: ['Contract', 'Warranty', 'Invoice', 'Manual'],
    });

    // Tenant branding (required for layout to render)
    await adminClient.from('tenant_branding').insert({
      tenant_id: tenantId,
      company_name: TEST_TENANT.name,
      primary_color: '#1e3a5f',
      secondary_color: '#f59e0b',
    });

    console.log(`[global-setup]   ✓ Created tenant: ${tenantId}`);
  }

  // ─── Step 3: Create portal client record ────────────────────────────────

  const { data: existingClient } = await adminClient
    .from('clients')
    .select('id')
    .eq('user_id', userIds.portalClient)
    .maybeSingle();

  if (!existingClient) {
    const { data: clientRow } = await adminClient
      .from('clients')
      .insert({
        tenant_id: tenantId,
        name: TEST_USERS.portalClient.fullName,
        email: TEST_USERS.portalClient.email,
        user_id: userIds.portalClient,
        phone: '555-0199',
        address: '1 Portal Lane',
        city: 'Test City',
        state: 'CA',
        zip_code: '90210',
      })
      .select()
      .single();
    console.log(`[global-setup]   ✓ Created portal client: ${clientRow?.id}`);
  }

  // ─── Step 4: Seed test access code for registration flow ────────────────

  const { data: existingCode } = await adminClient
    .from('beta_applications')
    .select('id')
    .eq('promo_code', TEST_ACCESS_CODE)
    .maybeSingle();

  if (!existingCode) {
    await adminClient.from('beta_applications').insert({
      email: 'e2e-access-code@fieldtek-test.dev',
      company_name: 'E2E Test Access Code Record',
      status: 'approved',
      promo_code: TEST_ACCESS_CODE,
      industry: 'general',
      team_size: '1-5',
    });
    console.log(`[global-setup]   ✓ Seeded test access code: ${TEST_ACCESS_CODE}`);
  }

  // ─── Step 5: Seed sample data for CRUD tests ────────────────────────────

  const { data: existingJob } = await adminClient
    .from('scheduled_jobs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('title', SAMPLE_JOB.title)
    .maybeSingle();

  if (!existingJob) {
    const { data: clientForJob } = await adminClient
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    await adminClient.from('scheduled_jobs').insert({
      tenant_id: tenantId,
      title: SAMPLE_JOB.title,
      description: SAMPLE_JOB.description,
      job_type: SAMPLE_JOB.job_type,
      priority: SAMPLE_JOB.priority,
      status: SAMPLE_JOB.status,
      client_id: clientForJob?.id ?? null,
      assigned_to: userIds.technician,
    });
    console.log(`[global-setup]   ✓ Seeded sample job`);
  }

  // ─── Step 6: Set platform admin flag ────────────────────────────────────

  const { error: platformAdminError } = await adminClient
    .from('platform_admins')
    .upsert(
      { user_id: userIds.platformAdmin, email: TEST_USERS.platformAdmin.email },
      { onConflict: 'user_id' }
    );
  if (platformAdminError) {
    throw new Error(`[global-setup] Failed to set platform admin: ${platformAdminError.message}`);
  }
  console.log(`[global-setup]   ✓ Set platform admin`);

  // ─── Step 7: Seed AI test documents ────────────────────────────────────

  const docIds = await seedTestDocuments(tenantId);
  console.log(`[global-setup]   ✓ Seeded ${docIds.length} test documents`);

  // ─── Step 8: Seed document chunks with pre-computed embeddings ────────

  await seedDocumentChunks(tenantId, docIds);
  console.log('[global-setup]   ✓ Seeded document chunks with embeddings');

  // ─── Step 9: Ensure feature flags exist ───────────────────────────────

  await seedFeatureFlags();
  console.log('[global-setup]   ✓ Seeded feature flags');

  // ─── Step 10: Create tenant AI policy ─────────────────────────────────

  await seedTenantAIPolicy(tenantId);
  console.log('[global-setup]   ✓ Seeded tenant AI policy');

  // ─── Step 11: Seed compliance rules ───────────────────────────────────

  await seedComplianceRules(tenantId);
  console.log('[global-setup]   ✓ Seeded compliance rules');

  // ─── Step 12: Seed equipment components + relationships ───────────────

  await seedEquipmentComponents(tenantId);
  console.log('[global-setup]   ✓ Seeded equipment components');

  // ─── Step 13: Seed workflow intelligence data ─────────────────────────

  await seedWorkflowIntelligence(tenantId);
  console.log('[global-setup]   ✓ Seeded workflow intelligence data');

  // ─── Step 13b: Seed diagnostic statistics ──────────────────────────────

  await seedDiagnosticStatistics(tenantId);
  console.log('[global-setup]   ✓ Seeded diagnostic statistics');

  // ─── Step 14: Seed Tenant B for isolation tests ───────────────────────

  const tenantB = await seedTenantB();
  console.log(`[global-setup]   ✓ Seeded Tenant B: ${tenantB.tenantId}`);

  // ─── Step 15: Write context for teardown ──────────────────────────────

  const contextFile = path.join(process.cwd(), '.playwright', 'e2e-context.json');
  fs.mkdirSync(path.dirname(contextFile), { recursive: true });
  fs.writeFileSync(
    contextFile,
    JSON.stringify({
      tenantId,
      userIds,
      testAccessCode: TEST_ACCESS_CODE,
      tenantBId: tenantB.tenantId,
      tenantBUserId: tenantB.userId,
      docIds,
    }, null, 2)
  );

  console.log('[global-setup] ✅ DB seeding complete. Browser auth states will be saved by auth.setup.ts\n');
}

export default globalSetup;
