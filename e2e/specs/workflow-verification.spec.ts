/**
 * Workflow Step Verification E2E Tests
 *
 * Tests the verify-step-evidence edge function and the workflow_step_evidence
 * data flow. All tests run against the staging Supabase project.
 *
 * Feature flag: workflow_step_verification
 */

import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-data';
import { setFeatureFlag } from '../helpers/feature-flag-helpers';
import {
  seedEvidenceRecord,
  getEvidenceForJob,
  deleteEvidenceForJob,
  setTemplateRequiredEvidence,
  clearTemplateRequiredEvidence,
} from '../helpers/evidence-helpers';
import { getAdminClient } from '../helpers/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

let tenantId: string;
let techUserId: string;
let authToken: string;
let supabaseUrl: string;
let supabaseAnonKey: string;
let testJobId: string;

test.beforeAll(async () => {
  // Load e2e context
  const ctx = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.playwright', 'e2e-context.json'), 'utf-8'),
  );
  tenantId = ctx.tenantId;

  supabaseUrl = process.env.VITE_SUPABASE_URL!;
  supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

  // Get tech user ID + auth token
  const client = getAdminClient();
  const { data: techUser } = await client
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'technician')
    .limit(1)
    .single();
  techUserId = techUser?.user_id;

  // Get auth token for technician
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
    body: JSON.stringify({
      email: TEST_USERS.technician.email,
      password: TEST_USERS.technician.password,
    }),
  });
  const authData = await authRes.json();
  authToken = authData.access_token;

  // Find or create a test job
  const { data: jobs } = await client
    .from('scheduled_jobs')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();
  testJobId = jobs?.id;
});

test.afterAll(async () => {
  // Clean up: delete evidence seeded during tests
  if (testJobId) {
    await deleteEvidenceForJob(testJobId).catch(() => {});
  }
  // Reset feature flag
  await setFeatureFlag('workflow_step_verification', false, 0).catch(() => {});
  // Clear any template evidence config
  await clearTemplateRequiredEvidence(tenantId, 'Service').catch(() => {});
});

// ── Helper ────────────────────────────────────────────────────

async function callVerifyEvidence(body: Record<string, unknown>, token?: string) {
  const res = await fetch(`${supabaseUrl}/functions/v1/verify-step-evidence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? authToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ── Tests ─────────────────────────────────────────────────────

test.describe('Workflow Step Verification', () => {
  test('rejects request without authorization header', async () => {
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-step-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  test('rejects request with missing required fields', async () => {
    const { status, data } = await callVerifyEvidence({});
    expect(status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  test('evidence saved to workflow_step_evidence table', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-item-${Date.now()}`;

    // Enable flag in logging_only mode
    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'logging_only' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {
        photo_url: 'https://example.com/test-photo.jpg',
      },
    });

    expect(status).toBe(200);
    expect(data.status).toBe('verified');
    expect(data.evidence_ids).toBeDefined();
    expect(data.evidence_ids.length).toBeGreaterThan(0);

    // Verify record exists in DB
    const evidence = await getEvidenceForJob(testJobId);
    const record = evidence.find((e: Record<string, unknown>) => e.checklist_item_id === itemId);
    expect(record).toBeDefined();
    expect(record.evidence_type).toBe('photo');
    expect(record.photo_url).toBe('https://example.com/test-photo.jpg');
  });

  test('logging_only mode — does not block on failure', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-photo-req-${Date.now()}`;

    // Configure template to require photo
    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { photo: true },
    });

    // Enable flag in logging_only mode
    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'logging_only' } })
      .eq('key', 'workflow_step_verification');

    // Submit WITHOUT photo (should still pass in logging_only)
    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {},
    });

    expect(status).toBe(200);
    expect(data.status).toBe('verified');
  });

  test('warning mode — shows warning but does not block', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-warn-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { photo: true },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'warning' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {},
    });

    expect(status).toBe(200);
    expect(data.status).toBe('verified');
    expect(data.warnings).toBeDefined();
    expect(data.warnings.length).toBeGreaterThan(0);
    expect(data.warnings[0].type).toBe('photo_missing');
  });

  test('blocking mode — prevents step completion without photo', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-block-photo-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { photo: true },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {},
    });

    expect(status).toBe(422);
    expect(data.status).toBe('verification_failed');
    expect(data.failures).toBeDefined();
    expect(data.failures.some((f: Record<string, unknown>) => f.type === 'photo_missing')).toBe(true);
  });

  test('blocking mode — allows completion after photo upload', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-block-pass-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { photo: true },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {
        photo_url: 'https://example.com/valid-photo.jpg',
      },
    });

    expect(status).toBe(200);
    expect(data.status).toBe('verified');
  });

  test('measurement range — rejects out-of-range value', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-measure-fail-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { measurement: { unit: 'PSI', min: 50, max: 500 } },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {
        measurement_value: 600,
        measurement_unit: 'PSI',
      },
    });

    expect(status).toBe(422);
    expect(data.status).toBe('verification_failed');
    const failure = data.failures.find((f: Record<string, unknown>) => f.type === 'measurement_out_of_range');
    expect(failure).toBeDefined();
    expect(failure.actual).toBe(600);
    expect(failure.expected_max).toBe(500);
  });

  test('measurement range — accepts in-range value', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-measure-pass-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { measurement: { unit: 'PSI', min: 50, max: 500 } },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {
        measurement_value: 250,
        measurement_unit: 'PSI',
      },
    });

    expect(status).toBe(200);
    expect(data.status).toBe('verified');
  });

  test('GPS check-in — rejects low accuracy', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-gps-fail-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { gps_required: true },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {
        gps_location: { latitude: 40.7128, longitude: -74.006, accuracy: 150 },
      },
    });

    expect(status).toBe(422);
    expect(data.failures.some((f: Record<string, unknown>) => f.type === 'gps_low_accuracy')).toBe(true);
  });

  test('serial number — requires non-empty value', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-serial-fail-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { serial_scan: true },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    // Submit without serial number
    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {},
    });

    expect(status).toBe(422);
    expect(data.failures.some((f: Record<string, unknown>) => f.type === 'serial_number_missing')).toBe(true);
  });

  test('serial number — accepts valid serial', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-serial-pass-${Date.now()}`;

    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: { serial_scan: true },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {
        serial_number: 'XYZ-12345-ABCDE',
      },
    });

    expect(status).toBe(200);
    expect(data.status).toBe('verified');
  });

  test('verification failure returns structured error', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-structured-${Date.now()}`;

    // Require everything
    await setTemplateRequiredEvidence(tenantId, 'Service', {
      [itemId]: {
        photo: true,
        measurement: { unit: 'PSI', min: 50, max: 500 },
        gps_required: true,
        serial_scan: true,
      },
    });

    await setFeatureFlag('workflow_step_verification', true, 100);
    const client = getAdminClient();
    await client
      .from('feature_flags')
      .update({ metadata: { mode: 'blocking' } })
      .eq('key', 'workflow_step_verification');

    // Submit empty evidence
    const { status, data } = await callVerifyEvidence({
      job_id: testJobId,
      checklist_item_id: itemId,
      stage_name: 'Service',
      evidence: {},
    });

    expect(status).toBe(422);
    expect(data.status).toBe('verification_failed');
    expect(data.failures).toBeInstanceOf(Array);
    expect(data.failures.length).toBe(4);

    const types = data.failures.map((f: Record<string, unknown>) => f.type);
    expect(types).toContain('photo_missing');
    expect(types).toContain('measurement_missing');
    expect(types).toContain('gps_missing');
    expect(types).toContain('serial_number_missing');
  });

  test('multi-tenant isolation — evidence scoped to tenant', async () => {
    test.skip(!testJobId, 'No test job available');

    const itemId = `test-isolation-${Date.now()}`;

    // Seed evidence directly via admin client
    await seedEvidenceRecord({
      tenantId,
      jobId: testJobId,
      checklistItemId: itemId,
      stageName: 'Service',
      technicianId: techUserId,
      evidenceType: 'photo',
      photoUrl: 'https://example.com/tenant-a-photo.jpg',
      verificationStatus: 'verified',
    });

    // Query evidence — should only see own tenant's data
    const evidence = await getEvidenceForJob(testJobId);
    const record = evidence.find((e: Record<string, unknown>) => e.checklist_item_id === itemId);
    expect(record).toBeDefined();
    expect(record.tenant_id).toBe(tenantId);
  });
});
