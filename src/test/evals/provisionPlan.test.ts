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
  decideRefreshGate,
  buildRefreshDeletePlan,
  assertRefreshDeleteScoped,
  assertIsEvalTenant,
  REFRESH_CORPUS_TABLES,
  type PlannedWrite,
  type RefreshDelete,
} from "../../../evals/provisionPlan";

const FGEM_URL = "https://fgemfxhwushaiiguqxfe.supabase.co";

describe("parseProvisionArgs", () => {
  it("defaults to no-dry-run and no confirmation", () => {
    expect(parseProvisionArgs([])).toEqual({
      dryRun: false,
      confirmProject: null,
      refreshCorpus: false,
      confirmTenantId: null,
    });
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

const EVAL_TENANT_ID = "2c9067cf-7c50-422f-ace1-85469975d622";

describe("parseProvisionArgs — refresh flags are explicit, never default", () => {
  it("defaults refreshCorpus=false and confirmTenantId=null", () => {
    const a = parseProvisionArgs([]);
    expect(a.refreshCorpus).toBe(false);
    expect(a.confirmTenantId).toBeNull();
  });
  it("a normal (non-refresh) provision never turns refresh on", () => {
    const a = parseProvisionArgs(["--confirm-project", "fgemfxhwushaiiguqxfe"]);
    expect(a.refreshCorpus).toBe(false);
    expect(a.confirmTenantId).toBeNull();
  });
  it("parses --refresh-corpus and --confirm-tenant-id <id>", () => {
    const a = parseProvisionArgs([
      "--confirm-project",
      "fgemfxhwushaiiguqxfe",
      "--refresh-corpus",
      "--confirm-tenant-id",
      EVAL_TENANT_ID,
    ]);
    expect(a.refreshCorpus).toBe(true);
    expect(a.confirmTenantId).toBe(EVAL_TENANT_ID);
  });
});

describe("decideRefreshGate — harder-gated than a normal write", () => {
  const baseArgs = {
    dryRun: false,
    confirmProject: "fgemfxhwushaiiguqxfe",
    refreshCorpus: true,
    confirmTenantId: EVAL_TENANT_ID,
  };

  it("allows refresh when project matches and tenant id is supplied", () => {
    const d = decideRefreshGate(baseArgs, FGEM_URL);
    expect(d).toMatchObject({ ok: true, projectRef: "fgemfxhwushaiiguqxfe", tenantId: EVAL_TENANT_ID });
  });

  it("REFUSES refresh against the wrong project", () => {
    const d = decideRefreshGate({ ...baseArgs, confirmProject: "some-other-ref" }, FGEM_URL);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/does not match/);
  });

  it("REFUSES refresh with no --confirm-project at all", () => {
    const d = decideRefreshGate({ ...baseArgs, confirmProject: null }, FGEM_URL);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/--confirm-project/);
  });

  it("REFUSES refresh in dry-run mode (never destructive without a real write)", () => {
    const d = decideRefreshGate({ ...baseArgs, dryRun: true }, FGEM_URL);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/dry-run cannot refresh/);
  });

  it("REFUSES refresh without --confirm-tenant-id", () => {
    const d = decideRefreshGate({ ...baseArgs, confirmTenantId: null }, FGEM_URL);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/--confirm-tenant-id/);
  });

  it("REFUSES refresh with an empty --confirm-tenant-id", () => {
    const d = decideRefreshGate({ ...baseArgs, confirmTenantId: "   " }, FGEM_URL);
    expect(d.ok).toBe(false);
  });
});

describe("buildRefreshDeletePlan — tenant-scoped, corpus-only", () => {
  const plan = buildRefreshDeletePlan(EVAL_TENANT_ID);

  it("deletes ONLY document_chunks and documents", () => {
    expect(plan.map((d) => d.table).sort()).toEqual(["document_chunks", "documents"]);
    expect([...REFRESH_CORPUS_TABLES].sort()).toEqual(["document_chunks", "documents"]);
  });

  it("deletes chunks before documents (FK order)", () => {
    expect(plan[0].table).toBe("document_chunks");
    expect(plan[1].table).toBe("documents");
  });

  it("every delete is scoped to the supplied eval tenant id", () => {
    for (const d of plan) expect(d.scope.tenant_id).toBe(EVAL_TENANT_ID);
  });

  it("touches NONE of the broad/global-setup tables", () => {
    const tables = new Set(plan.map((d) => d.table));
    for (const forbidden of PROVISION_FORBIDDEN_ENTITIES) {
      expect(tables.has(forbidden as never)).toBe(false);
    }
  });
});

describe("assertRefreshDeleteScoped — refuses broad or cross-table deletes", () => {
  it("passes for a correct tenant-scoped corpus plan", () => {
    expect(() => assertRefreshDeleteScoped(buildRefreshDeletePlan(EVAL_TENANT_ID), EVAL_TENANT_ID)).not.toThrow();
  });

  it("throws when a delete is not scoped to the eval tenant id", () => {
    const bad: RefreshDelete[] = [
      { table: "document_chunks", scope: { tenant_id: "other-tenant" }, description: "x" },
    ];
    expect(() => assertRefreshDeleteScoped(bad, EVAL_TENANT_ID)).toThrow(/not scoped/);
  });

  it("throws when a delete targets a non-corpus table", () => {
    const bad = [
      { table: "tenant_users", scope: { tenant_id: EVAL_TENANT_ID }, description: "x" },
    ] as unknown as RefreshDelete[];
    expect(() => assertRefreshDeleteScoped(bad, EVAL_TENANT_ID)).toThrow(/non-corpus|FORBIDDEN/);
  });

  it("throws when a delete targets a forbidden global table", () => {
    const bad = [
      { table: "feature_flags", scope: { tenant_id: EVAL_TENANT_ID }, description: "x" },
    ] as unknown as RefreshDelete[];
    expect(() => assertRefreshDeleteScoped(bad, EVAL_TENANT_ID)).toThrow(/FORBIDDEN|non-corpus/);
  });

  it("throws on an empty tenant id (never an unscoped delete)", () => {
    expect(() => assertRefreshDeleteScoped(buildRefreshDeletePlan(""), "")).toThrow(/non-empty/);
  });
});

describe("assertIsEvalTenant — final identity guard before delete", () => {
  const evalTenant = {
    id: EVAL_TENANT_ID,
    name: "Sentinel Eval Company",
    slug: "sentinel-eval-company-1781633414911",
  };

  it("passes for the real eval tenant with a matching confirm id", () => {
    expect(() => assertIsEvalTenant(evalTenant, EVAL_TENANT_ID)).not.toThrow();
  });

  it("REFUSES the E2E suite tenant", () => {
    expect(() =>
      assertIsEvalTenant({ id: EVAL_TENANT_ID, name: "E2E Test Company", slug: "e2e-test-company-1" }, EVAL_TENANT_ID),
    ).toThrow(/E2E/);
  });

  it("REFUSES a tenant whose name is not the eval tenant", () => {
    expect(() =>
      assertIsEvalTenant({ ...evalTenant, name: "Some Other Co" }, EVAL_TENANT_ID),
    ).toThrow(/is not/);
  });

  it("REFUSES a tenant whose slug prefix is wrong", () => {
    expect(() =>
      assertIsEvalTenant({ ...evalTenant, slug: "wrong-prefix-1" }, EVAL_TENANT_ID),
    ).toThrow(/slug/);
  });

  it("REFUSES when the resolved id does not match --confirm-tenant-id", () => {
    expect(() =>
      assertIsEvalTenant(evalTenant, "00000000-0000-0000-0000-000000000000"),
    ).toThrow(/does not match/);
  });
});

describe("normal provision behavior is unchanged by the refresh additions", () => {
  it("buildWritePlan still has the same 7 narrow entities", () => {
    const entities = buildWritePlan().map((w) => w.entity).sort();
    expect(entities).toEqual(
      ["auth.user", "document_chunks", "documents", "profiles", "tenant_ai_policies", "tenant_users", "tenants"].sort(),
    );
  });
  it("decideGate still allows a normal write with matching project", () => {
    const d = decideGate({ dryRun: false, confirmProject: "fgemfxhwushaiiguqxfe", refreshCorpus: false, confirmTenantId: null }, FGEM_URL);
    expect(d).toMatchObject({ ok: true, mode: "write" });
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
