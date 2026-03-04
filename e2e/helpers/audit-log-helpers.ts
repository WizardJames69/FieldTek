/**
 * Audit log helpers for AI E2E tests.
 * Poll/verify audit logs with exponential backoff.
 */

import { getAdminClient } from './supabase-admin';

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
