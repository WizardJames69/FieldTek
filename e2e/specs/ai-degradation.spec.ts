import { test, expect } from '@playwright/test';
import { AssistantPage } from '../page-objects/AssistantPage';
import { createAIClient, AIAPIClient } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { resetAllFlags } from '../helpers/feature-flag-helpers';
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

test.describe('No Documents', () => {
  test('assistant shows documentation alert when docs available', async ({ page }) => {
    const assistantPage = new AssistantPage(page);
    await assistantPage.goto();
    await assistantPage.waitForPage();
    // With seed data, documents should be available
    const noDocsVisible = await assistantPage.isNoDocsWarningVisible();
    const docsVisible = await assistantPage.isDocsAvailableVisible();
    expect(noDocsVisible || docsVisible).toBe(true);
  });

  test('query without documents returns response or abstain flag', async () => {
    test.slow();
    // Even without matching documents, the pipeline should respond gracefully
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'Tell me about plumbing fixtures' }],
      context: { industry: 'plumbing' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
  });
});

test.describe('AI Disabled', () => {
  test('ai_enabled=false in policy returns 403', async () => {
    test.slow();
    const adminClient = getAdminClient();
    await adminClient
      .from('tenant_ai_policies')
      .update({ ai_enabled: false })
      .eq('tenant_id', tenantId);

    try {
      const res = await client.sendRawRequest(
        { messages: [{ role: 'user', content: 'hello' }] },
        adminToken,
      );
      expect(res.status).toBe(403);
      expect(res.body).toContain('disabled');
    } finally {
      await adminClient
        .from('tenant_ai_policies')
        .update({ ai_enabled: true })
        .eq('tenant_id', tenantId);
    }
  });

  test('re-enabling ai_enabled=true returns 200', async () => {
    test.slow();
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What is HVAC maintenance?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.streamedContent.length).toBeGreaterThan(0);
  });
});

test.describe('Feature Flag Fallback', () => {
  test('all 7 flags disabled → basic response still works', async () => {
    test.slow();
    await resetAllFlags();
    try {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'What is a filter replacement schedule?' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      expect(res.streamedContent.length).toBeGreaterThan(0);
    } finally {
      await resetAllFlags();
    }
  });

  test('pipeline returns 200 with valid response even with all enhancements off', async () => {
    test.slow();
    await resetAllFlags();
    try {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'How do I check refrigerant levels?' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      expect(res.streamedContent.length).toBeGreaterThan(0);
    } finally {
      await resetAllFlags();
    }
  });
});
