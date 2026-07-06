/**
 * Shared tenant-authorization helpers for edge functions that run with the
 * service role but accept end-user callers.
 *
 * The problem these solve: a function that authenticates "some logged-in user"
 * and then acts with the service role (RLS bypassed) on a resource identified
 * by a request-body id is a cross-tenant IDOR unless it *also* checks the
 * caller belongs to the resource's tenant. These helpers centralize that check
 * so every call site enforces it identically.
 *
 * Design:
 *  - `decideTenantResourceAccess` is a PURE decision (unit-tested) — service
 *    role is always allowed; an unauthenticated caller is 401; an authenticated
 *    non-member is 404 by default (do not leak whether the resource exists).
 *  - `getAuthenticatedUser` / `userHasTenantMembership` are dependency-light IO
 *    helpers (raw fetch, injectable for tests) that FAIL CLOSED — any error
 *    resolves to "no user" / "not a member", never an accidental allow.
 *
 * These do NOT replace RLS; they restore object-level authorization on the
 * service-role paths that bypass it.
 */

export interface SupabaseEnv {
  supabaseUrl: string;
  serviceKey: string;
  anonKey: string;
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

/** Read the standard Supabase env vars with the same fallbacks the functions
 * already use (anon key falls back to the service key for the apikey header). */
export function readSupabaseEnv(): SupabaseEnv {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;
  return { supabaseUrl, serviceKey, anonKey };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True iff `value` is a canonically-formatted UUID. Cheap input-validation
 * guard so we never interpolate arbitrary strings into a PostgREST filter. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Resolve the end-user behind a bearer token via GoTrue. Returns null for any
 * failure (missing/blank header, non-2xx, network/parse error) — fail closed.
 * The caller is expected to have already ruled out the service-role path.
 */
export async function getAuthenticatedUser(
  authHeader: string | null,
  env: SupabaseEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthedUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  if (!env.supabaseUrl) return null;
  try {
    const res = await fetchImpl(`${env.supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: env.anonKey },
    });
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    const user = await res.json();
    if (!user || typeof user.id !== "string") return null;
    return { id: user.id, email: typeof user.email === "string" ? user.email : null };
  } catch {
    return null;
  }
}

/**
 * Does `userId` have an ACTIVE membership in `tenantId` (optionally restricted
 * to `opts.roles`)? Uses a service-role REST read of `tenant_users`. Returns
 * false on any error or malformed id — fail closed.
 */
export async function userHasTenantMembership(
  userId: string,
  tenantId: string,
  env: SupabaseEnv,
  opts: { roles?: string[] } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(tenantId)) return false;
  if (!env.supabaseUrl || !env.serviceKey) return false;

  const params = new URLSearchParams({
    user_id: `eq.${userId}`,
    tenant_id: `eq.${tenantId}`,
    is_active: "eq.true",
    select: "role",
    limit: "1",
  });
  if (opts.roles && opts.roles.length > 0) {
    // Roles are function-controlled literals, but sanitize defensively.
    const safe = opts.roles.filter((r) => /^[a-z_]+$/i.test(r));
    if (safe.length === 0) return false;
    params.set("role", `in.(${safe.join(",")})`);
  }

  try {
    const res = await fetchImpl(
      `${env.supabaseUrl}/rest/v1/tenant_users?${params.toString()}`,
      {
        headers: {
          apikey: env.serviceKey,
          Authorization: `Bearer ${env.serviceKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      await res.body?.cancel();
      return false;
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export type TenantAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 404; reason: string };

/**
 * Pure authorization decision for a tenant-owned resource accessed on a
 * service-role path.
 *
 *  - service role  → always allowed (internal/cron/retry callers).
 *  - no user       → 401 (must authenticate).
 *  - non-member    → 404 by default (do not disclose that the resource exists);
 *                    pass `denyStatus: 403` where existence is not sensitive.
 */
export function decideTenantResourceAccess(params: {
  isServiceRole: boolean;
  userId: string | null;
  isMember: boolean;
  denyStatus?: 403 | 404;
}): TenantAccessDecision {
  if (params.isServiceRole) return { allowed: true };
  if (!params.userId) {
    return { allowed: false, status: 401, reason: "unauthenticated" };
  }
  if (!params.isMember) {
    return {
      allowed: false,
      status: params.denyStatus ?? 404,
      reason: "not_a_tenant_member",
    };
  }
  return { allowed: true };
}
