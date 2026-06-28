import { describe, it, expect } from "vitest";
import {
  dedupeTenantIds,
  tenantDisabledState,
  tenantEnabledState,
  restorePayload,
  applyAndRestore,
  buildSeedFlagRow,
  SEED_UPSERT_OPTIONS,
  type FeatureFlagSnapshot,
} from "../../../e2e/helpers/feature-flag-state";

// Pure state math for E2E feature-flag isolation. The previous helpers reset
// durable flag rows to a hardcoded disabled default (clobbering eval/pilot
// enablement). These pure functions make every E2E mutation TENANT-SCOPED and
// EXACTLY reversible: disable = append the E2E tenant to blocked_tenant_ids;
// enable = scope to the E2E tenant only; restore = the exact original row. No
// I/O — unit tested without a backend.

const EVAL = "2c9067cf-7c50-422f-ace1-85469975d622";
const E2E = "11111111-1111-1111-1111-111111111111";
const PILOT = "bc50e427-0644-411a-91db-2f71bf297e99";

function snap(over: Partial<FeatureFlagSnapshot> = {}): FeatureFlagSnapshot {
  return {
    key: "rag_judge",
    is_enabled: false,
    rollout_percentage: 0,
    allowed_tenant_ids: [],
    blocked_tenant_ids: [],
    starts_at: null,
    ends_at: null,
    ...over,
  };
}

describe("dedupeTenantIds", () => {
  it("removes duplicates preserving first-seen order", () => {
    expect(dedupeTenantIds([E2E, EVAL, E2E, PILOT, EVAL])).toEqual([E2E, EVAL, PILOT]);
  });
  it("drops null/undefined/empty and tolerates null input", () => {
    expect(dedupeTenantIds([E2E, "", null, undefined, E2E])).toEqual([E2E]);
    expect(dedupeTenantIds(null)).toEqual([]);
    expect(dedupeTenantIds(undefined)).toEqual([]);
  });
});

describe("tenantDisabledState — append only the E2E tenant to blocked_tenant_ids", () => {
  it("appends the E2E tenant to blocked and changes nothing else", () => {
    const w = tenantDisabledState(snap({ is_enabled: true, rollout_percentage: 25, allowed_tenant_ids: [EVAL] }), E2E);
    expect(w.blocked_tenant_ids).toEqual([E2E]);
    // durable fields untouched
    expect(w.is_enabled).toBe(true);
    expect(w.rollout_percentage).toBe(25);
    expect(w.allowed_tenant_ids).toEqual([EVAL]);
    expect(w.starts_at).toBeNull();
    expect(w.ends_at).toBeNull();
  });

  it("preserves an existing eval allowlist unchanged", () => {
    const w = tenantDisabledState(snap({ is_enabled: true, allowed_tenant_ids: [EVAL, PILOT] }), E2E);
    expect(w.allowed_tenant_ids).toEqual([EVAL, PILOT]);
  });

  it("does not change is_enabled or rollout when disabling for a tenant", () => {
    const s = snap({ is_enabled: true, rollout_percentage: 100, allowed_tenant_ids: [] });
    const w = tenantDisabledState(s, E2E);
    expect(w.is_enabled).toBe(true);
    expect(w.rollout_percentage).toBe(100);
  });

  it("does not introduce duplicate tenant ids in blocked", () => {
    const w = tenantDisabledState(snap({ blocked_tenant_ids: [E2E, PILOT] }), E2E);
    expect(w.blocked_tenant_ids).toEqual([E2E, PILOT]);
  });

  it("preserves time windows", () => {
    const w = tenantDisabledState(snap({ starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-02-01T00:00:00Z" }), E2E);
    expect(w.starts_at).toBe("2026-01-01T00:00:00Z");
    expect(w.ends_at).toBe("2026-02-01T00:00:00Z");
  });

  it("handles a null blocked array safely", () => {
    const w = tenantDisabledState(snap({ blocked_tenant_ids: null }), E2E);
    expect(w.blocked_tenant_ids).toEqual([E2E]);
  });
});

describe("tenantEnabledState — enable only the E2E tenant, never rollout 100", () => {
  it("originally DISABLED → enable scoped to E2E tenant at rollout 0 (stale allowlist not activated)", () => {
    const w = tenantEnabledState(snap({ is_enabled: false, rollout_percentage: 0, allowed_tenant_ids: [EVAL] }), E2E);
    expect(w.is_enabled).toBe(true);
    expect(w.rollout_percentage).toBe(0);
    expect(w.allowed_tenant_ids).toEqual([E2E]); // scoped — stale [EVAL] not activated
    expect(w.blocked_tenant_ids).toEqual([]);
  });

  it("never sets rollout to 100", () => {
    expect(tenantEnabledState(snap({ is_enabled: false }), E2E).rollout_percentage).toBe(0);
    expect(tenantEnabledState(snap({ is_enabled: true, rollout_percentage: 50 }), E2E).rollout_percentage).toBe(50);
  });

  it("originally ENABLED → preserve existing allowed tenants and rollout, append E2E tenant", () => {
    const w = tenantEnabledState(snap({ is_enabled: true, rollout_percentage: 50, allowed_tenant_ids: [EVAL] }), E2E);
    expect(w.is_enabled).toBe(true);
    expect(w.rollout_percentage).toBe(50);
    expect(w.allowed_tenant_ids).toEqual([EVAL, E2E]); // existing preserved + appended
  });

  it("removes the E2E tenant from blocked when enabling", () => {
    const w = tenantEnabledState(snap({ is_enabled: true, allowed_tenant_ids: [EVAL], blocked_tenant_ids: [E2E, PILOT] }), E2E);
    expect(w.blocked_tenant_ids).toEqual([PILOT]);
    expect(w.allowed_tenant_ids).toEqual([EVAL, E2E]);
  });

  it("does not duplicate the E2E tenant if already allowlisted", () => {
    const w = tenantEnabledState(snap({ is_enabled: true, allowed_tenant_ids: [EVAL, E2E] }), E2E);
    expect(w.allowed_tenant_ids).toEqual([EVAL, E2E]);
  });

  it("preserves time windows", () => {
    const w = tenantEnabledState(snap({ is_enabled: true, allowed_tenant_ids: [EVAL], starts_at: "2026-01-01T00:00:00Z" }), E2E);
    expect(w.starts_at).toBe("2026-01-01T00:00:00Z");
  });
});

describe("restorePayload — exact original columns", () => {
  it("returns is_enabled, rollout, allow/block lists, and time windows verbatim", () => {
    const s = snap({
      is_enabled: true,
      rollout_percentage: 33,
      allowed_tenant_ids: [EVAL, PILOT],
      blocked_tenant_ids: [E2E],
      starts_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-03-01T00:00:00Z",
    });
    expect(restorePayload(s)).toEqual({
      is_enabled: true,
      rollout_percentage: 33,
      allowed_tenant_ids: [EVAL, PILOT],
      blocked_tenant_ids: [E2E],
      starts_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-03-01T00:00:00Z",
    });
  });

  it("preserves null arrays/windows (null vs empty)", () => {
    const s = snap({ allowed_tenant_ids: null, blocked_tenant_ids: null, starts_at: null });
    const p = restorePayload(s);
    expect(p.allowed_tenant_ids).toBeNull();
    expect(p.blocked_tenant_ids).toBeNull();
    expect(p.starts_at).toBeNull();
  });
});

describe("applyAndRestore — apply tenant-scoped writes, ALWAYS restore exact snapshots", () => {
  it("applies computed writes then restores every snapshot on success", async () => {
    const applied: Array<{ key: string; write: unknown }> = [];
    const restored: FeatureFlagSnapshot[] = [];
    const snaps = [snap({ key: "rag_judge", is_enabled: true, allowed_tenant_ids: [EVAL] }), snap({ key: "rag_reranking" })];
    const out = await applyAndRestore(
      snaps,
      (s) => tenantDisabledState(s, E2E),
      async (key, write) => { applied.push({ key, write }); },
      async (s) => { restored.push(s); },
      async () => "result",
    );
    expect(out).toBe("result");
    expect(applied.map((a) => a.key)).toEqual(["rag_judge", "rag_reranking"]);
    expect(restored).toEqual(snaps); // exact snapshots restored
  });

  it("restores every snapshot even when the callback THROWS", async () => {
    const restored: string[] = [];
    const snaps = [snap({ key: "rag_judge" }), snap({ key: "judge_blocking_mode" })];
    await expect(
      applyAndRestore(
        snaps,
        (s) => tenantDisabledState(s, E2E),
        async () => {},
        async (s) => { restored.push(s.key); },
        async () => { throw new Error("boom"); },
      ),
    ).rejects.toThrow("boom");
    expect(restored).toEqual(["rag_judge", "judge_blocking_mode"]); // restored despite throw
  });

  it("restore receives the COMPLETE original snapshot (all columns)", async () => {
    let received: FeatureFlagSnapshot | null = null;
    const original = snap({ is_enabled: true, rollout_percentage: 10, allowed_tenant_ids: [EVAL], blocked_tenant_ids: [PILOT], starts_at: "2026-01-01T00:00:00Z" });
    await applyAndRestore([original], (s) => tenantEnabledState(s, E2E), async () => {}, async (s) => { received = s; }, async () => {});
    expect(received).toEqual(original);
  });
});

describe("seed contract — insert-only, never overwrite an existing row", () => {
  it("upsert options request ON CONFLICT DO NOTHING", () => {
    expect(SEED_UPSERT_OPTIONS).toEqual({ onConflict: "key", ignoreDuplicates: true });
  });

  it("a seed row carries ONLY disabled defaults and no allow/block lists", () => {
    const row = buildSeedFlagRow("rag_judge");
    expect(row).toEqual({ key: "rag_judge", name: "Rag Judge", is_enabled: false, rollout_percentage: 0 });
    expect(row).not.toHaveProperty("allowed_tenant_ids");
    expect(row).not.toHaveProperty("blocked_tenant_ids");
  });
});
