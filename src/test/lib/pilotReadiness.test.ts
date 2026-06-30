import { describe, it, expect } from "vitest";
import {
  resolveFlagForTenant,
  summarizeReadiness,
  PILOT_RELEVANT_FLAGS,
  type FeatureFlagRow,
  type ReadinessInput,
} from "../../../scripts/lib/pilotReadiness";

// These tests pin the pure pilot-readiness logic with NO network / Supabase.
// The flag-resolution cases mirror the app resolver in src/hooks/useFeatureFlags.ts
// so the verify-pilot-readiness script reports the same posture the app applies.

const NOW = new Date("2026-06-30T00:00:00.000Z");
const TENANT = "11111111-1111-1111-1111-111111111111";

function flag(overrides: Partial<FeatureFlagRow>): FeatureFlagRow {
  return {
    key: "test_flag",
    is_enabled: true,
    rollout_percentage: 0,
    allowed_tenant_ids: null,
    blocked_tenant_ids: null,
    starts_at: null,
    ends_at: null,
    ...overrides,
  };
}

describe("resolveFlagForTenant (mirror of useFeatureFlags semantics)", () => {
  it("returns false when the flag is missing", () => {
    expect(resolveFlagForTenant(undefined, TENANT, NOW)).toBe(false);
  });

  it("returns false when the flag is the kill-switch off (is_enabled=false)", () => {
    expect(resolveFlagForTenant(flag({ is_enabled: false, rollout_percentage: 100 }), TENANT, NOW)).toBe(false);
  });

  it("returns false when there is no tenant context", () => {
    expect(resolveFlagForTenant(flag({ rollout_percentage: 100 }), null, NOW)).toBe(false);
  });

  it("allowlist forces ON even at rollout 0", () => {
    expect(
      resolveFlagForTenant(flag({ rollout_percentage: 0, allowed_tenant_ids: [TENANT] }), TENANT, NOW),
    ).toBe(true);
  });

  it("blocklist beats allowlist (precedence)", () => {
    expect(
      resolveFlagForTenant(
        flag({ rollout_percentage: 100, allowed_tenant_ids: [TENANT], blocked_tenant_ids: [TENANT] }),
        TENANT,
        NOW,
      ),
    ).toBe(false);
  });

  it("rollout 100 is ON for any tenant", () => {
    expect(resolveFlagForTenant(flag({ rollout_percentage: 100 }), TENANT, NOW)).toBe(true);
    expect(resolveFlagForTenant(flag({ rollout_percentage: 100 }), "another-tenant-id", NOW)).toBe(true);
  });

  it("rollout 0 is OFF for any tenant (no allowlist)", () => {
    expect(resolveFlagForTenant(flag({ rollout_percentage: 0 }), TENANT, NOW)).toBe(false);
  });

  it("is deterministic for the same tenant+flag (consistent hashing)", () => {
    const f = flag({ key: "rag_reranking", rollout_percentage: 50 });
    const a = resolveFlagForTenant(f, TENANT, NOW);
    const b = resolveFlagForTenant(f, TENANT, NOW);
    expect(a).toBe(b);
  });

  it("respects a future starts_at (window not open yet)", () => {
    expect(
      resolveFlagForTenant(flag({ rollout_percentage: 100, starts_at: "2026-07-01T00:00:00.000Z" }), TENANT, NOW),
    ).toBe(false);
  });

  it("respects a past ends_at (window closed)", () => {
    expect(
      resolveFlagForTenant(flag({ rollout_percentage: 100, ends_at: "2026-06-01T00:00:00.000Z" }), TENANT, NOW),
    ).toBe(false);
  });
});

describe("PILOT_RELEVANT_FLAGS posture data", () => {
  it("holds the judge flags OFF under Decision A", () => {
    const decisionA = PILOT_RELEVANT_FLAGS.filter((f) => f.expected === "off-decision-a").map((f) => f.key);
    expect(decisionA).toContain("rag_judge");
    expect(decisionA).toContain("judge_blocking_mode");
    expect(decisionA).toContain("judge_full_blocking");
    expect(decisionA).toContain("lesson_citations");
  });

  it("expects the always-on workflow flag to be ON", () => {
    const wf = PILOT_RELEVANT_FLAGS.find((f) => f.key === "workflow_state_tracking");
    expect(wf?.expected).toBe("on");
  });
});

describe("summarizeReadiness (hard-pass / hard-fail gate)", () => {
  it("hard-fails when health-check is unreachable", () => {
    const s = summarizeReadiness({ healthStatus: null, tenant: null });
    expect(s.pass).toBe(false);
    expect(s.hardChecks.some((c) => !c.pass)).toBe(true);
  });

  it("hard-fails when health-check is unhealthy (503)", () => {
    const s = summarizeReadiness({ healthStatus: "unhealthy", tenant: null });
    expect(s.pass).toBe(false);
  });

  it("passes on healthy with no tenant requested", () => {
    const s = summarizeReadiness({ healthStatus: "healthy", tenant: null });
    expect(s.pass).toBe(true);
    expect(s.warnings).toHaveLength(0);
  });

  it("passes-with-warning on degraded health", () => {
    const s = summarizeReadiness({ healthStatus: "degraded", tenant: null });
    expect(s.pass).toBe(true);
    expect(s.warnings.join(" ")).toMatch(/degraded/i);
  });

  it("hard-fails when a requested tenant does not exist", () => {
    const input: ReadinessInput = {
      healthStatus: "healthy",
      tenant: {
        tenantId: TENANT,
        exists: false,
        clients: 0,
        jobs: 0,
        equipment: 0,
        documents: 0,
        embeddedChunks: 0,
        indexedDocuments: 0,
      },
    };
    const s = summarizeReadiness(input);
    expect(s.pass).toBe(false);
    expect(s.hardChecks.find((c) => c.name === "tenant exists")?.pass).toBe(false);
  });

  it("passes-with-warnings for a fresh tenant with no indexed document and no clients", () => {
    const input: ReadinessInput = {
      healthStatus: "healthy",
      tenant: {
        tenantId: TENANT,
        exists: true,
        clients: 0,
        jobs: 0,
        equipment: 0,
        documents: 1,
        embeddedChunks: 0,
        indexedDocuments: 0,
      },
    };
    const s = summarizeReadiness(input);
    expect(s.pass).toBe(true);
    expect(s.warnings.join(" ")).toMatch(/indexed document/i);
    expect(s.warnings.join(" ")).toMatch(/0 clients/i);
  });

  it("passes cleanly for a fully-seeded, indexed tenant", () => {
    const input: ReadinessInput = {
      healthStatus: "healthy",
      tenant: {
        tenantId: TENANT,
        exists: true,
        clients: 2,
        jobs: 3,
        equipment: 1,
        documents: 1,
        embeddedChunks: 12,
        indexedDocuments: 1,
      },
    };
    const s = summarizeReadiness(input);
    expect(s.pass).toBe(true);
    expect(s.warnings).toHaveLength(0);
  });
});
