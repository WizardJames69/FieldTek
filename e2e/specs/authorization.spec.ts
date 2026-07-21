/**
 * HTTP-level authorization regression suite (PR-TEST-3).
 *
 * Locks the object-level authorization boundaries closed by PR-SEC-5 (B1–B4) and
 * PR-SEC-6 (Gap 1 field-assistant conversation ownership, Gap 2 send-beta-approval
 * platform-admin gate) at the HTTP layer, against the deployed functions.
 *
 * Every identity and record is DISPOSABLE and per-run-namespaced (see
 * authz-fixtures.ts) — no dependency on the shared global-setup fixtures, no
 * persistent credentials. The service-role key is used ONLY in node-context
 * helpers (never a browser page). Cross-tenant denials are asserted to be generic
 * (foreign ≡ nonexistent ≡ malformed) and side-effect-free (DB snapshots).
 */

import { test, expect } from '@playwright/test';
import {
  provisionAuthzFixtures,
  teardownAuthzFixtures,
  type AuthzFixtures,
} from '../helpers/authz-fixtures';
import { signIn, invokeFunction, pollUntil, adminCount, adminSelect } from '../helpers/authz-http';
import { createAIClient, type AIAPIClient } from '../helpers/ai-api-client';
import { getAdminClient } from '../helpers/supabase-admin';

let fx: AuthzFixtures;
let aiClient: AIAPIClient;
const tokens: Record<string, string> = {};

test.beforeAll(async () => {
  fx = await provisionAuthzFixtures();
  aiClient = createAIClient();
  tokens.aOwner = await signIn(fx.tenantA.owner.email, fx.password);
  tokens.aTech = await signIn(fx.tenantA.tech.email, fx.password);
  tokens.aAdmin = await signIn(fx.tenantA.admin.email, fx.password);
  tokens.bTech = await signIn(fx.tenantB.tech.email, fx.password);
  tokens.platformAdmin = await signIn(fx.platformAdmin.email, fx.password);
  tokens.ordinary = await signIn(fx.ordinaryUser.email, fx.password);
});

test.afterAll(async () => {
  if (!fx) return;
  const { residue } = await teardownAuthzFixtures(fx);
  if (residue.length) console.warn('[authz teardown residue]', residue);
  expect(residue, `teardown left residue: ${residue.join('; ')}`).toHaveLength(0);
});

// ── B1: generate-invoice-pdf ──────────────────────────────────
test.describe('B1 generate-invoice-pdf — object-level authorization', () => {
  const NOT_FOUND = { error: 'Invoice not found' };

  test('owner + own invoice → 200 (authorized; PDF once PR-APP-6 is deployed)', async () => {
    const res = await invokeFunction('generate-invoice-pdf', {
      bearer: tokens.aOwner,
      body: { invoiceId: fx.tenantA.invoiceId },
    });
    // Authorization is deploy-independent: an owner of the invoice's tenant is
    // allowed (200, not the generic 404). The response FORMAT flips from HTML to
    // application/pdf only after PR-APP-6 ships, so the PDF assertion is gated on
    // INVOICE_PDF_DEPLOYED=1 (mirrors SEND_BETA_APPROVAL_SEAM_DEPLOYED) to keep CI
    // green until the gated deploy lands.
    expect(res.status).toBe(200);
    if (process.env.INVOICE_PDF_DEPLOYED === '1') {
      expect(res.headers.get('content-type') ?? '').toContain('application/pdf');
      expect(res.body.startsWith('%PDF-')).toBe(true);
    }
  });

  test('technician + own invoice → 404 (technician is not a staff role)', async () => {
    const res = await invokeFunction('generate-invoice-pdf', {
      bearer: tokens.aTech,
      body: { invoiceId: fx.tenantA.invoiceId },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual(NOT_FOUND);
  });

  test('owner + foreign-tenant invoice → generic 404', async () => {
    const res = await invokeFunction('generate-invoice-pdf', {
      bearer: tokens.aOwner,
      body: { invoiceId: fx.tenantB.invoiceId },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual(NOT_FOUND);
  });

  test('unauthenticated → 401', async () => {
    const res = await invokeFunction('generate-invoice-pdf', {
      body: { invoiceId: fx.tenantA.invoiceId },
    });
    expect(res.status).toBe(401);
  });

  test('foreign, nonexistent and malformed ids are indistinguishable + leak no content', async () => {
    const foreign = await invokeFunction('generate-invoice-pdf', {
      bearer: tokens.aOwner,
      body: { invoiceId: fx.tenantB.invoiceId },
    });
    const missing = await invokeFunction('generate-invoice-pdf', {
      bearer: tokens.aOwner,
      body: { invoiceId: '00000000-0000-0000-0000-000000000000' },
    });
    const malformed = await invokeFunction('generate-invoice-pdf', {
      bearer: tokens.aOwner,
      body: { invoiceId: 'not-a-uuid' },
    });
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(404);
    // Byte-identical bodies → non-enumerating (existence not revealed).
    expect(foreign.body).toEqual(missing.body);
    expect(missing.body).toEqual(malformed.body);
    // Tenant B's invoice number must never surface in Tenant A's caller response.
    expect(foreign.body).not.toContain(`AUTHZ-B-${fx.runId}`);
  });
});

// ── B2: collect-workflow-intelligence ─────────────────────────
test.describe('B2 collect-workflow-intelligence — service-role only', () => {
  const anonKey = () => process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  test('no bearer → 401', async () => {
    const res = await invokeFunction('collect-workflow-intelligence', {
      body: { job_id: fx.tenantA.jobId },
    });
    expect(res.status).toBe(401);
  });

  test('invalid bearer → 401', async () => {
    const res = await invokeFunction('collect-workflow-intelligence', {
      bearer: 'not-a-real-token',
      body: { job_id: fx.tenantA.jobId },
    });
    expect(res.status).toBe(401);
  });

  test('ordinary authenticated user JWT → 401 (not a service-role bearer)', async () => {
    const res = await invokeFunction('collect-workflow-intelligence', {
      bearer: tokens.aOwner,
      body: { job_id: fx.tenantA.jobId },
    });
    expect(res.status).toBe(401);
  });

  test('publishable/anon key alone → 401', async () => {
    const res = await invokeFunction('collect-workflow-intelligence', {
      bearer: anonKey(),
      body: { job_id: fx.tenantA.jobId },
    });
    expect(res.status).toBe(401);
  });

  test('trusted service-role caller → 200 (accepted or feature-disabled skip)', async () => {
    // NODE-ONLY service-role bearer — the trusted internal-caller path. With the
    // workflow_intelligence flag off it returns 200 {skipped:true}; on it processes.
    // Either way it is ACCEPTED (past auth) and returns 200 — that is the contract.
    const res = await invokeFunction('collect-workflow-intelligence', {
      serviceRole: true,
      body: { job_id: fx.tenantA.jobId },
    });
    expect(res.status).toBe(200);
  });
});

// ── B3: tenant role protection (PostgREST layer) ──────────────
test.describe('B3 tenant role protection — trigger blocks escalation', () => {
  const url = () => process.env.VITE_SUPABASE_URL as string;
  const anon = () => process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  async function patchRole(token: string, tenantId: string, userId: string, role: string) {
    const res = await fetch(
      `${url()}/rest/v1/tenant_users?tenant_id=eq.${tenantId}&user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: anon(),
          Authorization: `Bearer ${token}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ role }),
      },
    );
    return { status: res.status, body: await res.text() };
  }

  async function roleOf(userId: string): Promise<string> {
    const rows = await adminSelect('tenant_users', 'role', {
      tenant_id: fx.tenantA.id,
      user_id: userId,
    });
    return rows[0]?.role as string;
  }

  test('admin cannot promote a technician to owner (DB unchanged)', async () => {
    const before = await roleOf(fx.tenantA.tech.id);
    const res = await patchRole(tokens.aAdmin, fx.tenantA.id, fx.tenantA.tech.id, 'owner');
    expect(res.status).toBeGreaterThanOrEqual(400); // trigger raised, not a 2xx
    expect(await roleOf(fx.tenantA.tech.id)).toBe(before);
  });

  test('admin cannot self-promote to owner (DB unchanged)', async () => {
    const before = await roleOf(fx.tenantA.admin.id);
    const res = await patchRole(tokens.aAdmin, fx.tenantA.id, fx.tenantA.admin.id, 'owner');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await roleOf(fx.tenantA.admin.id)).toBe(before);
  });

  test('owner CAN make a legitimate non-owner role change', async () => {
    const res = await patchRole(tokens.aOwner, fx.tenantA.id, fx.tenantA.tech.id, 'dispatcher');
    expect(res.status).toBeLessThan(300);
    expect(await roleOf(fx.tenantA.tech.id)).toBe('dispatcher');
    // restore so later specs see the technician role they expect
    await patchRole(tokens.aOwner, fx.tenantA.id, fx.tenantA.tech.id, 'technician');
  });
});

// ── B4: verify-step-evidence ──────────────────────────────────
test.describe('B4 verify-step-evidence — job ownership + generic 404', () => {
  const JOB_NOT_FOUND = { error: 'Job not found' };
  const evidence = { photo_url: 'https://example.invalid/evidence.jpg' };
  const body = (jobId: string, extra: Record<string, unknown> = {}) => ({
    job_id: jobId,
    checklist_item_id: `authz-item-${fx.runId}`,
    stage_name: 'On Site',
    evidence,
    ...extra,
  });

  test('no auth → 401', async () => {
    const res = await invokeFunction('verify-step-evidence', { body: body(fx.tenantA.jobId) });
    expect(res.status).toBe(401);
  });

  test('invalid bearer → 401', async () => {
    const res = await invokeFunction('verify-step-evidence', {
      bearer: 'garbage',
      body: body(fx.tenantA.jobId),
    });
    expect(res.status).toBe(401);
  });

  test('tenant-A technician + own job → 200 verified', async () => {
    const res = await invokeFunction('verify-step-evidence', {
      bearer: tokens.aTech,
      body: body(fx.tenantA.jobId),
    });
    expect(res.status).toBe(200);
    expect(res.json?.status).toBe('verified');
  });

  test('tenant-A technician + Tenant B job → generic 404', async () => {
    const res = await invokeFunction('verify-step-evidence', {
      bearer: tokens.aTech,
      body: body(fx.tenantB.jobId),
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual(JOB_NOT_FOUND);
  });

  test('malformed job id → same generic 404', async () => {
    const res = await invokeFunction('verify-step-evidence', {
      bearer: tokens.aTech,
      body: body('not-a-uuid'),
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual(JOB_NOT_FOUND);
  });

  test('step_execution_id supplied while stream inactive → still 200, no persistence failure', async () => {
    const res = await invokeFunction('verify-step-evidence', {
      bearer: tokens.aTech,
      body: body(fx.tenantA.jobId, {
        step_execution_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    expect(res.status).toBe(200);
    expect(res.json?.status).toBe('verified');
  });

  test('no cross-tenant evidence row was created', async () => {
    const rows = await adminSelect('workflow_step_evidence', 'id', { tenant_id: fx.tenantB.id });
    expect(rows.length).toBe(0);
  });
});

// ── PR-SEC-6 Gap 1: field-assistant conversation ownership ────
test.describe('Gap 1 field-assistant conversation ownership', () => {
  const GOLDEN = {
    messages: [
      { role: 'user', content: 'What is the startup procedure for the Carrier 24ACC636?' },
    ],
    context: { industry: 'hvac' },
  };

  // The ownership guard runs in trackConversation AFTER a served model answer, so
  // the request must actually answer (not abstain). Retry a few times to tolerate
  // model nondeterminism; the ownership assertions themselves are deterministic.
  async function sendAsOwner(conversationId?: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await aiClient.sendRawRequest({ ...GOLDEN, conversationId }, tokens.aOwner);
      if (res.status === 200) return res;
    }
    throw new Error('field-assistant did not return 200 after 3 attempts');
  }

  const ownerConvCount = () =>
    adminCount('conversations', { tenant_id: fx.tenantA.id, user_id: fx.tenantA.owner.id });

  test('own conversation id → reused (messages written to it)', async () => {
    test.slow();
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('conversations')
      .insert({ tenant_id: fx.tenantA.id, user_id: fx.tenantA.owner.id, title: 'authz owned' })
      .select('id')
      .single();
    expect(error).toBeNull();
    const ownId = data!.id as string;
    const before = await adminCount('messages', { conversation_id: ownId });
    await sendAsOwner(ownId);
    await pollUntil(
      async () => ((await adminCount('messages', { conversation_id: ownId })) > before ? true : null),
      { timeoutMs: 30000, label: 'messages written to owned conversation' },
    );
  });

  test('foreign conversation id → zero new messages; fresh caller-owned conversation created', async () => {
    test.slow();
    const foreignId = fx.tenantB.conversationId;
    const foreignBefore = await adminCount('messages', { conversation_id: foreignId });
    const ownBefore = await ownerConvCount();
    const res = await sendAsOwner(foreignId);
    expect(res.status).toBe(200); // no existence leak — a normal answer
    await pollUntil(async () => ((await ownerConvCount()) > ownBefore ? true : null), {
      timeoutMs: 30000,
      label: 'fresh caller-owned conversation after foreign id',
    });
    // The foreign (Tenant B) conversation must have received NO new messages.
    expect(await adminCount('messages', { conversation_id: foreignId })).toBe(foreignBefore);
  });

  test('malformed conversation id → safe new conversation, no leak', async () => {
    test.slow();
    const ownBefore = await ownerConvCount();
    const res = await sendAsOwner('not-a-uuid-conversation-id');
    expect(res.status).toBe(200);
    await pollUntil(async () => ((await ownerConvCount()) > ownBefore ? true : null), {
      timeoutMs: 30000,
      label: 'new conversation after malformed id',
    });
  });
});

// ── PR-SEC-6 Gap 2: send-beta-approval platform-admin gate ────
test.describe('Gap 2 send-beta-approval — platform-admin authorization', () => {
  const validBody = () => ({
    email: 'authz-probe-donotsend@example.invalid',
    companyName: 'AuthZ Probe',
    promoCode: 'AUTHZ-PROBE',
    applicationId: fx.betaApplicationId,
  });

  async function emailSentAt(): Promise<unknown> {
    const rows = await adminSelect('beta_applications', 'email_sent_at', { id: fx.betaApplicationId });
    return rows[0]?.email_sent_at ?? null;
  }

  test('no bearer → 401 (gateway verify_jwt enabled)', async () => {
    const res = await invokeFunction('send-beta-approval', { body: validBody() });
    expect(res.status).toBe(401);
  });

  test('invalid bearer → 401', async () => {
    const res = await invokeFunction('send-beta-approval', { bearer: 'garbage', body: validBody() });
    expect(res.status).toBe(401);
  });

  test('ordinary authenticated user → 403, no email, no write', async () => {
    const before = await emailSentAt();
    const res = await invokeFunction('send-beta-approval', {
      bearer: tokens.ordinary,
      body: validBody(),
    });
    expect(res.status).toBe(403);
    expect(await emailSentAt()).toEqual(before);
  });

  test('tenant-admin (not platform admin) → 403, no email, no write', async () => {
    const before = await emailSentAt();
    const res = await invokeFunction('send-beta-approval', {
      bearer: tokens.aAdmin,
      body: validBody(),
    });
    expect(res.status).toBe(403);
    expect(await emailSentAt()).toEqual(before);
  });

  test('platform admin + missing fields → 400 (reaches handler, no email, no write)', async () => {
    const before = await emailSentAt();
    const res = await invokeFunction('send-beta-approval', {
      bearer: tokens.platformAdmin,
      body: { email: 'authz-probe-donotsend@example.invalid', companyName: 'AuthZ Probe', applicationId: fx.betaApplicationId }, // no promoCode
    });
    expect(res.status).toBe(400);
    expect(await emailSentAt()).toEqual(before);
  });

  test('platform admin + valid body → 200 via email sink, only disposable app updated', async () => {
    test.skip(
      process.env.SEND_BETA_APPROVAL_SEAM_DEPLOYED !== '1',
      'Email seam not deployed to send-beta-approval; allow-path covered by authz.test.ts unit tests. ' +
        'Set SEND_BETA_APPROVAL_SEAM_DEPLOYED=1 after redeploying with BETA_APPROVAL_EMAIL_SINK=1.',
    );
    const res = await invokeFunction('send-beta-approval', {
      bearer: tokens.platformAdmin,
      body: validBody(),
    });
    expect(res.status).toBe(200);
    expect(res.json?.messageId).toBe('e2e-sink'); // canned → no real Resend delivery occurred
    // Only the disposable application row was stamped.
    expect(await emailSentAt()).not.toBeNull();
  });
});
