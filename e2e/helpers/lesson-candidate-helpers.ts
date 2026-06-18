/**
 * Lesson candidate helpers for the Sentinel learning-loop E2E (PR-2).
 *
 * Seeding/cleanup use the service-role admin client (bypasses RLS) and target
 * only the E2E Test Company tenant passed in by the caller. Never point these
 * at the Sentinel Eval Company tenant.
 */

import { getAdminClient } from './supabase-admin';

export interface SeedLessonCandidateOptions {
  status?: 'pending' | 'approved' | 'rejected' | 'archived';
  sourceType?: 'ai_interaction' | 'technician_note' | 'manual';
  question?: string;
  proposedAnswer?: string;
  equipmentType?: string | null;
  auditLogId?: string | null;
  correlationId?: string | null;
}

/** Seed a single lesson candidate for a tenant. Returns the new row id. */
export async function seedLessonCandidate(
  tenantId: string,
  createdBy: string,
  options: SeedLessonCandidateOptions = {},
): Promise<string> {
  const client = getAdminClient();
  const { data, error } = await client
    .from('lesson_candidates')
    .insert({
      tenant_id: tenantId,
      created_by: createdBy,
      source_type: options.sourceType ?? 'ai_interaction',
      status: options.status ?? 'pending',
      question: options.question ?? 'E2E seeded: why is the compressor short-cycling?',
      proposed_answer:
        options.proposedAnswer ?? 'E2E seeded: check the low-pressure switch and refrigerant charge.',
      equipment_type: options.equipmentType ?? 'HVAC Compressor',
      audit_log_id: options.auditLogId ?? null,
      correlation_id: options.correlationId ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to seed lesson candidate: ${error.message}`);
  return data!.id as string;
}

/** Count lesson candidates for a tenant, optionally filtered by status. */
export async function getLessonCandidateCount(
  tenantId: string,
  status?: string,
): Promise<number> {
  const client = getAdminClient();
  let q = client
    .from('lesson_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (status) q = q.eq('status', status);
  const { count } = await q;
  return count ?? 0;
}

/** Fetch the latest lesson candidate for a tenant (e.g. to assert intake result). */
export async function getLatestLessonCandidate(tenantId: string) {
  const client = getAdminClient();
  const { data } = await client
    .from('lesson_candidates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

/** Delete all lesson candidates for a tenant. */
export async function cleanupLessonCandidates(tenantId: string): Promise<void> {
  const client = getAdminClient();
  await client.from('lesson_candidates').delete().eq('tenant_id', tenantId);
}
