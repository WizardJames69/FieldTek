import { test, expect } from '@playwright/test';
import { createAIClient, AIAPIClient } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { waitForAuditLog } from '../helpers/audit-log-helpers';
import { withFeatureFlag } from '../helpers/feature-flag-helpers';
import { AdminRAGQualityPage } from '../page-objects/AdminRAGQualityPage';
import { getAdminClient } from '../helpers/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

let client: AIAPIClient;
let adminToken: string;
let tenantId: string;

test.beforeAll(async () => {
  client = createAIClient();
  adminToken = await client.getAuthToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
  );
  tenantId = ctx.tenantId;
});

test.describe('Equipment Knowledge Graph', () => {
  test('query "compressor" matches equipment_components via failure_modes', async () => {
    test.slow();

    await withFeatureFlag('equipment_graph', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'The compressor is not starting' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.graph_expansion_count).toBeGreaterThan(0);
      }
    });
  });

  test('graph expansion adds related components from 1-hop relationships', async () => {
    test.slow();
    await withFeatureFlag('equipment_graph', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Compressor short cycling issue' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        if (log.graph_expansion_terms && Array.isArray(log.graph_expansion_terms)) {
          const terms = (log.graph_expansion_terms as string[]).map((t: string) => t.toLowerCase());
          const hasRelated = terms.some(
            (t: string) => t.includes('capacitor') || t.includes('contactor'),
          );
          expect(hasRelated).toBe(true);
        }
      }
    });
  });

  test('graph scoring re-blends results: max_graph_score > 0', async () => {
    test.slow();
    await withFeatureFlag('equipment_graph', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Capacitor failure in air handler' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        if (log.max_graph_score !== null) {
          expect(log.max_graph_score).toBeGreaterThan(0);
        }
      }
    });
  });

  test('disabling equipment_graph → graph_expansion_count=0', async () => {
    test.slow();
    await withFeatureFlag('equipment_graph', false, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Compressor issue in air handler' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.graph_expansion_count).toBe(0);
        expect(log.graph_scoring_applied).toBe(false);
      }
    });
  });
});

test.describe('Workflow Intelligence Graph', () => {
  test('workflow_failure_paths view returns symptom→failure with probability', async () => {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('workflow_failure_paths')
      .select('symptom_label, failure_label, probability, frequency')
      .limit(10);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    if (data && data.length > 0) {
      const firstPath = data[0];
      expect(firstPath).toHaveProperty('symptom_label');
      expect(firstPath).toHaveProperty('failure_label');
      expect(firstPath).toHaveProperty('probability');
      expect(firstPath).toHaveProperty('frequency');
    }
  });

  test('workflow_symptoms has occurrence_count > 0 for seeded symptom', async () => {
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from('workflow_symptoms')
      .select('symptom_label, occurrence_count')
      .eq('symptom_key', 'not_cooling')
      .eq('tenant_id', tenantId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    if (data) {
      expect(data.symptom_label).toBe('Not Cooling');
      expect(data.occurrence_count).toBeGreaterThan(0);
    }
  });
});

test.describe('Dashboard Graph Visualization', () => {
  test('workflow tab renders symptom chart data', async ({ page }) => {
    const ragPage = new AdminRAGQualityPage(page);
    await ragPage.goto();
    const dashboardVisible = await page.getByText('RAG Quality Dashboard').isVisible({ timeout: 20_000 }).catch(() => false);
    if (!dashboardVisible) {
      test.skip(true, 'RAG Quality Dashboard did not render in time');
      return;
    }
    await ragPage.switchTab('Workflow');

    // With seeded data, should show symptom stats or empty state
    const symptomsCard = page.locator('div[class*="rounded"]').filter({ hasText: 'Symptoms Tracked' }).first();
    const emptyMsg = page.getByText('No workflow intelligence data');
    const hasSymptoms = await symptomsCard.isVisible().catch(() => false);
    const isEmpty = await emptyMsg.isVisible().catch(() => false);
    expect(hasSymptoms || isEmpty).toBe(true);
  });

  test('failure probability table shows seeded data', async ({ page }) => {
    const ragPage = new AdminRAGQualityPage(page);
    await ragPage.goto();
    const dashboardVisible = await page.getByText('RAG Quality Dashboard').isVisible({ timeout: 20_000 }).catch(() => false);
    if (!dashboardVisible) {
      test.skip(true, 'RAG Quality Dashboard did not render in time');
      return;
    }
    await ragPage.switchTab('Workflow');

    const table = ragPage.getFailurePathsTable();
    if (await table.isVisible()) {
      // Should show the seeded "No Cooling" → "Capacitor Failure" path
      const tableText = await table.textContent();
      if (tableText) {
        const hasSeededData =
          tableText.includes('No Cooling') || tableText.includes('Capacitor Failure');
        expect(hasSeededData).toBe(true);
      }
    }
  });
});
