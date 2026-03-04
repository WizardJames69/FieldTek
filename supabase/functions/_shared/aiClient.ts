// ============================================================
// Shared AI Gateway Client — Fallback + Circuit Breaker
// ============================================================
// Wraps all AI gateway fetch calls (embeddings + chat/completions)
// with timeout-based fallback to a secondary provider and a
// simple circuit breaker to avoid hammering a failing primary.
//
// Configuration (env vars):
//   AI_GATEWAY_URL          — primary gateway (default: Lovable)
//   AI_FALLBACK_URL         — fallback gateway (optional)
//   AI_FALLBACK_API_KEY     — fallback API key (optional)
//   AI_GATEWAY_TIMEOUT_MS   — per-request timeout (default: 8000)
//
// Circuit breaker states:
//   closed    — normal operation, all requests go to primary
//   open      — primary has failed repeatedly, go straight to fallback
//   half-open — cooldown expired, send one probe to primary
// ============================================================

const AI_PRIMARY_URL =
  (typeof Deno !== "undefined" ? Deno.env.get("AI_GATEWAY_URL") : undefined) ||
  "https://ai.gateway.lovable.dev/v1";

const AI_FALLBACK_URL =
  (typeof Deno !== "undefined" ? Deno.env.get("AI_FALLBACK_URL") : undefined) ||
  null;

const AI_FALLBACK_KEY =
  (typeof Deno !== "undefined"
    ? Deno.env.get("AI_FALLBACK_API_KEY")
    : undefined) || null;

const GATEWAY_TIMEOUT_MS = parseInt(
  (typeof Deno !== "undefined"
    ? Deno.env.get("AI_GATEWAY_TIMEOUT_MS")
    : undefined) || "8000",
  10
);

// ── Circuit Breaker State (per Deno isolate lifetime) ────────

type CircuitState = "closed" | "open" | "half-open";

let circuitState: CircuitState = "closed";
let consecutiveFailures = 0;
let circuitOpenedAt = 0;

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 30_000; // 30 seconds

// ── Public Types ─────────────────────────────────────────────

export interface AIFetchResult {
  response: Response;
  gatewayUsed: "primary" | "fallback";
}

// ── Main Entry Point ─────────────────────────────────────────

/**
 * Fetch from the AI gateway with automatic fallback and circuit breaker.
 *
 * @param path    API path appended to the gateway URL (e.g. "/embeddings", "/chat/completions")
 * @param body    JSON body to send
 * @param primaryApiKey  Bearer token for the primary gateway
 * @param correlationId  Optional correlation ID for tracing
 */
export async function fetchWithFallback(
  path: string,
  body: Record<string, unknown>,
  primaryApiKey: string,
  correlationId?: string
): Promise<AIFetchResult> {
  // Circuit breaker: check if we should skip primary entirely
  if (circuitState === "open") {
    if (Date.now() - circuitOpenedAt > CIRCUIT_COOLDOWN_MS) {
      circuitState = "half-open";
      console.log(
        `[aiClient] Circuit half-open, sending probe to primary`
      );
    } else if (AI_FALLBACK_URL && AI_FALLBACK_KEY) {
      console.warn(
        `[aiClient] Circuit open (${consecutiveFailures} failures), routing to fallback`
      );
      return callGateway(AI_FALLBACK_URL, path, body, AI_FALLBACK_KEY, correlationId, "fallback");
    }
    // If no fallback configured, fall through and try primary anyway
  }

  // Try primary gateway
  try {
    const result = await callGatewayWithTimeout(
      AI_PRIMARY_URL,
      path,
      body,
      primaryApiKey,
      correlationId,
      "primary",
      GATEWAY_TIMEOUT_MS
    );

    // 429/402 are "expected" errors — primary is alive, just rate-limited/billing
    if (result.response.ok || result.response.status === 429 || result.response.status === 402) {
      onPrimarySuccess();
      return result;
    }

    // 5xx → primary is unhealthy, try fallback
    if (result.response.status >= 500) {
      onPrimaryFailure();
      if (AI_FALLBACK_URL && AI_FALLBACK_KEY) {
        console.warn(
          `[aiClient] Primary returned ${result.response.status}, falling back`
        );
        return callGateway(AI_FALLBACK_URL, path, body, AI_FALLBACK_KEY, correlationId, "fallback");
      }
    }

    // 4xx (other than 429/402) — return as-is, don't trip circuit
    return result;
  } catch (err) {
    // Network error or timeout
    onPrimaryFailure();
    console.warn(
      `[aiClient] Primary request failed: ${err instanceof Error ? err.message : String(err)}`
    );

    if (AI_FALLBACK_URL && AI_FALLBACK_KEY) {
      console.warn(`[aiClient] Attempting fallback`);
      return callGateway(AI_FALLBACK_URL, path, body, AI_FALLBACK_KEY, correlationId, "fallback");
    }

    throw err;
  }
}

// ── Internal Helpers ─────────────────────────────────────────

async function callGateway(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  apiKey: string,
  correlationId: string | undefined,
  label: "primary" | "fallback"
): Promise<AIFetchResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (correlationId) {
    headers["X-Correlation-ID"] = correlationId;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return { response, gatewayUsed: label };
}

async function callGatewayWithTimeout(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  apiKey: string,
  correlationId: string | undefined,
  label: "primary" | "fallback",
  timeoutMs: number
): Promise<AIFetchResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (correlationId) {
    headers["X-Correlation-ID"] = correlationId;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { response, gatewayUsed: label };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Circuit Breaker Transitions ──────────────────────────────

function onPrimarySuccess(): void {
  if (consecutiveFailures > 0) {
    console.log(
      `[aiClient] Primary recovered after ${consecutiveFailures} failure(s)`
    );
  }
  consecutiveFailures = 0;
  if (circuitState === "half-open") {
    circuitState = "closed";
    console.log(`[aiClient] Circuit closed (primary recovered)`);
  }
}

function onPrimaryFailure(): void {
  consecutiveFailures++;
  if (
    consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD &&
    circuitState !== "open"
  ) {
    circuitState = "open";
    circuitOpenedAt = Date.now();
    console.warn(
      `[aiClient] Circuit OPEN after ${consecutiveFailures} consecutive failures`
    );
  }
}

/** Expose circuit state for logging/diagnostics. */
export function getCircuitState(): CircuitState {
  return circuitState;
}
