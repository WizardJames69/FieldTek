// ============================================================
// Field Assistant — Compliance Tenant-Ownership Guard (PR-SEC-3)
// ============================================================
// Side-effect-free (no top-level I/O or server startup) so it can be imported
// directly by complianceGuard.test.ts for real unit coverage — the same
// pattern as degradation.ts. index.ts calls verifyJobTenantOwnership before
// the deterministic compliance block, because that block runs on the
// service-role client (RLS bypassed) keyed off the caller-supplied
// context.job.id. Without this guard a caller could point the compliance
// engine at another tenant's job: reading its checklist completions, step
// evidence, and workflow state, and writing compliance_status / verdict rows
// onto it.
//
// Leak-resistance is structural: the ownership lookup filters by BOTH job id
// AND the caller's tenant id in a single query, so a job that does not exist
// and a job owned by another tenant produce the exact same result (no row →
// false → silent skip). The caller cannot distinguish the two cases from the
// response, and the compliance block is simply skipped — normal assistant
// behavior continues.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for a plain UUID string. context.job.id is attacker-controllable
 * request input; anything that is not a UUID is rejected before it reaches a
 * query filter (defense-in-depth — PostgREST would reject it anyway, but a
 * clean skip beats a caught exception).
 */
export function isValidJobId(jobId: unknown): jobId is string {
  return typeof jobId === "string" && UUID_PATTERN.test(jobId);
}

/**
 * Prove that `jobId` is a scheduled_jobs row belonging to `tenantId` before
 * any compliance read/write uses it. Fails CLOSED: any lookup error, missing
 * row, or foreign-tenant row returns false and the compliance block is
 * skipped. job_checklist_completions and workflow_step_evidence carry no
 * usable tenant scoping of their own for this path, so this job-level check
 * is the single gate that scopes every job-keyed query in the block.
 */
export async function verifyJobTenantOwnership(
  client: SupabaseClient,
  jobId: string,
  tenantId: string,
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("scheduled_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw error;
    // Postgres returns uuid values lowercased; compare case-insensitively so
    // a valid uppercase id from a caller still verifies for its own tenant.
    return typeof data?.id === "string" && data.id.toLowerCase() === jobId.toLowerCase();
  } catch (lookupErr) {
    console.error(
      "[compliance] Job ownership lookup failed — failing CLOSED (compliance skipped):",
      lookupErr,
    );
    return false;
  }
}
