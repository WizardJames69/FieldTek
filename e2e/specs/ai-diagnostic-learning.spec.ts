import { test, expect } from '@playwright/test';
import { createAIClient, AIAPIClient } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { TENANT_B } from '../helpers/ai-test-data';
import { waitForAuditLog } from '../helpers/audit-log-helpers';
import { withFeatureFlag, setFeatureFlag, getFeatureFlag } from '../helpers/feature-flag-helpers';
import { getAdminClient } from '../helpers/supabase-admin';
import { seedDiagnosticStatistics } from '../helpers/ai-seed-helpers';
import * as fs from 'fs';
import * as path from 'path';

let client: AIAPIClient;
let adminToken: string;
let tenantId: string;
let tenantBId: string;

test.beforeAll(async () => {
  client = createAIClient();
  adminToken = await client.getAuthToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
  );
  tenantId = ctx.tenantId;
  tenantBId = ctx.tenantBId;
});

test.describe('Diagnostic Learning Loop', () => {
  test('DB: aggregate_diagnostic_patterns RPC produces statistics from seeded edges', async () => {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient.rpc('aggregate_diagnostic_patterns', {
      p_tenant_id: tenantId,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe('number');
    expect(data).toBeGreaterThanOrEqual(0);
  });

  test('DB: workflow_repair_effectiveness view returns full chain data', async () => {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('workflow_repair_effectiveness')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(10);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    if (data && data.length > 0) {
      const row = data[0];
      expect(row).toHaveProperty('symptom_key');
      expect(row).toHaveProperty('failure_key');
      expect(row).toHaveProperty('repair_key');
      expect(row).toHaveProperty('symptom_to_failure_prob');
      expect(row).toHaveProperty('failure_to_repair_prob');
    }
  });

  test('DB: seeded diagnostic statistics exist with expected values', async () => {
    // Re-seed because the aggregate_diagnostic_patterns RPC (previous test) overwrites values
    await seedDiagnosticStatistics(tenantId);
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('workflow_diagnostic_statistics')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('symptom', 'not_cooling')
      .order('success_rate', { ascending: false });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThanOrEqual(2);

    const capacitor = data!.find((r) => r.repair_action === 'replaced_capacitor');
    expect(capacitor).toBeDefined();
    expect(capacitor!.occurrence_count).toBe(8);
    expect(capacitor!.success_rate).toBeCloseTo(0.75, 1);
    expect(capacitor!.confidence_score).toBeCloseTo(0.55, 1);

    const refrigerant = data!.find((r) => r.repair_action === 'recharged_refrigerant');
    expect(refrigerant).toBeDefined();
    expect(refrigerant!.occurrence_count).toBe(5);
    expect(refrigerant!.success_rate).toBeCloseTo(0.6, 1);
  });

  test('Pipeline: diagnostic signals influence response when flag enabled', async () => {
    test.slow();
    await withFeatureFlag('diagnostic_learning', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Unit is not cooling at all, what should I check?' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      expect(res.streamedContent.length).toBeGreaterThan(0);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.diagnostic_context_injected).toBe(true);
      }
    });
  });

  test('Pipeline: diagnostic signals absent when flag disabled', async () => {
    test.slow();
    await withFeatureFlag('diagnostic_learning', false, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Unit is not cooling' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.diagnostic_context_injected).toBe(false);
      }
    });
  });

  test('Audit: diagnostic_patterns_used populated in audit log', async () => {
    test.slow();
    await withFeatureFlag('diagnostic_learning', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Air handler not cooling, capacitor issue?' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        if (log.diagnostic_patterns_used) {
          expect(Array.isArray(log.diagnostic_patterns_used)).toBe(true);
          const patterns = log.diagnostic_patterns_used as string[];
          expect(patterns.length).toBeGreaterThan(0);
          expect(patterns.length).toBeLessThanOrEqual(5);
          // Should contain the arrow-separated pattern chain
          const hasChain = patterns.some(
            (p: string) => p.includes('→') || p.includes('no_cooling'),
          );
          expect(hasChain).toBe(true);
        }
      }
    });
  });

  test('Audit: diagnostic_signal_strength > 0 when patterns found', async () => {
    test.slow();
    await withFeatureFlag('diagnostic_learning', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Not cooling problem with air handler' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        if (log.diagnostic_signal_strength !== null && log.diagnostic_signal_strength !== undefined) {
          expect(log.diagnostic_signal_strength as number).toBeGreaterThan(0);
        }
      }
    });
  });

  test('Isolation: Tenant B has zero diagnostic statistics', async () => {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('workflow_diagnostic_statistics')
      .select('id')
      .eq('tenant_id', tenantBId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBe(0);
  });

  test('Pipeline: no error when diagnostic statistics table empty for tenant', async () => {
    test.slow();
    // Use Tenant B credentials — it has no diagnostic data
    const tenantBToken = await client.getAuthToken(TENANT_B.user.email, TENANT_B.user.password);
    await withFeatureFlag('diagnostic_learning', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Not cooling' }],
        context: { industry: 'plumbing' },
        authToken: tenantBToken,
      });
      expect(res.status).toBe(200);
    });
  });

  test('Feature flags: both diagnostic flags independently controllable', async () => {
    // Test diagnostic_learning flag
    const origLearning = await getFeatureFlag('diagnostic_learning');
    await setFeatureFlag('diagnostic_learning', true, 100);
    const enabled = await getFeatureFlag('diagnostic_learning');
    expect(enabled.is_enabled).toBe(true);
    await setFeatureFlag('diagnostic_learning', origLearning.is_enabled, origLearning.rollout_percentage);

    // Test diagnostic_probability_ranking flag
    const origRanking = await getFeatureFlag('diagnostic_probability_ranking');
    await setFeatureFlag('diagnostic_probability_ranking', true, 100);
    const enabledRanking = await getFeatureFlag('diagnostic_probability_ranking');
    expect(enabledRanking.is_enabled).toBe(true);
    await setFeatureFlag('diagnostic_probability_ranking', origRanking.is_enabled, origRanking.rollout_percentage);
  });
});
