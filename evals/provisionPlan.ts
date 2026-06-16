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
}

export function parseProvisionArgs(argv: string[]): ProvisionArgs {
  const args: ProvisionArgs = { dryRun: false, confirmProject: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--confirm-project") args.confirmProject = argv[++i] ?? null;
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
