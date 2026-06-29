/**
 * Feature flag helpers for AI E2E tests.
 *
 * Every mutation is TENANT-SCOPED and EXACTLY reversible against the shared
 * backend: enable/disable is applied only to the E2E tenant, and the exact
 * original row is restored in `finally`/`afterAll`. Durable enablement for other
 * tenants (e.g. rag_judge / lesson_citations allowlisted for the eval + pilot
 * tenants) is never reset. Pure state math lives in ./feature-flag-state.ts.
 *
 * NOTE (shared-backend concurrency): this fixes flag-state ISOLATION only. It
 * does NOT solve concurrent E2E runs deleting each other's shared fgem
 * tenant/user fixtures — a dedicated E2E backend remains the structural
 * follow-up. Always confirm no other E2E run is active before running locally.
 */

import { getAdminClient } from './supabase-admin';
import {
  applyAndRestore,
  assertAllFlagsPresent,
  restorePayload,
  tenantDisabledState,
  tenantEnabledState,
  type FeatureFlagSnapshot,
  type FeatureFlagWrite,
} from './feature-flag-state';

/** AI enhancement flags toggled by the pipeline (used by the all-off wrapper). */
export const ENHANCEMENT_FLAGS = [
  'rag_judge',
  'rag_reranking',
  'compliance_engine',
  'equipment_graph',
  'judge_blocking_mode',
  'judge_full_blocking',
  'workflow_intelligence',
  'diagnostic_learning',
  'diagnostic_probability_ranking',
] as const;

const SNAPSHOT_COLUMNS =
  'key,is_enabled,rollout_percentage,allowed_tenant_ids,blocked_tenant_ids,starts_at,ends_at';

/**
 * Low-level: update specific columns of a flag by key. Kept for tests that
 * deliberately exercise allowlist/blocklist targeting via explicit options.
 */
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
 * Read the snapshot columns for the given flag keys. Fails loudly if any
 * requested flag row is missing rather than returning an incomplete snapshot —
 * an absent row would otherwise silently no-op the override and let a test run
 * without its intended flag state (and never restore it).
 */
export async function snapshotFeatureFlags(keys: readonly string[]): Promise<FeatureFlagSnapshot[]> {
  const client = getAdminClient();
  const { data, error } = await client
    .from('feature_flags')
    .select(SNAPSHOT_COLUMNS)
    .in('key', keys as string[]);
  if (error) throw new Error(`Failed to snapshot feature flags: ${error.message}`);
  const snapshots = (data ?? []) as unknown as FeatureFlagSnapshot[];
  assertAllFlagsPresent(keys, snapshots);
  return snapshots;
}

/** Write the mutable columns of one flag by key. */
async function applyFlagWrite(key: string, write: FeatureFlagWrite): Promise<void> {
  const client = getAdminClient();
  const { error } = await client.from('feature_flags').update(write).eq('key', key);
  if (error) throw new Error(`Failed to write feature flag "${key}": ${error.message}`);
}

/** Restore one flag to its exact snapshot (all six mutable columns). */
async function restoreFeatureFlag(snapshot: FeatureFlagSnapshot): Promise<void> {
  await applyFlagWrite(snapshot.key, restorePayload(snapshot));
}

/**
 * Temporarily enable/disable a feature flag FOR THE E2E TENANT ONLY for the
 * duration of `fn`, restoring the exact original row in `finally`.
 *   - enabled=true  → scope the flag to `tenantId` (never rollout 100); if the
 *     flag was already enabled, preserve its rollout + allowlist and append the
 *     tenant; if disabled, enable it at rollout 0 scoped to this tenant.
 *   - enabled=false → append `tenantId` to blocked_tenant_ids (blocklist wins);
 *     is_enabled / rollout / allowlist for other tenants stay untouched.
 */
export async function withFeatureFlag<T>(
  flagKey: string,
  enabled: boolean,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const snapshots = await snapshotFeatureFlags([flagKey]);
  const compute = enabled
    ? (s: FeatureFlagSnapshot) => tenantEnabledState(s, tenantId)
    : (s: FeatureFlagSnapshot) => tenantDisabledState(s, tenantId);
  return applyAndRestore(snapshots, compute, applyFlagWrite, restoreFeatureFlag, fn);
}

/**
 * Disable ALL AI enhancement flags FOR THE E2E TENANT ONLY for the duration of
 * `fn` (each appended to its blocked_tenant_ids), restoring every exact snapshot
 * in `finally`. Durable enablement for other tenants (eval/pilot) is preserved.
 */
export async function withAllEnhancementFlagsDisabled<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const snapshots = await snapshotFeatureFlags(ENHANCEMENT_FLAGS);
  return applyAndRestore(
    snapshots,
    (s) => tenantDisabledState(s, tenantId),
    applyFlagWrite,
    restoreFeatureFlag,
    fn,
  );
}
