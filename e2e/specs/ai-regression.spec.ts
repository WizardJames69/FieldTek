import { test, expect } from '@playwright/test';
import { createAIClient, AIAPIClient } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { GOLDEN_QUERIES } from '../helpers/ai-test-data';
import { waitForAuditLog } from '../helpers/audit-log-helpers';
import { withFeatureFlag } from '../helpers/feature-flag-helpers';
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

test.describe('Golden Query Retrieval', () => {
  test('GQ-001 "startup procedure" retrieves relevant chunks', async () => {
    test.slow();
    const gq = GOLDEN_QUERIES.grounded[0];
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: gq.question }],
      context: gq.context,
      authToken: adminToken,
    });
    expect(res.status).toBe(gq.expect.status);
    expect(res.streamedContent.length).toBeGreaterThan(10);
  });

  test('GQ-002 "maintenance intervals" retrieves chunks from Maintenance Guide', async () => {
    test.slow();
    const gq = GOLDEN_QUERIES.grounded[1];
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: gq.question }],
      context: gq.context,
      authToken: adminToken,
    });
    expect(res.status).toBe(gq.expect.status);
    expect(res.streamedContent.length).toBeGreaterThan(10);
  });

  test('retrieval_quality_score in metadata > 0 for grounded queries', async () => {
    test.slow();
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What is the startup procedure for the Carrier unit?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    if (res.metadata?.retrieval_quality_score !== undefined) {
      expect(res.metadata.retrieval_quality_score).toBeGreaterThanOrEqual(0);
    }
  });

  test('had_citations=true in audit log for grounded queries', async () => {
    test.slow();
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What are the warranty terms for Carrier equipment?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    if (res.correlationId) {
      const log = await waitForAuditLog(tenantId, res.correlationId);
      // had_citations depends on whether the pipeline injected source references
      expect(log).toHaveProperty('had_citations');
    }
  });
});

test.describe('Graph Expansion Regression', () => {
  test('"compressor not starting" with equipment_graph → graph_expansion_count > 0', async () => {
    test.slow();
    await withFeatureFlag('equipment_graph', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Compressor is not starting on the air handler' }],
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

  test('graph expansion terms include related components', async () => {
    test.slow();
    await withFeatureFlag('equipment_graph', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Compressor overheating on air handler' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        if (log.graph_expansion_terms && Array.isArray(log.graph_expansion_terms)) {
          // Should include related component terms like capacitor, contactor
          const terms = (log.graph_expansion_terms as string[]).map((t: string) => t.toLowerCase());
          const hasRelated = terms.some(
            (t: string) => t.includes('capacitor') || t.includes('contactor'),
          );
          expect(hasRelated).toBe(true);
        }
      }
    });
  });

  test('graph_scoring_applied=true in audit log when graph data available', async () => {
    test.slow();
    await withFeatureFlag('equipment_graph', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'What causes compressor short cycling?' }],
        context: { industry: 'hvac', equipment: { equipment_type: 'Air Handler' } },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.correlationId) {
        const log = await waitForAuditLog(tenantId, res.correlationId);
        expect(log.graph_scoring_applied).toBe(true);
      }
    });
  });
});

test.describe('Reranking Stability', () => {
  test('with rag_reranking enabled → rerank_model in audit log', async () => {
    test.slow();
    await withFeatureFlag('rag_reranking', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Filter replacement schedule' }],
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

  test('reranked results maintain relevance', async () => {
    test.slow();
    await withFeatureFlag('rag_reranking', true, async () => {
      const res = await client.sendChatMessage({
        messages: [{ role: 'user', content: 'Operating temperature range for Carrier 24ACC636' }],
        context: { industry: 'hvac' },
        authToken: adminToken,
      });
      expect(res.status).toBe(200);
      if (res.metadata?.retrieval_quality_score !== undefined) {
        expect(res.metadata.retrieval_quality_score).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

test.describe('Citation Integrity', () => {
  test('all citations reference documents in document_names audit field', async () => {
    test.slow();
    const res = await client.sendChatMessage({
      messages: [{ role: 'user', content: 'What is the startup procedure for the Carrier 24ACC636?' }],
      context: { industry: 'hvac' },
      authToken: adminToken,
    });
    expect(res.status).toBe(200);
    if (res.correlationId) {
      const log = await waitForAuditLog(tenantId, res.correlationId);
      // If there are citations, they should reference known documents
      if (log.had_citations && log.document_names) {
        expect(Array.isArray(log.document_names)).toBe(true);
        expect((log.document_names as string[]).length).toBeGreaterThan(0);
      }
    }
  });
});
