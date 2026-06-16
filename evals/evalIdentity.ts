// ============================================================
// Sentinel AI eval harness — dedicated eval identity (decoupled from E2E)
// ============================================================
// The eval tenant + admin login deliberately do NOT share identity with the
// Playwright E2E suite (e2e/helpers/test-data.ts). Sharing them caused two
// failures:
//
//   1. E2E global-setup resolves its tenant by `.eq('name', 'E2E Test Company')`
//      and its users by iterating TEST_USERS; global-teardown then DELETES the
//      tenant id + user ids it recorded. A same-named eval tenant got adopted
//      and deleted after every CI E2E run → the eval baseline was transient.
//   2. The provisioner resets the eval admin's password and the live runner
//      signs in as that admin. When that admin == the E2E admin, doing so during
//      an active E2E run revoked the suite's session → Assistant API 401s.
//
// Giving the eval harness its own name + email decouples it: global-setup's
// name/email lookups never match these values, so the eval tenant is never
// adopted into the E2E teardown context, and eval provisioning/baseline never
// touch the E2E admin's session. This module is the single source of truth for
// that identity; it is pure (literal constants, no IO) so it is unit-tested
// offline (src/test/evals/evalIdentity.test.ts) with no backend dependency.

/** Durable eval tenant name — distinct from the E2E suite's "E2E Test Company". */
export const EVAL_TENANT_NAME = "Sentinel Eval Company";

/** Slug prefix for the eval tenant (a timestamp suffix keeps each slug unique). */
export const EVAL_TENANT_SLUG_PREFIX = "sentinel-eval-company";

/** Industry for the eval tenant (matches the seeded HVAC fixture corpus). */
export const EVAL_TENANT_INDUSTRY = "hvac" as const;

/** Dedicated eval admin login — distinct from the E2E admin (e2e-admin@…). */
export const EVAL_ADMIN_EMAIL = "sentinel-eval-admin@fieldtek-test.dev";

/**
 * Eval admin password. A literal fixture credential for a test backend (parallel
 * to the E2E suite's literal test passwords) — kept literal, not env-derived, so
 * the provisioner (which creates the user) and the runner (which signs in) can
 * never disagree due to module import / dotenv ordering.
 */
export const EVAL_ADMIN_PASSWORD = "SentinelEval123!Test";

/** Display name for the eval admin's profile. */
export const EVAL_ADMIN_FULL_NAME = "Sentinel Eval Admin";

/**
 * Auth user_metadata marker for the eval admin. Distinct from the E2E suite's
 * `e2e_test_data` marker so no E2E-marker-based cleanup could ever match the
 * eval user.
 */
export const EVAL_USER_MARKER = "eval_test_data";
