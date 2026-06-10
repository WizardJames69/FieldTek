/**
 * Service-role bearer verification for internal/retry invocations.
 *
 * Edge functions that accept both user JWTs and service-role calls
 * historically gated the service path on exact string equality with the
 * runtime-injected SUPABASE_SERVICE_ROLE_KEY. That breaks when the caller
 * holds a *different but equally valid* service-role credential — e.g. the
 * retry_stuck_documents pg_net cron sends the project's legacy JWT-format
 * service_role key from Vault, which is not byte-identical to the value the
 * edge runtime injects. The result: cron bookkeeping ran but every
 * re-invocation 401'd, so stuck documents were never actually recovered.
 *
 * This helper accepts a bearer as service-role iff:
 *   1. it exactly matches the injected SUPABASE_SERVICE_ROLE_KEY (fast
 *      path, no network), OR
 *   2. its JWT payload claims role=service_role AND GoTrue confirms the
 *      token cryptographically via an Auth admin endpoint round-trip.
 *
 * The payload decode alone is NEVER trusted — anyone can mint an unsigned
 * JWT claiming service_role. It is only a cheap pre-filter so anon and
 * authenticated-user JWTs (role "anon"/"authenticated") skip the network
 * probe and fall through to the normal user-auth path unchanged. The
 * actual authentication decision for a service_role claim is delegated to
 * GoTrue, which verifies the signature against the project's JWT config
 * (legacy shared secret and current signing keys alike) and only authorizes
 * admin endpoints for admin roles. Any error fails closed.
 */

interface JwtPayload {
  role?: unknown;
  [key: string]: unknown;
}

/** Decode a JWT payload WITHOUT verifying the signature. Returns null for
 * anything that is not shaped like a JWT (e.g. sb_secret_... opaque keys). */
export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload === "object" && payload !== null ? payload as JwtPayload : null;
  } catch {
    return null;
  }
}

/** The unverified role claim of a JWT-shaped token, else null. */
export function unverifiedJwtRole(token: string): string | null {
  const payload = decodeJwtPayload(token);
  return payload && typeof payload.role === "string" ? payload.role : null;
}

/** Ask GoTrue whether this token is a real admin-role credential. The
 * admin users endpoint verifies the JWT signature server-side and returns
 * 2xx only for admin roles (service_role); forged, expired, anon and user
 * tokens all get 401/403. The response body is discarded unread. */
async function verifyServiceClaimWithGoTrue(token: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return false;
  // The gateway requires an apikey header; the anon key (always injected
  // and gateway-valid) is fine — authorization is decided from the
  // Authorization JWT, which is the token under test.
  const apikey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: { Authorization: `Bearer ${token}`, apikey },
  });
  await res.body?.cancel();
  return res.ok;
}

export interface ServiceRoleBearerOptions {
  /** Override the exact-match key (default: injected SUPABASE_SERVICE_ROLE_KEY). */
  exactKey?: string;
  /** Override the remote verifier (tests inject a stub here). */
  verifyServiceClaim?: (token: string) => Promise<boolean>;
}

/**
 * True iff the bearer is a valid service-role credential. False for
 * everything else — including valid anon/user JWTs, which callers should
 * then run through their normal user-auth path.
 */
export async function isServiceRoleBearer(
  token: string,
  options: ServiceRoleBearerOptions = {},
): Promise<boolean> {
  if (!token) return false;

  const exactKey = options.exactKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (exactKey && token === exactKey) return true;

  // Cheap pre-filter: only tokens *claiming* service_role are worth a
  // network round-trip. This is not an auth decision.
  if (unverifiedJwtRole(token) !== "service_role") return false;

  const verify = options.verifyServiceClaim ?? verifyServiceClaimWithGoTrue;
  try {
    return await verify(token);
  } catch {
    return false; // fail closed on network/verifier errors
  }
}
