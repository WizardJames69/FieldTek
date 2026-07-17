// ============================================================
// send-beta-approval — Platform-admin authorization + request handler (PR-SEC-6 / Gap 2)
// ============================================================
// Side-effect-free (no serve(), no top-level createClient) so the handler and
// its authorization decision can be unit-tested with injected deps — the same
// seam pattern as send-invoice-reminder/authz.ts and _shared/tenantAuth.ts.
//
// This endpoint approves a beta application and emails the applicant a branded
// FieldTek access code. Its ONLY caller is the platform-admin "Approve" /
// "Resend Email" action in src/pages/admin/AdminBetaApplications.tsx, invoked
// under the signed-in platform admin's session. It runs with the service role
// (RLS bypassed) and previously had NO auth check AND verify_jwt=false, so anyone
// could send a branded FieldTek email to any address and stamp any
// beta_applications row. This module restores authentication + platform-admin
// authorization and structurally guarantees that NO email is sent and NO
// beta_applications read/write occurs until the caller is proven a platform
// admin.
//
// beta_applications is a PLATFORM table (RLS `FOR ALL USING is_platform_admin()`),
// not tenant-scoped, so platform-admin role is the whole authorization boundary —
// no per-tenant check applies. Edge functions cannot use the is_platform_admin()
// RPC (a service-role client has auth.uid() = null); they do a platform_admins
// table lookup keyed by the token's verified user id — same as
// promote-lesson / send-campaign.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface BetaApprovalRequest {
  email: string;
  companyName: string;
  promoCode: string;
  applicationId?: string;
}

export interface BetaApprovalDecision {
  allowed: boolean;
  status?: 401 | 403;
}

/**
 * PURE authorization decision. `userId` is the id returned by a *verified* JWT
 * (never a body field); `isPlatformAdmin` is the result of a privileged
 * platform_admins lookup for that id. No user → 401; authenticated but not a
 * platform admin (an ordinary user OR a mere tenant admin) → 403.
 */
export function decideBetaApprovalAccess(params: {
  userId: string | null;
  isPlatformAdmin: boolean;
}): BetaApprovalDecision {
  if (!params.userId) return { allowed: false, status: 401 };
  if (!params.isPlatformAdmin) return { allowed: false, status: 403 };
  return { allowed: true };
}

/**
 * Privileged platform_admins membership lookup, fail-CLOSED. Returns false on a
 * missing row, a query error, or a thrown exception — never an accidental allow.
 * `client` must be a service-role client (platform_admins is admin-gated).
 */
export async function lookupPlatformAdmin(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("platform_admins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export interface BetaApprovalDeps {
  /** Resolve a bearer token to a verified user id via GoTrue; null on any failure (fail closed). */
  getUserId: (token: string) => Promise<string | null>;
  /** True iff userId is a platform admin; false on any error (fail closed). */
  isPlatformAdmin: (userId: string) => Promise<boolean>;
  /** Send the approval email. Called ONLY after platform-admin authorization. */
  sendApprovalEmail: (
    input: BetaApprovalRequest,
  ) => Promise<{ ok: boolean; status: number; error?: string; messageId?: string }>;
  /** Record the email result on the beta_applications row. Called ONLY after authorization. */
  recordEmailResult: (
    applicationId: string,
    result: { sentAt?: string; error?: string | null },
  ) => Promise<void>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Authorize, THEN act. Order (enforced):
 *   1. OPTIONS preflight → 200 (no auth needed).
 *   2. Read the Authorization header (Bearer). Missing/malformed → 401.
 *   3. Verify the JWT → user id (deps.getUserId). Invalid/rejected → user id null.
 *   4. ONLY for an authenticated user, look up platform_admins (deps.isPlatformAdmin).
 *   5. Deny (401/403, generic) BEFORE parsing the body — so no request-controlled
 *      email / promo code / applicationId is read, logged, emailed, or written on
 *      an unauthorized path. Email + beta_applications writes happen ONLY on allow.
 */
export async function handleBetaApproval(
  req: Request,
  deps: BetaApprovalDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // 3. Verify JWT → user id (never from the body)
  const userId = token ? await deps.getUserId(token) : null;

  // 4. Platform-admin membership — only for a genuinely authenticated user, so an
  //    unauthenticated caller never triggers the privileged lookup.
  const isAdmin = userId ? await deps.isPlatformAdmin(userId) : false;

  // 5. Decide before ANY body read or side effect. Generic denial — never
  //    disclose platform-admin membership details.
  const decision = decideBetaApprovalAccess({ userId, isPlatformAdmin: isAdmin });
  if (!decision.allowed) {
    return json(
      { error: decision.status === 401 ? "Unauthorized" : "Forbidden" },
      decision.status ?? 403,
    );
  }

  // ── Authorized platform admin past this point ──
  let body: BetaApprovalRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { email, companyName, promoCode, applicationId } = body ?? ({} as BetaApprovalRequest);
  if (!email || !companyName || !promoCode) {
    return json({ error: "Missing required fields: email, companyName, promoCode" }, 400);
  }

  const result = await deps.sendApprovalEmail({ email, companyName, promoCode, applicationId });

  if (!result.ok) {
    if (applicationId) {
      await deps.recordEmailResult(applicationId, {
        error: `Failed to send email: ${result.status}${result.error ? ` - ${result.error}` : ""}`,
      });
    }
    return json({ error: `Failed to send email: ${result.status}` }, 502);
  }

  if (applicationId) {
    await deps.recordEmailResult(applicationId, {
      sentAt: new Date().toISOString(),
      error: null,
    });
  }

  return json({ success: true, messageId: result.messageId }, 200);
}
