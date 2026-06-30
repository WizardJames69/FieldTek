// ============================================================
// Pilot readiness — PURE decision helpers (no I/O, no network)
// ============================================================
// Side-effect-free logic shared by scripts/verify-pilot-readiness.ts and its
// unit test (src/test/lib/pilotReadiness.test.ts). Keeping this pure means the
// flag-resolution semantics and the hard-pass/hard-fail gate can be tested by
// vitest with NO network and NO Supabase connection.
//
// The flag-resolution logic below MUST stay byte-for-byte equivalent to the app
// resolver in src/hooks/useFeatureFlags.ts (simpleHash → hashTenantToPercentage
// → blocklist > allowlist > time-window > rollout). If that file changes, change
// this in lock-step (the unit test pins the precedence to catch drift).

// ── Feature-flag resolution (mirror of src/hooks/useFeatureFlags.ts) ──────────

/** Subset of the feature_flags row needed to resolve a flag for one tenant. */
export interface FeatureFlagRow {
  key: string;
  is_enabled: boolean;
  rollout_percentage: number;
  allowed_tenant_ids: string[] | null;
  blocked_tenant_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
}

// Simple hash function for consistent percentage assignment.
// Copied verbatim from src/hooks/useFeatureFlags.ts so script + app agree.
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Consistent hashing ensures the same tenant always gets the same result for a
// given flag. Copied verbatim from src/hooks/useFeatureFlags.ts.
function hashTenantToPercentage(tenantId: string, flagKey: string): number {
  const hash = simpleHash(`${tenantId}:${flagKey}`);
  return hash % 100;
}

/**
 * Resolve whether a feature flag is effectively ON for a given tenant, using the
 * exact precedence the app uses: kill-switch → tenant present → blocklist →
 * allowlist → time window → percentage rollout (consistent hashing).
 *
 * `now` is injected (not read from the clock) so the time-window branch stays
 * deterministic and unit-testable.
 */
export function resolveFlagForTenant(
  flag: FeatureFlagRow | undefined,
  tenantId: string | null,
  now: Date,
): boolean {
  // Flag doesn't exist or is disabled (kill switch).
  if (!flag || !flag.is_enabled) return false;

  // No tenant context - can't evaluate tenant-specific rules.
  if (!tenantId) return false;

  // Check blocklist first - blocked tenants never get the feature.
  if (flag.blocked_tenant_ids?.includes(tenantId)) return false;

  // Check allowlist - allowed tenants always get the feature.
  if (flag.allowed_tenant_ids?.includes(tenantId)) return true;

  // Check time window.
  if (flag.starts_at && new Date(flag.starts_at) > now) return false;
  if (flag.ends_at && new Date(flag.ends_at) < now) return false;

  // Percentage rollout using consistent hashing.
  const tenantPercentile = hashTenantToPercentage(tenantId, flag.key);
  return tenantPercentile < flag.rollout_percentage;
}

// ── Pilot-relevant flag posture ──────────────────────────────────────────────

/** Expected posture for a fresh pilot tenant under the current (Decision A) state. */
export type ExpectedPosture = "on" | "off" | "off-decision-a";

export interface PilotFlagExpectation {
  key: string;
  expected: ExpectedPosture;
  note: string;
}

/**
 * The flags a pilot operator actually cares about, and what posture to expect for
 * a fresh (un-allowlisted) tenant. `off-decision-a` flags are intentionally held
 * OFF by the Grounding-Trust milestone and must NOT be enabled as part of pilot
 * onboarding. This list is documentation-as-data; the script reports the live
 * resolution next to the expectation so drift is visible.
 */
export const PILOT_RELEVANT_FLAGS: PilotFlagExpectation[] = [
  { key: "workflow_state_tracking", expected: "on", note: "Fully rolled out; expected ON for every tenant." },
  { key: "rag_judge", expected: "off-decision-a", note: "Held eval-only at Decision A; leave OFF for pilots." },
  { key: "judge_blocking_mode", expected: "off-decision-a", note: "Held eval-only at Decision A; leave OFF for pilots." },
  { key: "judge_full_blocking", expected: "off-decision-a", note: "Held OFF globally at Decision A; do not enable." },
  { key: "lesson_citations", expected: "off-decision-a", note: "Allowlisted to eval + internal pilot only; do not widen." },
  { key: "compliance_engine", expected: "off", note: "Low rollout; allowlist the pilot only if the engagement needs it." },
  { key: "equipment_graph", expected: "off", note: "Off by default; allowlist the pilot only if diagnostics need the graph." },
  { key: "diagnostic_learning", expected: "off", note: "Off by default; allowlist the pilot only if the learning loop is in scope." },
  { key: "rag_reranking", expected: "off", note: "Off by default; optional retrieval-quality flag." },
];

// ── Readiness summary (hard-pass / hard-fail gate) ────────────────────────────

export interface TenantReadinessInput {
  tenantId: string;
  /** null when the tenant row was not found. */
  exists: boolean;
  clients: number;
  jobs: number;
  equipment: number;
  documents: number;
  /** document_chunks rows with a non-null embedding for this tenant. */
  embeddedChunks: number;
  /** documents whose embedding_status === 'completed'. */
  indexedDocuments: number;
}

export interface ReadinessInput {
  /** overall health-check status, or null if the endpoint was unreachable. */
  healthStatus: "healthy" | "degraded" | "unhealthy" | null;
  /** present only when --tenant-id was supplied. */
  tenant: TenantReadinessInput | null;
}

export interface ReadinessCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface ReadinessSummary {
  /** Hard checks decide the process exit code (all must pass for exit 0). */
  hardChecks: ReadinessCheck[];
  /** Warnings never fail the gate but are surfaced to the operator. */
  warnings: string[];
  /** true iff every hard check passed. */
  pass: boolean;
}

/**
 * Reduce raw readiness signals to a hard-pass/hard-fail gate + warnings.
 *
 * Hard checks (gate the exit code):
 *  - health-check must be reachable and not "unhealthy" (a 503/unhealthy fails).
 *  - if a tenant was requested, its tenant row must exist.
 *
 * Warnings (never fail the gate — informational for the operator):
 *  - tenant has no indexed document yet (RAG will be degraded until one lands).
 *  - tenant has embedded chunks = 0 (the observable proxy that doc ingestion —
 *    OPENAI_API_KEY + pgvector + storage bucket — actually works end-to-end).
 *  - tenant has zero clients (job form will show an empty client dropdown).
 *
 * This function is pure: it makes NO clock or network calls and is fully
 * determined by its input.
 */
export function summarizeReadiness(input: ReadinessInput): ReadinessSummary {
  const hardChecks: ReadinessCheck[] = [];
  const warnings: string[] = [];

  // Health-check hard gate.
  if (input.healthStatus === null) {
    hardChecks.push({
      name: "health-check reachable",
      pass: false,
      detail: "health-check endpoint was unreachable",
    });
  } else {
    hardChecks.push({
      name: "health-check status",
      pass: input.healthStatus !== "unhealthy",
      detail: `health-check reported "${input.healthStatus}"`,
    });
    if (input.healthStatus === "degraded") {
      warnings.push("health-check is DEGRADED — investigate before inviting a real user");
    }
  }

  // Tenant-scoped checks (only when a tenant id was supplied).
  if (input.tenant) {
    const t = input.tenant;

    hardChecks.push({
      name: "tenant exists",
      pass: t.exists,
      detail: t.exists ? `tenant ${t.tenantId} found` : `tenant ${t.tenantId} NOT found`,
    });

    if (t.exists) {
      if (t.clients === 0) {
        warnings.push(
          "tenant has 0 clients — the job form will show an empty client dropdown (jobs are still creatable with a null client)",
        );
      }
      if (t.indexedDocuments === 0 || t.embeddedChunks === 0) {
        warnings.push(
          "tenant has no fully-indexed document yet (indexedDocuments=" +
            `${t.indexedDocuments}, embeddedChunks=${t.embeddedChunks}) — AI answers will be ` +
            "degraded ('indexing incomplete') and document ingestion (OPENAI_API_KEY + pgvector + " +
            "storage bucket) is NOT yet proven end-to-end for this tenant",
        );
      }
    }
  }

  const pass = hardChecks.every((c) => c.pass);
  return { hardChecks, warnings, pass };
}
