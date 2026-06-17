// ============================================================
// Sentinel AI eval harness — narrow provisioner: planning logic (pure)
// ============================================================
// The eval live baseline needs an eval tenant ("Sentinel Eval Company") + an
// admin login + the fixture corpus on the target backend. The documented E2E
// global-setup creates far more (5 users, a 2nd tenant, GLOBAL feature flags,
// platform admin, workflow/diagnostic/compliance data). This provisioner does
// the MINIMUM instead.
//
// This module is the pure decision core — argument parsing, project-confirmation
// matching, the explicit write-plan, and the allowlist/forbidden-list guards —
// with no IO. It is unit-tested offline (src/test/evals/provisionPlan.test.ts)
// so the "narrow + gated, never the broad global-setup" contract is pinned
// without any backend or fgem writes. The IO lives in evals/provision.ts.

import {
  EVAL_TENANT_NAME,
  EVAL_TENANT_SLUG_PREFIX,
  EVAL_ADMIN_EMAIL,
  EVAL_USER_MARKER,
} from "./evalIdentity";

/** The E2E suite's tenant name — refresh must NEVER resolve to this. */
const E2E_TENANT_NAME = "E2E Test Company";

// Re-export the eval tenant name so existing importers (provision.ts and the
// offline unit tests) keep a single import site.
export { EVAL_TENANT_NAME };

/**
 * The ONLY entities this provisioner may write. `auth.user` is the Supabase
 * Auth Admin API (the eval admin login); the rest are tables. Tenant-scoped to
 * the single eval tenant; corpus uses pre-computed embeddings (no model calls).
 */
export const PROVISION_ALLOWED_ENTITIES = [
  "auth.user",
  "profiles",
  "tenants",
  "tenant_users",
  "tenant_ai_policies",
  "documents",
  "document_chunks",
] as const;
export type ProvisionEntity = (typeof PROVISION_ALLOWED_ENTITIES)[number];

/**
 * Entities the broad E2E global-setup writes that this provisioner must NEVER
 * touch. Encoded so a runtime guard + unit tests can prove the plan stays narrow
 * and can never drift into global-setup behavior.
 */
export const PROVISION_FORBIDDEN_ENTITIES = [
  "feature_flags", // GLOBAL — would affect other tenants
  "platform_admins",
  "tenant_settings",
  "tenant_branding",
  "compliance_rules",
  "equipment_components",
  "component_relationships",
  "workflow_symptoms",
  "workflow_failures",
  "workflow_repairs",
  "workflow_outcomes",
  "workflow_intelligence_edges",
  "workflow_diagnostic_statistics",
  "scheduled_jobs",
  "clients",
  "beta_applications",
  "tenant_b", // no second tenant
] as const;

export interface PlannedWrite {
  entity: ProvisionEntity;
  action: "insert-if-missing" | "upsert";
  description: string;
}

/** The fixed, explicit set of writes — ordered by dependency (user → tenant → corpus). */
export function buildWritePlan(): PlannedWrite[] {
  return [
    {
      entity: "auth.user",
      action: "insert-if-missing",
      description: `eval admin login (${EVAL_ADMIN_EMAIL}), marked ${EVAL_USER_MARKER}`,
    },
    { entity: "profiles", action: "upsert", description: "profile row for the eval admin" },
    {
      entity: "tenants",
      action: "insert-if-missing",
      description: `eval tenant "${EVAL_TENANT_NAME}" (enterprise/active, slug ${EVAL_TENANT_SLUG_PREFIX}-*)`,
    },
    {
      entity: "tenant_users",
      action: "insert-if-missing",
      description: "eval admin owner membership",
    },
    { entity: "tenant_ai_policies", action: "upsert", description: "tenant AI policy (AI enabled)" },
    {
      entity: "documents",
      action: "insert-if-missing",
      description: "fixture HVAC corpus documents",
    },
    {
      entity: "document_chunks",
      action: "insert-if-missing",
      description: "fixture chunks + pre-computed embeddings (no model calls)",
    },
  ];
}

/** Throw if a plan references anything outside the allowlist or on the forbidden list. */
export function assertPlanWithinAllowlist(plan: PlannedWrite[]): void {
  const allowed = new Set<string>(PROVISION_ALLOWED_ENTITIES);
  const forbidden = new Set<string>(PROVISION_FORBIDDEN_ENTITIES);
  for (const w of plan) {
    if (forbidden.has(w.entity)) {
      throw new Error(
        `provision plan contains FORBIDDEN entity "${w.entity}" — that is broad global-setup behavior`,
      );
    }
    if (!allowed.has(w.entity)) {
      throw new Error(`provision plan contains non-allowlisted entity "${w.entity}"`);
    }
  }
}

export interface ProvisionArgs {
  dryRun: boolean;
  confirmProject: string | null;
  /** Opt-in to the destructive corpus refresh (delete + reseed eval corpus). Default false. */
  refreshCorpus: boolean;
  /** Hard confirmation of the eval tenant id the refresh is allowed to touch. */
  confirmTenantId: string | null;
}

export function parseProvisionArgs(argv: string[]): ProvisionArgs {
  const args: ProvisionArgs = {
    dryRun: false,
    confirmProject: null,
    refreshCorpus: false,
    confirmTenantId: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm-project") args.confirmProject = argv[++i] ?? null;
    else if (a === "--refresh-corpus") args.refreshCorpus = true;
    else if (a === "--confirm-tenant-id") args.confirmTenantId = argv[++i] ?? null;
  }
  return args;
}

/** Extract the project ref from a Supabase URL: https://<ref>.supabase.co → <ref>. */
export function extractProjectRef(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = /https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)/i.exec(url);
  return m ? m[1] : null;
}

export type GateDecision =
  | { ok: true; mode: "dry-run"; projectRef: string | null }
  | { ok: true; mode: "write"; projectRef: string }
  | { ok: false; reason: string };

/**
 * Decide whether/how to proceed. Dry-run is always allowed (it never writes or
 * connects). A real write requires an explicit --confirm-project that matches
 * the project ref parsed from VITE_SUPABASE_URL — so you cannot accidentally
 * write to the wrong backend, and cannot write at all without opting in.
 */
export function decideGate(
  args: ProvisionArgs,
  envUrl: string | undefined | null,
): GateDecision {
  const ref = extractProjectRef(envUrl);
  if (args.dryRun) return { ok: true, mode: "dry-run", projectRef: ref };
  if (!args.confirmProject) {
    return {
      ok: false,
      reason:
        "refusing to write without --confirm-project <ref>. Pass --dry-run to preview, or " +
        "--confirm-project <ref> to write (ref must match VITE_SUPABASE_URL).",
    };
  }
  if (!ref) {
    return {
      ok: false,
      reason: "VITE_SUPABASE_URL is missing or not a Supabase URL — cannot confirm target project.",
    };
  }
  if (args.confirmProject !== ref) {
    return {
      ok: false,
      reason: `--confirm-project "${args.confirmProject}" does not match target project "${ref}" (from VITE_SUPABASE_URL).`,
    };
  }
  return { ok: true, mode: "write", projectRef: ref };
}

/** Human-readable plan lines for dry-run / banners. */
export function describePlan(plan: PlannedWrite[]): string[] {
  return plan.map((w) => `  • ${w.entity.padEnd(20)} ${w.action.padEnd(18)} ${w.description}`);
}

// ============================================================
// Corpus refresh — explicit, opt-in, tenant-scoped delete + reseed
// ============================================================
// The base provisioner is create-only: ensureCorpusSeeded() skips when the
// tenant already has chunks, so it cannot update a durable eval tenant after the
// fixture corpus changes on main. `--refresh-corpus` adds the ONLY supported way
// to refresh it: delete exactly the eval tenant's documents + document_chunks
// (tenant-scoped) and reseed via the existing current-main seed logic. It is
// gated harder than a normal write — it additionally requires an explicit
// --confirm-tenant-id that must match the resolved eval tenant id at runtime —
// and it touches NO non-corpus table. The decision logic here is pure so the
// guards are unit-tested offline with no fgem writes.

/** The ONLY tables the refresh path may DELETE from — both tenant-scoped. */
export const REFRESH_CORPUS_TABLES = ["document_chunks", "documents"] as const;
export type RefreshCorpusTable = (typeof REFRESH_CORPUS_TABLES)[number];

export interface RefreshDelete {
  table: RefreshCorpusTable;
  /** The mandatory tenant scope — a refresh delete is never allowed unfiltered. */
  scope: { tenant_id: string };
  description: string;
}

/**
 * Ordered tenant-scoped delete plan: chunks first (they reference documents),
 * then documents. Both filtered by the eval tenant id — never a broad delete.
 */
export function buildRefreshDeletePlan(tenantId: string): RefreshDelete[] {
  return [
    {
      table: "document_chunks",
      scope: { tenant_id: tenantId },
      description: "delete eval tenant document_chunks (tenant-scoped)",
    },
    {
      table: "documents",
      scope: { tenant_id: tenantId },
      description: "delete eval tenant documents (tenant-scoped)",
    },
  ];
}

/**
 * Runtime guard: every refresh delete must target a corpus table (not a
 * forbidden/non-corpus one) AND be scoped to the exact eval tenant id. Throws
 * otherwise, so the refresh can never widen into a broad or cross-table delete.
 */
export function assertRefreshDeleteScoped(plan: RefreshDelete[], tenantId: string): void {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("refresh delete plan requires a non-empty eval tenant id");
  }
  const corpus = new Set<string>(REFRESH_CORPUS_TABLES);
  const forbidden = new Set<string>(PROVISION_FORBIDDEN_ENTITIES);
  for (const d of plan) {
    if (forbidden.has(d.table)) {
      throw new Error(`refresh delete targets FORBIDDEN table "${d.table}" — refusing`);
    }
    if (!corpus.has(d.table)) {
      throw new Error(`refresh delete targets non-corpus table "${d.table}" — refusing`);
    }
    if (!d.scope || d.scope.tenant_id !== tenantId) {
      throw new Error(
        `refresh delete on "${d.table}" is not scoped to eval tenant "${tenantId}" — refusing broad delete`,
      );
    }
  }
}

export type RefreshGateDecision =
  | { ok: true; projectRef: string; tenantId: string }
  | { ok: false; reason: string };

/**
 * Decide whether a corpus refresh may proceed. It builds on decideGate (so it
 * inherits the --confirm-project-must-match-VITE_SUPABASE_URL rule), then adds:
 * refresh must be a real write (never dry-run) and must carry an explicit
 * --confirm-tenant-id. The id is matched against the resolved tenant in the IO
 * layer (assertIsEvalTenant) — this gate only proves it was supplied.
 */
export function decideRefreshGate(
  args: ProvisionArgs,
  envUrl: string | undefined | null,
): RefreshGateDecision {
  const base = decideGate(args, envUrl);
  if (!base.ok) return { ok: false, reason: base.reason };
  if (base.mode !== "write") {
    return {
      ok: false,
      reason:
        "--refresh-corpus requires a real write (--confirm-project matching VITE_SUPABASE_URL); " +
        "dry-run cannot refresh.",
    };
  }
  if (!args.confirmTenantId || args.confirmTenantId.trim() === "") {
    return {
      ok: false,
      reason:
        "refusing to refresh without --confirm-tenant-id <id> (hard confirmation of the eval tenant id).",
    };
  }
  return { ok: true, projectRef: base.projectRef, tenantId: args.confirmTenantId };
}

export interface ResolvedTenantIdentity {
  id: string;
  name: string;
  slug: string | null;
}

/**
 * Final identity guard before any delete: the resolved tenant must be the
 * Sentinel eval tenant (right name + slug prefix), must NOT be the E2E suite
 * tenant, and its id must equal the operator-supplied --confirm-tenant-id.
 */
export function assertIsEvalTenant(
  tenant: ResolvedTenantIdentity,
  confirmTenantId: string,
): void {
  if (tenant.name === E2E_TENANT_NAME) {
    throw new Error(
      `refusing to refresh: resolved tenant is the E2E suite tenant "${tenant.name}", not the eval tenant`,
    );
  }
  if (tenant.name !== EVAL_TENANT_NAME) {
    throw new Error(
      `refusing to refresh: resolved tenant name "${tenant.name}" is not "${EVAL_TENANT_NAME}"`,
    );
  }
  if (!tenant.slug || !tenant.slug.startsWith(EVAL_TENANT_SLUG_PREFIX)) {
    throw new Error(
      `refusing to refresh: tenant slug "${tenant.slug}" does not start with "${EVAL_TENANT_SLUG_PREFIX}"`,
    );
  }
  if (tenant.id !== confirmTenantId) {
    throw new Error(
      `refusing to refresh: resolved tenant id "${tenant.id}" does not match --confirm-tenant-id "${confirmTenantId}"`,
    );
  }
}
