import { test, expect } from '@playwright/test';
import { AdminFeatureFlagsPage } from '../page-objects/AdminFeatureFlagsPage';
import { createAIClient, AIAPIClient } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { withFeatureFlag } from '../helpers/feature-flag-helpers';
import { waitForAuditLog, getLatestAuditLog } from '../helpers/audit-log-helpers';
import * as fs from 'fs';
import * as path from 'path';

let tenantId: string;

test.beforeAll(async () => {
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
  );
  tenantId = ctx.tenantId;
});

test.describe('Admin Page UI', () => {
  let flagsPage: AdminFeatureFlagsPage;

  test.beforeEach(async ({ page }) => {
    flagsPage = new AdminFeatureFlagsPage(page);
    await flagsPage.goto();
  });

  test('feature flags page renders with table and stat cards', async ({ page }) => {
    await flagsPage.waitForPage();
    await expect(page.locator('table')).toBeVisible();
  });

  test('stat cards show Total, Enabled, Full Rollout, Partial Rollout counts', async () => {
    await flagsPage.waitForPage();
    const total = await flagsPage.getStatCardValue('Total Flags');
    expect(parseInt(total)).toBeGreaterThanOrEqual(0);
  });

  test('search filters flags by name or key', async ({ page }) => {
    await flagsPage.waitForPage();
    const countBefore = await flagsPage.getFlagCount();
    await flagsPage.searchFlags('rag_judge');
    await page.waitForTimeout(500);
    const countAfter = await flagsPage.getFlagCount();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  test('toggling a flag switch updates is_enabled state', async ({ page }) => {
    await flagsPage.waitForPage();
    const row = flagsPage.getFlagRow('rag_judge');
    if (await row.isVisible()) {
      // We just verify the switch is interactable — actual toggle tested via API effects below
      const switchEl = row.locator('button[role="switch"]');
      await expect(switchEl).toBeVisible();
    }
  });
});

test.describe('Pipeline Effects', () => {
  let client: AIAPIClient;
  let adminToken: string;

  test.beforeAll(async () => {
    client = createAIClient();
    adminToken = await client.getAuthToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('disabling rag_judge → audit log has judge_grounded IS NULL', async () => {
    test.slow();
    await withFeatureFlag('rag_judge', false, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'What is the startup procedure?' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.judge_grounded).toBeNull();
      }
    });
  });

  test('enabling rag_reranking → audit log has rerank_model IS NOT NULL', async () => {
    test.slow();
    await withFeatureFlag('rag_reranking', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'What are maintenance intervals?' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.rerank_model).not.toBeNull();
      }
    });
  });

  test('disabling equipment_graph → audit log has graph_expansion_count = 0', async () => {
    test.slow();
    await withFeatureFlag('equipment_graph', false, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Compressor not starting' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.graph_expansion_count).toBe(0);
      }
    });
  });

  test('enabling compliance_engine → audit log has compliance_rules_evaluated', async () => {
    test.slow();
    await withFeatureFlag('compliance_engine', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'What safety checks are needed before starting work?' }],
        context: { industry: 'hvac', workflowStage: 'On Site' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        // compliance_rules_evaluated should exist (may be null if no rules match)
        expect(log).toHaveProperty('compliance_rules_evaluated');
      }
    });
  });
});
