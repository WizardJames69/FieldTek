/**
 * Shared rate limiting utility for Supabase Edge Functions.
 *
 * Uses the `rate_limits` table with a sliding-window counter pattern.
 * Fail-open on DB errors (logs error, allows the request).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitConfig {
  /** The identifier type stored in the rate_limits table (e.g. 'ip', 'tenant_api'). */
  identifierType: string;
  /** The identifier value (e.g. an IP address, email, or API key prefix). */
  identifier: string;
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within the window. */
  maxRequests: number;
  /** Override the window start time. If not provided, computed as Date.now() - windowMs. */
  windowStart?: Date;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** The configured limit. */
  limit: number;
}

/**
 * Check and increment the rate limit counter for the given identifier.
 *
 * Uses `.maybeSingle()` to avoid PGRST116 errors when no record exists.
 * Fails open on any DB error — logs the error and allows the request.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { identifierType, identifier, windowMs, maxRequests, windowStart } = config;

  const windowStartStr = windowStart
    ? windowStart.toISOString()
    : new Date(Date.now() - windowMs).toISOString();

  try {
    const { data: existing, error: fetchError } = await supabase
      .from("rate_limits")
      .select("id, request_count")
      .eq("identifier", identifier)
      .eq("identifier_type", identifierType)
      .gte("window_start", windowStartStr)
      .maybeSingle();

    if (fetchError) {
      console.error("[rateLimit] fetch error:", fetchError);
      return { allowed: true, remaining: maxRequests, limit: maxRequests };
    }

    if (existing) {
      if (existing.request_count >= maxRequests) {
        return { allowed: false, remaining: 0, limit: maxRequests };
      }

      const { error: updateError } = await supabase
        .from("rate_limits")
        .update({ request_count: existing.request_count + 1 })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[rateLimit] update error:", updateError);
      }

      return {
        allowed: true,
        remaining: maxRequests - existing.request_count - 1,
        limit: maxRequests,
      };
    }

    // No existing record — create one
    const { error: insertError } = await supabase.from("rate_limits").insert({
      identifier,
      identifier_type: identifierType,
      request_count: 1,
      window_start: new Date().toISOString(),
    });

    if (insertError) {
      console.error("[rateLimit] insert error:", insertError);
    }

    return { allowed: true, remaining: maxRequests - 1, limit: maxRequests };
  } catch (err) {
    console.error("[rateLimit] unexpected error:", err);
    return { allowed: true, remaining: maxRequests, limit: maxRequests };
  }
}

/**
 * Extract the client IP from the request, checking standard proxy headers.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Probabilistically trigger cleanup of old rate limit records.
 * Default probability is 1% (0.01).
 */
export async function maybeCleanupRateLimits(
  supabase: SupabaseClient,
  probability: number = 0.01
): Promise<void> {
  if (Math.random() >= probability) return;
  try {
    await supabase.rpc("cleanup_old_rate_limits");
  } catch (err) {
    console.error("[rateLimit] cleanup error:", err);
  }
}
