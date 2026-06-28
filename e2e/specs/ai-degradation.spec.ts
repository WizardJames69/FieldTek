import { test, expect } from '@playwright/test';
import { AssistantPage } from '../page-objects/AssistantPage';
import { createAIClient, AIAPIClient } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { withAllEnhancementFlagsDisabled } from '../helpers/feature-flag-helpers';
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
    // Wait for async document fetch to complete and show either indicator
    const noDocs = page.getByText('No Documentation Uploaded');
    const hasDocs = page.getByText(/Documents? Available/);
    await expect(noDocs.or(hasDocs)).toBeVisible({ timeout: 10_000 });
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
    await withAllEnhancementFlagsDisabled(tenantId, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'What is a filter replacement schedule?' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      expect(res.streamedContent.length).toBeGreaterThan(0);
    });
  });

  test('pipeline returns 200 with valid response even with all enhancements off', async () => {
    test.slow();
    await withAllEnhancementFlagsDisabled(tenantId, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'How do I check refrigerant levels?' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      expect(res.streamedContent.length).toBeGreaterThan(0);
    });
  });
});

// Grounding-Trust Hardening (PR-A): when a tenant HAS indexed documents but
// retrieval cannot produce qualifying grounded chunks, Sentinel must abstain by
// default rather than stream an ungrounded full-document fallback answer.
//
// A query whose extracted search text is <= 10 chars skips semantic search
// entirely (retrievalRan=false) — the same code path as a query-embedding
// failure or retrieval adapter error — so it is a deterministic, offline-safe
// trigger for the `retrieval_unavailable` abstain branch.
//
// Guarded: this asserts the NEW behavior and therefore only holds once
// field-assistant is redeployed with the PR-A abstain gate. It is skipped by
// default so it never reds the suite against the currently-deployed version.
// Run after deploy with ABSTAIN_HARDENING_DEPLOYED=true (separate approval).
const RUN_ABSTAIN_HARDENING = process.env.ABSTAIN_HARDENING_DEPLOYED === 'true';
const abstainDescribe = RUN_ABSTAIN_HARDENING ? test.describe : test.describe.skip;

abstainDescribe('Retrieval Unavailable Abstain (PR-A)', () => {
  test('short query (retrieval skipped) on an indexed tenant abstains, does not stream a fallback', async () => {
    test.slow();
    // <= 10 char extracted query → semantic search skipped → retrievalRan=false.
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'AC?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });

    expect(res.status).toBe(200);
    // No ungrounded full-document answer should be streamed.
    expect(res.streamedContent.length).toBe(0);

    // The structured abstain JSON should report the retrieval_unavailable reason.
    const json = JSON.parse(res.body) as {
      abstained?: boolean;
      abstainReason?: string;
      metadata?: { retrieval_ran?: boolean };
    };
    expect(json.abstained).toBe(true);
    expect(json.abstainReason).toBe('retrieval_unavailable');
    expect(json.metadata?.retrieval_ran).toBe(false);
  });

  test('a normal grounded question on the same tenant still answers', async () => {
    test.slow();
    // Control: healthy retrieval with sufficient chunks must remain answerable
    // (the hardening must not over-abstain).
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What is the recommended HVAC filter replacement schedule?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.streamedContent.length).toBeGreaterThan(0);
  });
});
