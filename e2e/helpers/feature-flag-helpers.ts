/**
 * Feature flag helpers for AI E2E tests.
 * Toggle flags via direct DB operations with try/finally cleanup.
 */

import { getAdminClient } from './supabase-admin';

export async function setFeatureFlag(
  flagKey: string,
  enabled: boolean,
  rolloutPct?: number,
  options?: {
    allowed_tenant_ids?: string[];
    blocked_tenant_ids?: string[];
  },
): Promise<void> {
  const client = getAdminClient();
  const update: Record<string, unknown> = { is_enabled: enabled };
  if (rolloutPct !== undefined) update.rollout_percentage = rolloutPct;
  if (options?.allowed_tenant_ids) update.allowed_tenant_ids = options.allowed_tenant_ids;
  if (options?.blocked_tenant_ids) update.blocked_tenant_ids = options.blocked_tenant_ids;

  const { error } = await client.from('feature_flags').update(update).eq('key', flagKey);
  if (error) throw new Error(`Failed to set feature flag "${flagKey}": ${error.message}`);
}

export async function getFeatureFlag(flagKey: string) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('feature_flags')
    .select('*')
    .eq('key', flagKey)
    .single();
  if (error) throw new Error(`Failed to get feature flag "${flagKey}": ${error.message}`);
  return data;
}

/**
 * Temporarily enable/disable a feature flag for the duration of `fn`.
 * Restores original state in `finally`, even on error.
 */
export async function withFeatureFlag<T>(
  flagKey: string,
  enabled: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const original = await getFeatureFlag(flagKey);
  try {
    await setFeatureFlag(flagKey, enabled, enabled ? 100 : 0);
    return await fn();
  } finally {
    if (original) {
      await setFeatureFlag(flagKey, original.is_enabled, original.rollout_percentage);
    }
  }
}

/** Reset all AI feature flags to disabled/0%. */
export async function resetAllFlags(): Promise<void> {
  const client = getAdminClient();
  const { error } = await client
    .from('feature_flags')
    .update({ is_enabled: false, rollout_percentage: 0 })
    .in('key', [
      'rag_judge',
      'rag_reranking',
      'compliance_engine',
      'equipment_graph',
      'judge_blocking_mode',
      'judge_full_blocking',
      'workflow_intelligence',
      'diagnostic_learning',
      'diagnostic_probability_ranking',
    ]);
  if (error) throw new Error(`Failed to reset feature flags: ${error.message}`);
}
