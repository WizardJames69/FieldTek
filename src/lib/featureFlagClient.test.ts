import { describe, it, expect } from "vitest";
import { isFeatureFlagEnabledForTenant } from "./featureFlagClient";
import type { FeatureFlag } from "@/hooks/useFeatureFlags";

const TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function flag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: "flag-1",
    key: "lesson_citations",
    name: "Lesson Citations",
    description: null,
    is_enabled: true,
    rollout_percentage: 0,
    allowed_tenant_ids: [],
    blocked_tenant_ids: [],
    starts_at: null,
    ends_at: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    metadata: null,
    ...overrides,
  };
}

describe("isFeatureFlagEnabledForTenant", () => {
  it("returns false when the flag is missing", () => {
    expect(isFeatureFlagEnabledForTenant(undefined, TENANT)).toBe(false);
    expect(isFeatureFlagEnabledForTenant(null, TENANT)).toBe(false);
  });

  it("returns false when the flag is disabled (kill switch), even if allowlisted", () => {
    expect(
      isFeatureFlagEnabledForTenant(
        flag({ is_enabled: false, allowed_tenant_ids: [TENANT] }),
        TENANT,
      ),
    ).toBe(false);
  });

  it("returns false when there is no tenant id", () => {
    expect(isFeatureFlagEnabledForTenant(flag({ allowed_tenant_ids: [TENANT] }), null)).toBe(false);
    expect(isFeatureFlagEnabledForTenant(flag({ allowed_tenant_ids: [TENANT] }), undefined)).toBe(false);
  });

  it("grants an allowlisted tenant", () => {
    expect(isFeatureFlagEnabledForTenant(flag({ allowed_tenant_ids: [TENANT] }), TENANT)).toBe(true);
  });

  it("does not grant a non-allowlisted tenant at rollout 0", () => {
    expect(isFeatureFlagEnabledForTenant(flag({ allowed_tenant_ids: [OTHER] }), TENANT)).toBe(false);
  });

  it("blocklist overrides allowlist", () => {
    expect(
      isFeatureFlagEnabledForTenant(
        flag({ allowed_tenant_ids: [TENANT], blocked_tenant_ids: [TENANT] }),
        TENANT,
      ),
    ).toBe(false);
  });

  it("grants everyone at 100% rollout", () => {
    expect(isFeatureFlagEnabledForTenant(flag({ rollout_percentage: 100 }), TENANT)).toBe(true);
    expect(isFeatureFlagEnabledForTenant(flag({ rollout_percentage: 100 }), OTHER)).toBe(true);
  });

  it("respects the time window", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    expect(
      isFeatureFlagEnabledForTenant(
        flag({ rollout_percentage: 100, starts_at: "2026-06-20T00:00:00Z" }),
        TENANT,
        now,
      ),
    ).toBe(false);
    expect(
      isFeatureFlagEnabledForTenant(
        flag({ rollout_percentage: 100, ends_at: "2026-06-10T00:00:00Z" }),
        TENANT,
        now,
      ),
    ).toBe(false);
    expect(
      isFeatureFlagEnabledForTenant(
        flag({ rollout_percentage: 100, allowed_tenant_ids: [TENANT], starts_at: "2026-06-20T00:00:00Z" }),
        TENANT,
        now,
      ),
    ).toBe(true); // allowlist short-circuits before the time window
  });

  it("is deterministic for a given tenant + rollout (consistent hash)", () => {
    const f = flag({ rollout_percentage: 50 });
    const a = isFeatureFlagEnabledForTenant(f, TENANT);
    const b = isFeatureFlagEnabledForTenant(f, TENANT);
    expect(a).toBe(b);
  });
});
