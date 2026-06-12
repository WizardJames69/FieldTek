/**
 * Workstream D — tenant-admin compliance-block override.
 *
 * Exercises the override_compliance_block RPC and the field-assistant
 * carry-forward end to end against the deployed staging function:
 *   1. a seeded job at "On Site" with no completions is compliance-blocked
 *   2. a technician CANNOT override (RLS/RPC authz)
 *   3. a too-short reason is rejected
 *   4. an owner/admin override succeeds, stamps audit fields, clears "blocked"
 *   5. the next assistant call does NOT re-block the same rule/stage
 *   6. a different stage still blocks (override is scoped, not a blanket bypass)
 *   7. a cross-tenant admin cannot override (optional, high value)
 *
 * The RPC depends on auth.uid(), so it is called with real USER JWTs via the
 * PostgREST /rpc endpoint — the service-role client (getAdminClient) would make
 * auth.uid() NULL and every call would reject. getAdminClient is used only for
 * privileged seeding / assertions.
 */
import { test, expect } from '@playwright/test';
import { createAIClient, AIAPIClient, hasAssistantContent } from '../helpers/ai-api-client';
import type { ChatResponse } from '../helpers/ai-api-client';
import { TEST_USERS } from '../helpers/test-data';
import { TENANT_B } from '../helpers/ai-test-data';
import { withFeatureFlag } from '../helpers/feature-flag-helpers';
import { getAdminClient } from '../helpers/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const ON_SITE = 'On Site';
const OTHER_STAGE = 'Startup';

let client: AIAPIClient;
let adminToken: string;
let techToken: string;
let tenantBToken: string | null = null;
let tenantId: string;
let adminUserId: string;
let jobId: string;
let originalComplianceEnabled: boolean | null = null;

/** Call a Postgres RPC as a real user (JWT), the way the frontend does. */
async function rpcAsUser(
  token: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* leave as raw text */
  }
  return { status: res.status, body };
}

/** A 200 JSON body with compliance_blocked:true (the block short-circuit). */
function isComplianceBlocked(res: ChatResponse): boolean {
  try {
    const json = JSON.parse(res.body) as Record<string, unknown>;
    return json.compliance_blocked === true;
  } catch {
    return false;
  }
}

/** All verdict rows for the seeded job, newest first. */
async function fetchVerdicts() {
  const { data, error } = await getAdminClient()
    .from('compliance_verdicts')
    .select('id, rule_id, stage_name, verdict, overridden, overridden_by, override_reason, overridden_at, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchVerdicts failed: ${error.message}`);
  return data ?? [];
}

async function fetchJobComplianceStatus(): Promise<string | null> {
  const { data } = await getAdminClient()
    .from('scheduled_jobs')
    .select('compliance_status')
    .eq('id', jobId)
    .single();
  return (data?.compliance_status as string | undefined) ?? null;
}

async function askAtStage(stage: string): Promise<ChatResponse> {
  return withFeatureFlag('compliance_engine', true, async () =>
    client.sendChatMessage({
      messages: [{ role: 'user', content: 'Proceeding with on-site work now.' }],
      context: {
        industry: 'hvac',
        job: { id: jobId, current_stage: stage },
      },
      authToken: adminToken,
    }),
  );
}

test.beforeAll(async () => {
  client = createAIClient();
  adminToken = await client.getAuthToken(TEST_USERS.admin.email, TEST_USERS.admin.password);
  techToken = await client.getAuthToken(TEST_USERS.technician.email, TEST_USERS.technician.password);
  try {
    tenantBToken = await client.getAuthToken(TENANT_B.user.email, TENANT_B.user.password);
  } catch {
    tenantBToken = null; // cross-tenant case is optional
  }

  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
  );
  tenantId = ctx.tenantId;
  adminUserId = ctx.userIds.admin;

  const admin = getAdminClient();

  // complianceActive = compliance_engine flag AND tenant policy column. Enable
  // the policy column for this run; capture the original to restore afterwards.
  const { data: policy } = await admin
    .from('tenant_ai_policies')
    .select('compliance_engine_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  originalComplianceEnabled =
    (policy?.compliance_engine_enabled as boolean | null | undefined) ?? null;
  await admin
    .from('tenant_ai_policies')
    .update({ compliance_engine_enabled: true })
    .eq('tenant_id', tenantId);

  // Seed a fresh job at "On Site" with NO checklist completions so the
  // blocking safety gate + critical prerequisite fire.
  const { data: job, error: jobErr } = await admin
    .from('scheduled_jobs')
    .insert({
      tenant_id: tenantId,
      title: 'E2E - Compliance Override',
      job_type: 'Repair',
      priority: 'high',
      status: 'pending',
      current_stage: ON_SITE,
    })
    .select('id')
    .single();
  if (jobErr || !job) throw new Error(`Failed to seed override test job: ${jobErr?.message}`);
  jobId = job.id;
});

test.afterAll(async () => {
  const admin = getAdminClient();
  // FK ON DELETE CASCADE removes the job's compliance_verdicts.
  if (jobId) await admin.from('scheduled_jobs').delete().eq('id', jobId);
  // Restore the policy column to its pre-test value.
  await admin
    .from('tenant_ai_policies')
    .update({ compliance_engine_enabled: originalComplianceEnabled })
    .eq('tenant_id', tenantId);
});

test.describe.serial('Compliance block admin override', () => {
  test('1. seeded job is compliance-blocked', async () => {
    test.slow();
    const res = await askAtStage(ON_SITE);
    expect(res.status).toBe(200);
    expect(isComplianceBlocked(res)).toBe(true);

    const json = JSON.parse(res.body) as { verdicts?: Array<{ rule_key?: string }> };
    const keys = (json.verdicts ?? []).map((v) => v.rule_key);
    expect(keys).toContain('lockout_tagout_gate');

    // The block short-circuit persisted verdicts; at least one blocking row, none overridden yet.
    const verdicts = await fetchVerdicts();
    expect(verdicts.some((v) => v.verdict === 'block' && v.overridden === false)).toBe(true);
    expect(await fetchJobComplianceStatus()).toBe('blocked');
  });

  test('2. technician CANNOT override', async () => {
    const before = await fetchVerdicts();
    const r = await rpcAsUser(techToken, 'override_compliance_block', {
      p_job_id: jobId,
      p_reason: 'Technician attempting an override that must be rejected',
    });
    expect(r.status).toBeGreaterThanOrEqual(400);

    const after = await fetchVerdicts();
    expect(after.filter((v) => v.overridden).length).toBe(
      before.filter((v) => v.overridden).length,
    );
  });

  test('3. reason under 10 chars is rejected', async () => {
    const before = await fetchVerdicts();
    const r = await rpcAsUser(adminToken, 'override_compliance_block', {
      p_job_id: jobId,
      p_reason: 'too short',
    });
    expect(r.status).toBeGreaterThanOrEqual(400);

    const after = await fetchVerdicts();
    expect(after.filter((v) => v.overridden).length).toBe(
      before.filter((v) => v.overridden).length,
    );
  });

  test('4. owner/admin override succeeds with audit trail', async () => {
    const r = await rpcAsUser(adminToken, 'override_compliance_block', {
      p_job_id: jobId,
      p_reason: 'Verified LOTO and disconnect out-of-band; documented exception for pilot.',
    });
    expect(r.status).toBe(200);
    expect(typeof r.body).toBe('number');
    // Both the blocking safety gate and the critical prerequisite are overridden.
    expect(r.body as number).toBeGreaterThanOrEqual(1);

    const verdicts = await fetchVerdicts();
    const blockRow = verdicts.find((v) => v.verdict === 'block');
    expect(blockRow?.overridden).toBe(true);
    expect(blockRow?.overridden_by).toBe(adminUserId);
    expect(blockRow?.override_reason).toContain('documented exception');
    expect(blockRow?.overridden_at).toBeTruthy();

    expect(await fetchJobComplianceStatus()).not.toBe('blocked');
  });

  test('5. next assistant call does NOT re-block the same stage', async () => {
    test.slow();
    const res = await askAtStage(ON_SITE);
    expect(res.status).toBe(200);
    expect(isComplianceBlocked(res)).toBe(false);
    expect(hasAssistantContent(res)).toBe(true);

    // A fresh verdict for the overridden rule/stage was carried forward as overridden.
    const verdicts = await fetchVerdicts();
    const onSiteBlockRows = verdicts.filter(
      (v) => v.stage_name === ON_SITE && (v.verdict === 'block' || v.verdict === 'fail'),
    );
    expect(onSiteBlockRows.length).toBeGreaterThan(0);
    expect(onSiteBlockRows.every((v) => v.overridden === true)).toBe(true);
  });

  test('6. a different stage still blocks', async () => {
    test.slow();
    // The critical prerequisite (empty workflow_stages) still fails at OTHER_STAGE,
    // and was never overridden there — so the job blocks again.
    const res = await askAtStage(OTHER_STAGE);
    expect(res.status).toBe(200);
    expect(isComplianceBlocked(res)).toBe(true);

    const verdicts = await fetchVerdicts();
    const otherStageBlock = verdicts.filter(
      (v) => v.stage_name === OTHER_STAGE && v.overridden === false &&
        (v.verdict === 'block' || v.verdict === 'fail'),
    );
    expect(otherStageBlock.length).toBeGreaterThan(0);
  });

  test('7. cross-tenant admin cannot override', async () => {
    test.skip(!tenantBToken, 'Tenant B login unavailable');
    const before = await fetchVerdicts();
    const r = await rpcAsUser(tenantBToken!, 'override_compliance_block', {
      p_job_id: jobId,
      p_reason: 'Cross-tenant override attempt that must be rejected',
    });
    expect(r.status).toBeGreaterThanOrEqual(400);

    const after = await fetchVerdicts();
    expect(after.filter((v) => v.overridden).length).toBe(
      before.filter((v) => v.overridden).length,
    );
  });
});
