import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit as sharedCheckRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

// SHA-256 hash of the raw API key
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function errorResponse(
  error: string,
  code: string,
  status: number,
  extraHeaders: Record<string, string> = {}
) {
  return jsonResponse({ error, code }, status, extraHeaders);
}

// Rate limiting: 60 requests per minute per key
async function checkApiRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  keyPrefix: string
): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
  limit: number;
}> {
  const WINDOW_MS = 60 * 1000;
  const resetTs = Math.floor(Date.now() / WINDOW_MS) * 60 + 60;

  const rl = await sharedCheckRateLimit(serviceClient, {
    identifierType: "tenant_api",
    identifier: `api_key:${keyPrefix}`,
    windowMs: WINDOW_MS,
    maxRequests: 60,
  });

  return { ...rl, reset: resetTs };
}

function rateLimitHeaders(rl: {
  limit: number;
  remaining: number;
  reset: number;
}) {
  return {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(rl.reset),
  };
}

// Authenticate an API key and return { tenantId, scopes, keyPrefix }
async function authenticate(
  serviceClient: ReturnType<typeof createClient>,
  authHeader: string | null
): Promise<
  | { ok: true; tenantId: string; scopes: string[]; keyPrefix: string }
  | { ok: false; error: string; code: string }
> {
  if (!authHeader?.startsWith("Bearer ft_live_")) {
    return { ok: false, error: "Missing or invalid Authorization header. Use: Bearer ft_live_...", code: "MISSING_AUTH" };
  }

  const rawKey = authHeader.replace("Bearer ", "");
  const keyHash = await sha256(rawKey);
  // prefix is the portion after "ft_live_", first 12 chars
  const keyPart = rawKey.replace("ft_live_", "");
  const keyPrefix = `ft_live_${keyPart.substring(0, 8)}`;

  const { data: keyRecord, error } = await serviceClient
    .from("tenant_api_keys")
    .select("id, tenant_id, scopes, revoked_at, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRecord) {
    return { ok: false, error: "Invalid API key", code: "INVALID_API_KEY" };
  }

  if (keyRecord.revoked_at) {
    return { ok: false, error: "API key has been revoked", code: "KEY_REVOKED" };
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return { ok: false, error: "API key has expired", code: "KEY_EXPIRED" };
  }

  // Check tenant is Professional or Enterprise
  const { data: tenant } = await serviceClient
    .from("tenants")
    .select("subscription_tier")
    .eq("id", keyRecord.tenant_id)
    .maybeSingle();

  if (!tenant || !["professional", "enterprise"].includes(tenant.subscription_tier)) {
    return {
      ok: false,
      error: "API access requires Professional or Enterprise plan",
      code: "PLAN_REQUIRED",
    };
  }

  // Update last_used_at async (fire-and-forget)
  serviceClient
    .from("tenant_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id)
    .then(() => {});

  return {
    ok: true,
    tenantId: keyRecord.tenant_id,
    scopes: keyRecord.scopes ?? ["read"],
    keyPrefix,
  };
}

function requireWriteScope(scopes: string[]) {
  return scopes.includes("write");
}

function parseQueryParams(url: URL) {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20"), 1), 100);
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "1"), 1);
  const status = url.searchParams.get("status");
  const since = url.searchParams.get("since");
  return { limit, page, status, since };
}

// --- Resource Handlers ---

async function handleJobs(
  req: Request,
  url: URL,
  method: string,
  serviceClient: ReturnType<typeof createClient>,
  tenantId: string,
  scopes: string[],
  resourceId: string | null
) {
  if (method === "GET") {
    if (resourceId) {
      const { data, error } = await serviceClient
        .from("scheduled_jobs")
        .select("id, title, description, status, priority, job_type, scheduled_date, scheduled_time, address, notes, created_at, updated_at, client_id, assigned_to")
        .eq("id", resourceId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error || !data) return errorResponse("Job not found", "NOT_FOUND", 404);
      return jsonResponse({ data });
    }

    const { limit, page, status, since } = parseQueryParams(url);
    let query = serviceClient
      .from("scheduled_jobs")
      .select("id, title, description, status, priority, job_type, scheduled_date, scheduled_time, address, notes, created_at, updated_at, client_id, assigned_to", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq("status", status);
    if (since) query = query.gte("updated_at", since);

    const { data, count, error } = await query;
    if (error) return errorResponse("Failed to fetch jobs", "DB_ERROR", 500);

    return jsonResponse({
      data,
      meta: { total: count ?? 0, page, limit, has_more: (count ?? 0) > page * limit },
    });
  }

  if (method === "POST") {
    if (!requireWriteScope(scopes)) {
      return errorResponse("Write scope required", "INSUFFICIENT_SCOPE", 403);
    }
    const body = await req.json();
    const { title, description, job_type, priority, scheduled_date, scheduled_time, address, client_id, assigned_to } = body;
    if (!title) return errorResponse("title is required", "VALIDATION_ERROR", 400);

    const { data, error } = await serviceClient
      .from("scheduled_jobs")
      .insert({ tenant_id: tenantId, title, description, job_type, priority, scheduled_date, scheduled_time, address, client_id, assigned_to })
      .select("id, title, status, created_at")
      .single();

    if (error) return errorResponse("Failed to create job", "DB_ERROR", 500);
    return jsonResponse({ data }, 201);
  }

  if (method === "PATCH" && resourceId) {
    if (!requireWriteScope(scopes)) {
      return errorResponse("Write scope required", "INSUFFICIENT_SCOPE", 403);
    }
    const body = await req.json();
    const allowed = ["status", "notes", "internal_notes", "assigned_to", "scheduled_date", "scheduled_time", "priority"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await serviceClient
      .from("scheduled_jobs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", resourceId)
      .eq("tenant_id", tenantId)
      .select("id, title, status, updated_at")
      .maybeSingle();

    if (error || !data) return errorResponse("Job not found or update failed", "NOT_FOUND", 404);
    return jsonResponse({ data });
  }

  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

async function handleClients(
  req: Request,
  url: URL,
  method: string,
  serviceClient: ReturnType<typeof createClient>,
  tenantId: string,
  scopes: string[],
  resourceId: string | null
) {
  if (method === "GET") {
    if (resourceId) {
      const { data, error } = await serviceClient
        .from("clients")
        .select("id, name, email, phone, address, city, state, zip_code, notes, created_at, updated_at")
        .eq("id", resourceId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error || !data) return errorResponse("Client not found", "NOT_FOUND", 404);
      return jsonResponse({ data });
    }

    const { limit, page, since } = parseQueryParams(url);
    const query = serviceClient
      .from("clients")
      .select("id, name, email, phone, address, city, state, zip_code, created_at, updated_at", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = since
      ? await query.gte("updated_at", since)
      : await query;

    if (error) return errorResponse("Failed to fetch clients", "DB_ERROR", 500);
    return jsonResponse({
      data,
      meta: { total: count ?? 0, page, limit, has_more: (count ?? 0) > page * limit },
    });
  }

  if (method === "POST") {
    if (!requireWriteScope(scopes)) {
      return errorResponse("Write scope required", "INSUFFICIENT_SCOPE", 403);
    }
    const body = await req.json();
    const { name, email, phone, address, city, state, zip_code, notes } = body;
    if (!name) return errorResponse("name is required", "VALIDATION_ERROR", 400);

    const { data, error } = await serviceClient
      .from("clients")
      .insert({ tenant_id: tenantId, name, email, phone, address, city, state, zip_code, notes })
      .select("id, name, email, created_at")
      .single();

    if (error) return errorResponse("Failed to create client", "DB_ERROR", 500);
    return jsonResponse({ data }, 201);
  }

  return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}

async function handleInvoices(
  _req: Request,
  url: URL,
  method: string,
  serviceClient: ReturnType<typeof createClient>,
  tenantId: string,
  resourceId: string | null
) {
  if (method !== "GET") {
    return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405);
  }

  if (resourceId) {
    const { data: invoice, error } = await serviceClient
      .from("invoices")
      .select("id, invoice_number, status, subtotal, tax_amount, total, due_date, paid_at, sent_at, notes, created_at, updated_at, client_id, job_id")
      .eq("id", resourceId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !invoice) return errorResponse("Invoice not found", "NOT_FOUND", 404);

    const { data: lineItems } = await serviceClient
      .from("invoice_line_items")
      .select("id, description, quantity, unit_price, total, item_type")
      .eq("invoice_id", resourceId);

    return jsonResponse({ data: { ...invoice, line_items: lineItems ?? [] } });
  }

  const { limit, page, status, since } = parseQueryParams(url);
  let query = serviceClient
    .from("invoices")
    .select("id, invoice_number, status, total, due_date, paid_at, created_at, updated_at, client_id", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq("status", status);
  if (since) query = query.gte("updated_at", since);

  const { data, count, error } = await query;
  if (error) return errorResponse("Failed to fetch invoices", "DB_ERROR", 500);
  return jsonResponse({
    data,
    meta: { total: count ?? 0, page, limit, has_more: (count ?? 0) > page * limit },
  });
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  // Path: /tenant-api/<resource>[/<id>]
  const pathParts = url.pathname.replace(/^\/tenant-api\/?/, "").split("/").filter(Boolean);
  const resource = pathParts[0] ?? "";
  const resourceId = pathParts[1] ?? null;
  const method = req.method.toUpperCase();

  // Health check — no auth needed
  if (resource === "ping") {
    return jsonResponse({ ok: true, version: "1.0.0", timestamp: new Date().toISOString() });
  }

  // Authenticate
  const authResult = await authenticate(serviceClient, req.headers.get("Authorization"));
  if (!authResult.ok) {
    return errorResponse(authResult.error, authResult.code, 401);
  }

  const { tenantId, scopes, keyPrefix } = authResult;

  // Rate limit
  const rl = await checkApiRateLimit(serviceClient, keyPrefix);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return errorResponse("Rate limit exceeded. Try again in 60 seconds.", "RATE_LIMIT_EXCEEDED", 429, rlHeaders);
  }

  // Route
  if (resource === "jobs") {
    const response = await handleJobs(req, url, method, serviceClient, tenantId, scopes, resourceId);
    // Merge rate limit headers
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(rlHeaders)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  }

  if (resource === "clients") {
    const response = await handleClients(req, url, method, serviceClient, tenantId, scopes, resourceId);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(rlHeaders)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  }

  if (resource === "invoices") {
    const response = await handleInvoices(req, url, method, serviceClient, tenantId, resourceId);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(rlHeaders)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  }

  return errorResponse(
    `Unknown resource '${resource}'. Valid resources: jobs, clients, invoices, ping`,
    "NOT_FOUND",
    404,
    rlHeaders
  );
});
