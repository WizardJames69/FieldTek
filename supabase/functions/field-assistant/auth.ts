// ============================================================
// Field Assistant — Feature Flag Evaluation
// ============================================================

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Evaluate a feature flag with support for blocked/allowed tenant lists
 * and percentage-based rollout via consistent hash.
 */
export async function evaluateFeatureFlag(
  serviceRoleClient: SupabaseClient,
  flagKey: string,
  tenantId: string,
): Promise<boolean> {
  try {
    const { data: flag } = await serviceRoleClient
      .from("feature_flags")
      .select("is_enabled, rollout_percentage, allowed_tenant_ids, blocked_tenant_ids")
      .eq("key", flagKey)
      .maybeSingle();

    if (!flag?.is_enabled) return false;

    // Blocked tenants never get the feature
    if (flag.blocked_tenant_ids?.includes(tenantId)) return false;

    // Explicitly allowed tenants always get it
    if (flag.allowed_tenant_ids?.length > 0 && flag.allowed_tenant_ids.includes(tenantId)) return true;

    // Percentage-based rollout via consistent hash
    if (flag.rollout_percentage >= 100) return true;
    if (flag.rollout_percentage > 0) {
      const hash = parseInt(tenantId.replace(/-/g, "").slice(0, 8), 16);
      return (hash % 100) < flag.rollout_percentage;
    }

    return false;
  } catch (err) {
    console.warn(`[feature-flag] Failed to check ${flagKey}, defaulting to disabled:`, err);
    return false;
  }
}
