import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: '.env.test' });

import { cleanupTenantB } from './helpers/ai-seed-helpers';
import { cleanupAuditLogs } from './helpers/audit-log-helpers';

async function globalTeardown() {
  console.log('\n[global-teardown] Cleaning up E2E test data...');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn('[global-teardown] Missing credentials, skipping cleanup.');
    return;
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Read context written by global-setup
  const contextFile = path.join(process.cwd(), '.playwright', 'e2e-context.json');
  if (!fs.existsSync(contextFile)) {
    console.warn('[global-teardown] No context file found, skipping cleanup.');
    return;
  }

  const { tenantId, userIds, tenantBId } = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));

  // Clean up AI audit logs before tenant deletion
  if (tenantId) {
    await cleanupAuditLogs(tenantId);
    console.log('[global-teardown]   ✓ Cleaned up audit logs');
  }
  if (tenantBId) {
    await cleanupAuditLogs(tenantBId);
  }

  // Clean up Tenant B
  await cleanupTenantB();
  console.log('[global-teardown]   ✓ Cleaned up Tenant B');

  // Delete tenant (cascade deletes jobs, clients, invoices, equipment, etc.)
  if (tenantId) {
    const { error } = await adminClient.from('tenants').delete().eq('id', tenantId);
    if (error) {
      console.warn(`[global-teardown] Failed to delete tenant ${tenantId}: ${error.message}`);
    } else {
      console.log(`[global-teardown]   ✓ Deleted tenant: ${tenantId}`);
    }
  }

  // Delete all E2E test auth users
  for (const [role, userId] of Object.entries(userIds as Record<string, string>)) {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`[global-teardown] Failed to delete user ${role} (${userId}): ${error.message}`);
    } else {
      console.log(`[global-teardown]   ✓ Deleted user: ${role}`);
    }
  }

  // Clean up test access code
  await adminClient
    .from('beta_applications')
    .delete()
    .eq('promo_code', 'E2E-TEST-ACCESS-CODE');

  // Clean up context file
  fs.unlinkSync(contextFile);

  console.log('[global-teardown] ✅ Cleanup complete.\n');
}

export default globalTeardown;
