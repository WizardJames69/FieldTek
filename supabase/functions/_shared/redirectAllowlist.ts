// ============================================================
// Auth redirect allowlist — PURE, side-effect-free
// ============================================================
// Guards every auth email link against untrusted / localhost redirect targets.
// A production verification email once shipped with `redirect_to=http://localhost:3000`;
// this module makes that impossible by normalizing any caller-supplied redirect to a
// known production origin (or a safe fallback) before it is ever placed in an email.
//
// Pure by design (no Deno/network/clock access) so it is unit-testable from vitest
// (see src/test/lib/redirectAllowlist.test.ts) and importable by the Deno edge
// function (send-auth-email/index.ts).

/** Default production redirect used when the caller value is missing or untrusted. */
export const DEFAULT_SAFE_REDIRECT = "https://fieldtek.ai/dashboard";

/** Hosts permitted to appear in an auth email link. Apex + www only (strict). */
export const DEFAULT_ALLOWED_HOSTS = ["fieldtek.ai", "www.fieldtek.ai"];

export interface ResolveSafeRedirectOptions {
  /** Override the permitted hosts (e.g. from an env var). Defaults to DEFAULT_ALLOWED_HOSTS. */
  allowedHosts?: string[];
  /** Override the fallback returned when input is missing/untrusted. */
  fallback?: string;
}

/**
 * Return `input` only if it is an absolute HTTPS URL whose host is allowlisted;
 * otherwise return the safe fallback. Path + query (e.g. an invite `?token=`) are
 * preserved for allowed hosts. HTTP, localhost, IPs, malformed, and non-allowlisted
 * hosts all collapse to the fallback — so a stray dev origin can never reach an email.
 */
export function resolveSafeRedirect(
  input: string | null | undefined,
  opts: ResolveSafeRedirectOptions = {},
): string {
  const allowedHosts = (opts.allowedHosts ?? DEFAULT_ALLOWED_HOSTS).map((h) =>
    h.trim().toLowerCase(),
  );
  const fallback = opts.fallback ?? DEFAULT_SAFE_REDIRECT;

  if (!input || typeof input !== "string") return fallback;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fallback; // not an absolute URL
  }

  // Production auth links must be HTTPS — this alone rejects http://localhost:3000.
  if (url.protocol !== "https:") return fallback;

  if (!allowedHosts.includes(url.hostname.toLowerCase())) return fallback;

  return url.toString();
}

/**
 * Parse a comma/space separated host allowlist (e.g. an env var) into a clean list,
 * or return undefined so callers fall back to DEFAULT_ALLOWED_HOSTS.
 */
export function parseAllowedHosts(raw: string | null | undefined): string[] | undefined {
  if (!raw) return undefined;
  const hosts = raw
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
  return hosts.length > 0 ? hosts : undefined;
}
