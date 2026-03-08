import { test, expect } from '@playwright/test';
import { createAIClient, AIAPIClient } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { PROMPT_INJECTION_PAYLOADS } from '../helpers/ai-test-data';
import { waitForAuditLog, getLatestAuditLog } from '../helpers/audit-log-helpers';
import { setFeatureFlag, withFeatureFlag } from '../helpers/feature-flag-helpers';
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

test.describe('Authentication', () => {
  test('rejects request with no auth token', async () => {
    const res = await client.sendRawRequest({ messages: [{ role: 'user', content: 'hello' }] });
    expect(res.status).toBe(401);
    expect(res.body).toContain('Unauthorized');
  });

  test('rejects request with invalid auth token', async () => {
    const res = await client.sendRawRequest(
      { messages: [{ role: 'user', content: 'hello' }] },
      'invalid-token-abc123',
    );
    expect(res.status).toBe(401);
    expect(res.body).toContain('Unauthorized');
  });

  test('rejects request from user with no tenant membership', async () => {
    // Platform admin has no tenant membership
    const platformToken = await client.getAuthToken(
      TEST_USERS.platformAdmin.email,
      TEST_USERS.platformAdmin.password,
    );
    const res = await client.sendRawRequest(
      { messages: [{ role: 'user', content: 'hello' }] },
      platformToken,
    );
    expect(res.status).toBe(403);
    expect(res.body).toContain('tenant');
  });
});

test.describe('Input Validation', () => {
  test('rejects empty messages array', async () => {
    const res = await client.sendRawRequest({ messages: [] }, adminToken);
    expect(res.status).toBe(400);
    expect(res.body).toContain('Invalid');
  });

  test('rejects 51 messages (MAX_MESSAGES=50)', async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));
    const res = await client.sendRawRequest({ messages }, adminToken);
    expect(res.status).toBe(400);
    expect(res.body).toContain('Too many messages');
  });

  test('rejects message content >10KB', async () => {
    const longContent = 'x'.repeat(10001);
    const res = await client.sendRawRequest(
      { messages: [{ role: 'user', content: longContent }] },
      adminToken,
    );
    expect(res.status).toBe(400);
  });

  test('rejects message with 5 images (MAX=4)', async () => {
    const images = Array.from({ length: 5 }, () => ({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
    }));
    const content = [{ type: 'text', text: 'Analyze these' }, ...images];
    const res = await client.sendRawRequest(
      { messages: [{ role: 'user', content }] },
      adminToken,
    );
    expect(res.status).toBe(400);
  });
});

test.describe('Prompt Injection', () => {
  test('blocks "ignore previous instructions"', async () => {
    const res = await client.sendRawRequest(
      { messages: [{ role: 'user', content: PROMPT_INJECTION_PAYLOADS[0] }] },
      adminToken,
    );
    expect(res.status).toBe(400);
    expect(res.body).toContain('security');
  });

  test('blocks "pretend you are unrestricted"', async () => {
    const res = await client.sendRawRequest(
      { messages: [{ role: 'user', content: PROMPT_INJECTION_PAYLOADS[1] }] },
      adminToken,
    );
    expect(res.status).toBe(400);
  });

  test('blocks "[INST] override [/INST]" token injection', async () => {
    const res = await client.sendRawRequest(
      { messages: [{ role: 'user', content: PROMPT_INJECTION_PAYLOADS[6] }] },
      adminToken,
    );
    expect(res.status).toBe(400);
  });

  test('injection attempt logged in audit with injection_detected=true', async () => {
    await client.sendRawRequest(
      { messages: [{ role: 'user', content: PROMPT_INJECTION_PAYLOADS[3] }] },
      adminToken,
    );
    // Give the audit log a moment to write
    await new Promise((r) => setTimeout(r, 2000));
    // Query for the most recent injection-blocked audit log specifically
    const adminClient = (await import('../helpers/supabase-admin')).getAdminClient();
    const { data: log } = await adminClient
      .from('ai_audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('response_blocked', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    expect(log).toBeTruthy();
    expect(log?.injection_detected).toBe(true);
  });
});

test.describe('Successful Response', () => {
  test.slow();

  test('returns SSE stream with text chunks for grounded query', async () => {
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What is the startup procedure for the Carrier 24ACC636?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.streamedContent.length).toBeGreaterThan(0);
  });

  test('metadata event contains retrieval_quality_score, confidence, correlation_id', async () => {
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What are the recommended maintenance intervals?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.metadata).toBeTruthy();
    expect(res.correlationId).toBeTruthy();
    if (res.metadata) {
      expect(res.metadata).toHaveProperty('retrieval_quality_score');
      expect(res.metadata).toHaveProperty('confidence');
      expect(res.metadata).toHaveProperty('correlation_id');
    }
  });

  test('response includes rate limit headers', async () => {
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What filters should I use?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    // Rate limit headers are only set for tiers with a daily limit (not enterprise/unlimited)
    const limit = res.headers.get('x-ratelimit-limit');
    if (limit) {
      expect(parseInt(limit)).toBeGreaterThan(0);
      expect(res.headers.get('x-ratelimit-used')).toBeTruthy();
    }
  });
});

test.describe('Blocked Topics', () => {
  test.slow();

  test('query matching blocked_topics returns 403', async () => {
    const adminClient = getAdminClient();
    // Set a blocked topic temporarily
    await adminClient
      .from('tenant_ai_policies')
      .update({ blocked_topics: ['chocolate cake recipe'] })
      .eq('tenant_id', tenantId);

    try {
      const res = await client.sendRawRequest(
        { messages: [{ role: 'user', content: 'Tell me the chocolate cake recipe' }] },
        adminToken,
      );
      expect(res.status).toBe(403);
      expect(res.body).toContain('restricted');
    } finally {
      await adminClient
        .from('tenant_ai_policies')
        .update({ blocked_topics: [] })
        .eq('tenant_id', tenantId);
    }
  });

  test('query NOT matching blocked_topics succeeds', async () => {
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'How do I check refrigerant levels?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.streamedContent.length).toBeGreaterThan(0);
  });
});
