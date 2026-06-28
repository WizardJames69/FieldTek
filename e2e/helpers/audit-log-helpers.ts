/**
 * Audit log helpers for AI E2E tests.
 * Poll/verify audit logs with exponential backoff.
 */

import { getAdminClient } from './supabase-admin';
import { pollUntilJudgeComplete, type JudgeWaitResult } from '../../evals/observe';

/** Poll for an audit log entry by correlation_id with exponential backoff. */
export async function waitForAuditLog(
  tenantId: string,
  correlationId: string,
  timeoutMs = 15000,
): Promise<Record<string, unknown>> {
  const client = getAdminClient();
  const start = Date.now();
  let delay = 500;

  while (Date.now() - start < timeoutMs) {
    const { data } = await client
      .from('ai_audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('correlation_id', correlationId)
      .single();

    if (data) return data;

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 4000);
  }

  throw new Error(
    `Audit log not found for correlation_id=${correlationId} within ${timeoutMs}ms`,
  );
}

/**
 * Judge-aware audit wait — used ONLY by the --judge-check probe / cases carrying
 * an expectedJudge assertion. The advisory judge (rag_judge) updates the SAME
 * audit row ~1s AFTER it is first inserted, so `waitForAuditLog` (returns on first
 * existence) would observe judge_grounded=null. This first preserves the initial
 * existence wait, then re-polls the same row (by correlation id) until the async
 * judge reaches a terminal state or a bounded timeout expires. The default
 * 11-case path keeps `waitForAuditLog` and inherits none of this latency.
 */
export async function waitForJudgeAuditLog(
  tenantId: string,
  correlationId: string,
  opts: { rowTimeoutMs?: number; judgeTimeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<JudgeWaitResult> {
  const client = getAdminClient();
  // 1. Preserve the initial audit-row existence wait (throws if the row never
  //    appears — same contract as before).
  const initial = await waitForAuditLog(tenantId, correlationId, opts.rowTimeoutMs ?? 15000);
  // 2. Re-poll the SAME row until the async judge fields populate (bounded).
  return pollUntilJudgeComplete(
    initial,
    async () => {
      const { data } = await client
        .from('ai_audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('correlation_id', correlationId)
        .single();
      return (data as Record<string, unknown> | null) ?? null;
    },
    { sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now() },
    { judgeTimeoutMs: opts.judgeTimeoutMs ?? 10000, pollIntervalMs: opts.pollIntervalMs ?? 500 },
  );
}

/** Get the most recent audit log for a tenant. */
export async function getLatestAuditLog(tenantId: string) {
  const client = getAdminClient();
  const { data } = await client
    .from('ai_audit_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

/** Count audit logs for a tenant, optionally since a timestamp. */
export async function getAuditLogCount(
  tenantId: string,
  since?: string,
): Promise<number> {
  const client = getAdminClient();
  let q = client
    .from('ai_audit_logs')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId);
  if (since) q = q.gte('created_at', since);
  const { count } = await q;
  return count ?? 0;
}

/** Seed synthetic audit logs (for rate-limit and dashboard tests). */
export async function seedAuditLogs(
  tenantId: string,
  userId: string,
  count: number,
): Promise<void> {
  const client = getAdminClient();
  const logs = Array.from({ length: count }, (_, i) => ({
    tenant_id: tenantId,
    user_id: userId,
    user_message: `Rate limit test query ${i}`,
    ai_response: `Test response ${i}`,
    response_blocked: false,
    response_time_ms: 500,
    model_used: 'test',
    correlation_id: crypto.randomUUID(),
  }));
  const { error } = await client.from('ai_audit_logs').insert(logs);
  if (error) throw new Error(`Failed to seed audit logs: ${error.message}`);
}

/** Delete all audit logs for a tenant. */
export async function cleanupAuditLogs(tenantId: string): Promise<void> {
  const client = getAdminClient();
  await client.from('ai_audit_logs').delete().eq('tenant_id', tenantId);
}
