// Pure, side-effect-free feature-flag evaluation for a SPECIFIC tenant id.
//
// The `useFeatureFlags` hook evaluates flags against the *caller's* active
// tenant (via TenantContext). The platform-admin Lesson Review page has no
// TenantProvider and is cross-tenant — it must evaluate `lesson_citations`
// against the *lesson's* tenant, not the admin's. This helper mirrors the
// hook's allowlist / blocklist / time-window / consistent-hash rollout logic
// but takes the tenant id explicitly so it can be reused and unit-tested.
//
// Note: this is the CLIENT gate for *showing* the Publish action. The
// authoritative gate is server-side (`promote-lesson` re-checks the flag via
// the edge `evaluateFeatureFlag`). The two use different rollout hashes, so at
// a partial `rollout_percentage` they may disagree; the intended rollout
// mechanism for lessons is the exact-match allowlist, where they always agree.

import type { FeatureFlag } from "@/hooks/useFeatureFlags";

// Same hash the client hook uses, so allowlist-free rollout decisions match
// `useFeatureFlags` for the same (tenant, flag) pair.
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function hashTenantToPercentage(tenantId: string, flagKey: string): number {
  return simpleHash(`${tenantId}:${flagKey}`) % 100;
}

/**
 * Evaluate a feature flag for an explicit tenant id. Returns false when the
 * flag is missing/disabled, the tenant is blocked, the time window is closed,
 * or the consistent-hash percentile is outside the rollout. An allowlisted
 * tenant always gets the feature (kill switch / blocklist still take priority).
 */
export function isFeatureFlagEnabledForTenant(
  flag: FeatureFlag | undefined | null,
  tenantId: string | null | undefined,
  now: Date = new Date(),
): boolean {
  // Missing flag or master kill switch off.
  if (!flag || !flag.is_enabled) return false;
  // No tenant context — cannot evaluate tenant-specific rules.
  if (!tenantId) return false;

  // Blocklist always wins.
  if (flag.blocked_tenant_ids?.includes(tenantId)) return false;

  // Allowlist always grants (the intended rollout path for lesson_citations).
  if (flag.allowed_tenant_ids?.includes(tenantId)) return true;

  // Time window.
  if (flag.starts_at && new Date(flag.starts_at) > now) return false;
  if (flag.ends_at && new Date(flag.ends_at) < now) return false;

  // Consistent-hash percentage rollout.
  return hashTenantToPercentage(tenantId, flag.key) < flag.rollout_percentage;
}
