/**
 * Pure state math for E2E feature-flag isolation. No I/O — unit tested in
 * src/test/e2e/feature-flag-state.test.ts.
 *
 * Why this exists: the old E2E helpers reset durable flag rows to a hardcoded
 * disabled default, silently clobbering eval/pilot enablement on the shared
 * backend (e.g. rag_judge enabled eval-only was knocked OFF by globalSetup).
 * These functions make every E2E mutation TENANT-SCOPED and EXACTLY reversible:
 *   - disable for a tenant  → append only that tenant to blocked_tenant_ids
 *   - enable for a tenant    → scope to that tenant; never rollout 100
 *   - restore                → write back the exact original row
 * The blocklist always wins in the resolution engine, so a tenant-scoped disable
 * is guaranteed regardless of allowlist/rollout, while other tenants' durable
 * resolution (incl. the eval allowlist) is left untouched.
 */

/** The exact columns we snapshot and restore for a feature_flags row. */
export interface FeatureFlagSnapshot {
  key: string;
  is_enabled: boolean;
  rollout_percentage: number;
  allowed_tenant_ids: string[] | null;
  blocked_tenant_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
}

/** The mutable columns written by an apply/restore (everything except key). */
export type FeatureFlagWrite = Omit<FeatureFlagSnapshot, "key">;

/** Dedupe a tenant-id list, dropping falsy values, preserving first-seen order. */
export function dedupeTenantIds(
  ids: Array<string | null | undefined> | null | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids ?? []) {
    if (typeof id === "string" && id.length > 0 && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Disable a flag for ONE tenant: append it to blocked_tenant_ids (blocklist wins
 * in the resolution engine) and change nothing else. is_enabled, rollout, the
 * allowlist, and time windows are preserved exactly, so durable enablement for
 * other tenants (e.g. the eval allowlist) is untouched.
 */
export function tenantDisabledState(
  snapshot: FeatureFlagSnapshot,
  tenantId: string,
): FeatureFlagWrite {
  return {
    is_enabled: snapshot.is_enabled,
    rollout_percentage: snapshot.rollout_percentage,
    allowed_tenant_ids: snapshot.allowed_tenant_ids,
    blocked_tenant_ids: dedupeTenantIds([...(snapshot.blocked_tenant_ids ?? []), tenantId]),
    starts_at: snapshot.starts_at,
    ends_at: snapshot.ends_at,
  };
}

/**
 * Enable a flag for ONE tenant, never globally (never rollout 100):
 *   - originally ENABLED:  preserve is_enabled, rollout, and the existing
 *     allowlist; append the tenant; remove it from blocked.
 *   - originally DISABLED: is_enabled=true, rollout 0, allowlist scoped to just
 *     this tenant (so a stale allowlist is NOT reactivated); remove from blocked.
 * Time windows are preserved.
 */
export function tenantEnabledState(
  snapshot: FeatureFlagSnapshot,
  tenantId: string,
): FeatureFlagWrite {
  const blocked = dedupeTenantIds(
    (snapshot.blocked_tenant_ids ?? []).filter((id) => id !== tenantId),
  );
  if (snapshot.is_enabled) {
    return {
      is_enabled: true,
      rollout_percentage: snapshot.rollout_percentage,
      allowed_tenant_ids: dedupeTenantIds([...(snapshot.allowed_tenant_ids ?? []), tenantId]),
      blocked_tenant_ids: blocked,
      starts_at: snapshot.starts_at,
      ends_at: snapshot.ends_at,
    };
  }
  return {
    is_enabled: true,
    rollout_percentage: 0,
    allowed_tenant_ids: [tenantId],
    blocked_tenant_ids: blocked,
    starts_at: snapshot.starts_at,
    ends_at: snapshot.ends_at,
  };
}

/**
 * Which requested flag keys are absent from a snapshot set, in requested order.
 * Used to fail loudly when a flag row is missing rather than silently returning
 * an incomplete snapshot (which would no-op the override and let a test run
 * without its intended flag state).
 */
export function findMissingFlagKeys(
  requestedKeys: readonly string[],
  snapshots: readonly { key: string }[],
): string[] {
  const present = new Set(snapshots.map((s) => s.key));
  return requestedKeys.filter((k) => !present.has(k));
}

/**
 * Throw a clear error if any requested flag row is missing from `snapshots`.
 * Callers run this BEFORE applying any override, so an incomplete snapshot can
 * never trigger a partial apply/restore.
 */
export function assertAllFlagsPresent(
  requestedKeys: readonly string[],
  snapshots: readonly FeatureFlagSnapshot[],
): void {
  const missing = findMissingFlagKeys(requestedKeys, snapshots);
  if (missing.length > 0) {
    throw new Error(`Missing feature flag row(s): ${missing.join(", ")}`);
  }
}

/** The exact columns to write back to restore a row to its snapshot. */
export function restorePayload(snapshot: FeatureFlagSnapshot): FeatureFlagWrite {
  return {
    is_enabled: snapshot.is_enabled,
    rollout_percentage: snapshot.rollout_percentage,
    allowed_tenant_ids: snapshot.allowed_tenant_ids,
    blocked_tenant_ids: snapshot.blocked_tenant_ids,
    starts_at: snapshot.starts_at,
    ends_at: snapshot.ends_at,
  };
}

/**
 * Orchestrate a tenant-scoped override: apply a computed write to every
 * snapshotted flag, run `fn`, and ALWAYS restore each flag to its exact
 * snapshot in `finally` (even when `fn` throws). I/O is injected (`apply`,
 * `restore`) so this is unit-testable without a backend.
 */
export async function applyAndRestore<T>(
  snapshots: FeatureFlagSnapshot[],
  computeWrite: (snapshot: FeatureFlagSnapshot) => FeatureFlagWrite,
  apply: (key: string, write: FeatureFlagWrite) => Promise<void>,
  restore: (snapshot: FeatureFlagSnapshot) => Promise<void>,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    for (const s of snapshots) await apply(s.key, computeWrite(s));
    return await fn();
  } finally {
    for (const s of snapshots) await restore(s);
  }
}

// ── Insert-only seed contract ───────────────────────────────────────────────
// globalSetup must CREATE missing flag rows without ever overwriting an existing
// one (which previously reset durable enablement). The upsert uses ON CONFLICT
// DO NOTHING and the seed row carries only disabled defaults (no allow/block
// lists), so even the create path can never carry tenant targeting.

export const SEED_UPSERT_OPTIONS = { onConflict: "key", ignoreDuplicates: true } as const;

export interface SeedFlagRow {
  key: string;
  name: string;
  is_enabled: boolean;
  rollout_percentage: number;
}

/** Build the disabled-default row used to CREATE a missing flag (insert-only). */
export function buildSeedFlagRow(key: string): SeedFlagRow {
  return {
    key,
    name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    is_enabled: false,
    rollout_percentage: 0,
  };
}
