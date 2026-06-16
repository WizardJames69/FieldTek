import { describe, it, expect } from "vitest";

// The eval-tenant provisioner's decision logic is pure (arg/confirm parsing, the
// write-plan allowlist, the gate refusals), so Vitest covers it and `npm run
// test` / CI catch regressions without a live backend or any fgem writes —
// mirroring how src/test/evals/thresholds.test.ts covers the gate.
import {
  parseProvisionArgs,
  extractProjectRef,
  decideGate,
  buildWritePlan,
  describePlan,
  assertPlanWithinAllowlist,
  PROVISION_ALLOWED_ENTITIES,
  PROVISION_FORBIDDEN_ENTITIES,
  EVAL_TENANT_NAME,
  type PlannedWrite,
} from "../../../evals/provisionPlan";

const FGEM_URL = "https://fgemfxhwushaiiguqxfe.supabase.co";

describe("parseProvisionArgs", () => {
  it("defaults to no-dry-run and no confirmation", () => {
    expect(parseProvisionArgs([])).toEqual({ dryRun: false, confirmProject: null });
  });
  it("parses --dry-run", () => {
    expect(parseProvisionArgs(["--dry-run"]).dryRun).toBe(true);
  });
  it("parses --confirm-project <ref>", () => {
    expect(parseProvisionArgs(["--confirm-project", "fgemfxhwushaiiguqxfe"]).confirmProject).toBe(
      "fgemfxhwushaiiguqxfe",
    );
  });
});

describe("extractProjectRef", () => {
  it("pulls the ref out of a Supabase URL", () => {
    expect(extractProjectRef(FGEM_URL)).toBe("fgemfxhwushaiiguqxfe");
  });
  it("returns null for a non-Supabase / missing URL", () => {
    expect(extractProjectRef("https://example.com")).toBeNull();
    expect(extractProjectRef(undefined)).toBeNull();
    expect(extractProjectRef("")).toBeNull();
  });
});

describe("decideGate", () => {
  it("allows dry-run without any confirmation", () => {
    const d = decideGate({ dryRun: true, confirmProject: null }, FGEM_URL);
    expect(d).toMatchObject({ ok: true, mode: "dry-run" });
  });

  it("REFUSES a write with no --confirm-project", () => {
    const d = decideGate({ dryRun: false, confirmProject: null }, FGEM_URL);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/--confirm-project/);
  });

  it("REFUSES a write when --confirm-project does not match the target project", () => {
    const d = decideGate({ dryRun: false, confirmProject: "some-other-ref" }, FGEM_URL);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/does not match/);
  });

  it("REFUSES a write when the target URL is missing/unparseable", () => {
    const d = decideGate({ dryRun: false, confirmProject: "fgemfxhwushaiiguqxfe" }, undefined);
    expect(d.ok).toBe(false);
  });

  it("allows a write when --confirm-project matches the target project ref", () => {
    const d = decideGate({ dryRun: false, confirmProject: "fgemfxhwushaiiguqxfe" }, FGEM_URL);
    expect(d).toMatchObject({ ok: true, mode: "write", projectRef: "fgemfxhwushaiiguqxfe" });
  });
});

describe("buildWritePlan — narrow, allowlisted footprint", () => {
  const plan = buildWritePlan();

  it("targets the exact eval tenant the harness requires", () => {
    expect(EVAL_TENANT_NAME).toBe("Sentinel Eval Company");
    expect(plan.some((w) => w.entity === "tenants")).toBe(true);
  });

  it("includes only the minimum eval entities", () => {
    const entities = plan.map((w) => w.entity).sort();
    expect(entities).toEqual(
      [
        "auth.user",
        "document_chunks",
        "documents",
        "profiles",
        "tenant_ai_policies",
        "tenant_users",
        "tenants",
      ].sort(),
    );
  });

  it("every planned write is on the allowlist (assertPlanWithinAllowlist passes)", () => {
    expect(() => assertPlanWithinAllowlist(plan)).not.toThrow();
    for (const w of plan) {
      expect(PROVISION_ALLOWED_ENTITIES).toContain(w.entity);
    }
  });

  it("contains NONE of the broad/global-setup entities", () => {
    const entities = new Set(plan.map((w) => w.entity));
    for (const forbidden of PROVISION_FORBIDDEN_ENTITIES) {
      expect(entities.has(forbidden as never)).toBe(false);
    }
  });

  it("describePlan renders one line per planned write", () => {
    expect(describePlan(plan)).toHaveLength(plan.length);
  });
});

describe("buildWritePlan — decoupled from the E2E identity", () => {
  const rendered = describePlan(buildWritePlan()).join("\n");

  it("references the dedicated Sentinel eval tenant + admin", () => {
    expect(rendered).toContain("Sentinel Eval Company");
    expect(rendered).toContain("sentinel-eval-admin@fieldtek-test.dev");
    expect(rendered).toContain("sentinel-eval-company-"); // slug prefix
  });

  it("never references the E2E suite's tenant name or admin email", () => {
    expect(rendered).not.toContain("E2E Test Company");
    expect(rendered).not.toContain("e2e-admin@fieldtek-test.dev");
    expect(rendered).not.toContain("e2e-test-company-");
  });

  it("EVAL_TENANT_NAME is not the E2E tenant name", () => {
    expect(EVAL_TENANT_NAME).not.toBe("E2E Test Company");
  });
});

describe("assertPlanWithinAllowlist — refuses broad/global-setup behavior", () => {
  it("throws if a plan smuggles in global feature_flags", () => {
    const bad: PlannedWrite[] = [
      { entity: "feature_flags" as never, action: "upsert", description: "GLOBAL flags" },
    ];
    expect(() => assertPlanWithinAllowlist(bad)).toThrow(/FORBIDDEN|feature_flags/);
  });

  it("throws if a plan smuggles in a platform admin", () => {
    const bad: PlannedWrite[] = [
      { entity: "platform_admins" as never, action: "upsert", description: "platform admin" },
    ];
    expect(() => assertPlanWithinAllowlist(bad)).toThrow();
  });

  it("the allowlist and the forbidden list are disjoint", () => {
    const allowed = new Set<string>(PROVISION_ALLOWED_ENTITIES);
    for (const f of PROVISION_FORBIDDEN_ENTITIES) {
      expect(allowed.has(f)).toBe(false);
    }
  });
});
