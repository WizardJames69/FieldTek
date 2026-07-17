// ============================================================
// Field Assistant — Conversation Tenant/User-Ownership Guard (PR-SEC-6 / Gap 1)
// ============================================================
// Side-effect-free (no top-level I/O or server startup) so it can be imported
// directly by conversationOwnership.test.ts for real unit coverage — the same
// pattern as jobOwnership.ts / evidenceRow.ts.
//
// audit.ts::trackConversation writes the user + assistant `messages` rows on the
// service-role client (RLS bypassed) keyed off a CALLER-supplied conversationId.
// Without this guard any authenticated user could pass another tenant's/user's
// conversation UUID and have their message content (and the AI response) written
// into that foreign thread — a blind cross-tenant stored write. trackConversation
// calls this BEFORE reusing a supplied id; on false it discards the id and
// creates a fresh caller-owned conversation instead, and never writes to the
// supplied id.
//
// Leak-resistance is structural: the lookup filters by conversation id AND the
// caller's tenant id AND the caller's user id in a single query, so a
// conversation that does not exist, one owned by another tenant, and one owned by
// another user (even in the same tenant) all produce the identical result (no
// row → false). The caller cannot distinguish the cases.
//
// IMPORTANT: `tenantId` / `userId` passed here MUST be the already-authenticated
// server-side values (the caller's tenant_users row + getUser), never fields
// taken from the request body.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for a plain UUID string. conversationId is attacker-controllable
 * request input; anything that is not a UUID is rejected before it reaches a
 * query filter (defense-in-depth, and a malformed id skips the DB round trip).
 */
export function isValidConversationId(conversationId: unknown): conversationId is string {
  return typeof conversationId === "string" && UUID_PATTERN.test(conversationId);
}

/**
 * Prove that `conversationId` is a `conversations` row belonging to BOTH
 * `tenantId` AND `userId` before trackConversation reuses it.
 *
 * Fails CLOSED: a malformed id (no query issued), a missing row, a foreign-tenant
 * row, a foreign-user row, and any lookup error all return false and are
 * indistinguishable from one another. On false, trackConversation must NOT write
 * to the supplied id — it creates a fresh caller-owned conversation instead.
 */
export async function verifyConversationOwnership(
  client: SupabaseClient,
  conversationId: string,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  if (!isValidConversationId(conversationId)) return false;
  try {
    const { data, error } = await client
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    // Postgres returns uuid values lowercased; compare case-insensitively so a
    // valid uppercase id from a caller still verifies for its own tenant/user.
    return typeof data?.id === "string" && data.id.toLowerCase() === conversationId.toLowerCase();
  } catch (lookupErr) {
    console.error(
      "[conversationOwnership] Ownership lookup failed — failing CLOSED (a fresh conversation will be created):",
      lookupErr,
    );
    return false;
  }
}
