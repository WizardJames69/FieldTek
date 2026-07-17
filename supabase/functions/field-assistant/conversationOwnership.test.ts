// PR-SEC-6 (Gap 1): conversation tenant/user-ownership guard + trackConversation
// behavior. Pure/stubbed only — no model, no network; run via
// `deno test --allow-env --allow-read supabase/functions/field-assistant/`.
//
// audit.ts::trackConversation writes messages on the service-role client (RLS
// bypassed) keyed off a CALLER-supplied conversationId. These tests prove the
// guard: own conversation reused, and any foreign/malformed/errored id fails
// closed to a fresh caller-owned conversation with NO write ever targeting the
// supplied id (no cross-tenant stored write, no existence leak).

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { isValidConversationId, verifyConversationOwnership } from "./conversationOwnership.ts";
import { trackConversation } from "./audit.ts";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_A2 = "44444444-4444-4444-8444-444444444444"; // another user in TENANT_A
const CONV_A = "22222222-2222-4222-8222-222222222222"; // owned by TENANT_A / USER_A
const CONV_B = "33333333-3333-4333-8333-333333333333"; // owned by TENANT_B
const CONV_MISSING = "55555555-5555-4555-8555-555555555555";
const NEW_ID = "99999999-9999-4999-8999-999999999999"; // id the stub mints for create-new

interface ConvRow {
  id: string;
  tenant_id: string;
  user_id: string;
}

// ── Ownership-guard stub (mirrors jobOwnership.test.ts): maybeSingle() applies
//    ONLY the .eq() filters the code under test supplied, so a forgotten
//    tenant_id/user_id filter would surface a foreign row and fail these tests.
function makeStubClient(
  rows: ConvRow[],
  opts: { queryError?: { message: string }; throwOnQuery?: boolean } = {},
) {
  const captured: { table: string | null; filters: Record<string, string> } = {
    table: null,
    filters: {},
  };
  const builder = {
    select(_columns: string) {
      return builder;
    },
    eq(column: string, value: string) {
      captured.filters[column] = value;
      return builder;
    },
    maybeSingle() {
      if (opts.throwOnQuery) throw new Error("connection reset");
      if (opts.queryError) return Promise.resolve({ data: null, error: opts.queryError });
      const match = rows.find((row) =>
        Object.entries(captured.filters).every(
          (entry) => row[entry[0] as keyof ConvRow] === entry[1],
        )
      ) ?? null;
      return Promise.resolve({ data: match ? { id: match.id } : null, error: null });
    },
  };
  const client = {
    from(table: string) {
      captured.table = table;
      return builder;
    },
  };
  return { client, captured };
}

const DB: ConvRow[] = [
  { id: CONV_A, tenant_id: TENANT_A, user_id: USER_A },
  { id: CONV_B, tenant_id: TENANT_B, user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
];

// ── isValidConversationId ───────────────────────────────────

Deno.test("isValidConversationId: accepts lower/upper UUID", () => {
  assertEquals(isValidConversationId(CONV_A), true);
  assertEquals(isValidConversationId(CONV_A.toUpperCase()), true);
});

Deno.test("isValidConversationId: rejects non-string / non-UUID / injection-shaped", () => {
  assertEquals(isValidConversationId(null), false);
  assertEquals(isValidConversationId(undefined), false);
  assertEquals(isValidConversationId(42), false);
  assertEquals(isValidConversationId(""), false);
  assertEquals(isValidConversationId("not-a-uuid"), false);
  assertEquals(isValidConversationId(`${CONV_A} OR 1=1`), false);
  assertEquals(isValidConversationId(CONV_A.slice(0, -1)), false);
});

// ── verifyConversationOwnership ─────────────────────────────

Deno.test("valid UUID + matching tenant and user → true", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await verifyConversationOwnership(client, CONV_A, TENANT_A, USER_A), true);
});

Deno.test("same id + foreign tenant → false", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await verifyConversationOwnership(client, CONV_B, TENANT_A, USER_A), false);
});

Deno.test("same tenant + foreign user → false", async () => {
  const { client } = makeStubClient(DB);
  // CONV_A belongs to USER_A; a different user in the same tenant cannot claim it.
  assertEquals(await verifyConversationOwnership(client, CONV_A, TENANT_A, USER_A2), false);
});

Deno.test("nonexistent id → false", async () => {
  const { client } = makeStubClient(DB);
  assertEquals(await verifyConversationOwnership(client, CONV_MISSING, TENANT_A, USER_A), false);
});

Deno.test("malformed UUID → false WITHOUT querying", async () => {
  const { client, captured } = makeStubClient(DB);
  assertEquals(await verifyConversationOwnership(client, "not-a-uuid", TENANT_A, USER_A), false);
  assertEquals(captured.table, null); // .from() never called
});

Deno.test("query returns an error → false (fail closed)", async () => {
  const { client } = makeStubClient(DB, { queryError: { message: "permission denied" } });
  assertEquals(await verifyConversationOwnership(client, CONV_A, TENANT_A, USER_A), false);
});

Deno.test("query throws → false (fail closed)", async () => {
  const { client } = makeStubClient(DB, { throwOnQuery: true });
  assertEquals(await verifyConversationOwnership(client, CONV_A, TENANT_A, USER_A), false);
});

Deno.test("foreign and nonexistent are externally indistinguishable", async () => {
  const foreign = await verifyConversationOwnership(makeStubClient(DB).client, CONV_B, TENANT_A, USER_A);
  const missing = await verifyConversationOwnership(makeStubClient(DB).client, CONV_MISSING, TENANT_A, USER_A);
  assertEquals(foreign, missing);
  assertEquals(foreign, false);
});

Deno.test("lookup filters conversations by id AND tenant_id AND user_id", async () => {
  const { client, captured } = makeStubClient(DB);
  await verifyConversationOwnership(client, CONV_A, TENANT_A, USER_A);
  assertEquals(captured.table, "conversations");
  assertEquals(captured.filters["id"], CONV_A);
  assertEquals(captured.filters["tenant_id"], TENANT_A);
  assertEquals(captured.filters["user_id"], USER_A);
});

// ── trackConversation behavior (recording client) ───────────
// Proves the resolved conversation id and that NO message insert ever targets an
// unverified supplied id.

interface InsertEvent {
  table: string;
  // deno-lint-ignore no-explicit-any
  rows: any;
}

function makeRecordingClient(conversations: ConvRow[], opts: { ownershipThrows?: boolean } = {}) {
  const inserts: InsertEvent[] = [];
  function makeBuilder(table: string) {
    const filters: Record<string, string> = {};
    // deno-lint-ignore no-explicit-any
    const b: any = {
      select() {
        return b;
      },
      eq(column: string, value: string) {
        filters[column] = value;
        return b;
      },
      maybeSingle() {
        // Ownership lookup on conversations.
        if (opts.ownershipThrows) return Promise.reject(new Error("ownership lookup boom"));
        const match = conversations.find(
          (r) => r.id === filters.id && r.tenant_id === filters.tenant_id && r.user_id === filters.user_id,
        ) ?? null;
        return Promise.resolve({ data: match ? { id: match.id } : null, error: null });
      },
      insert(rows: unknown) {
        inserts.push({ table, rows });
        return b; // supports conversations .insert().select().single() AND direct-await messages insert
      },
      single() {
        return Promise.resolve({ data: { id: NEW_ID }, error: null });
      },
      // makes `await client.from("messages").insert([...])` resolve
      then(resolve: (v: unknown) => void) {
        resolve({ data: null, error: null });
      },
    };
    return b;
  }
  const client = {
    from(table: string) {
      return makeBuilder(table);
    },
  };
  return { client, inserts };
}

function trackParams(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_A,
    userId: USER_A,
    userMessageText: "how do I bleed the pump",
    accumulatedContent: "Check the manual [Source: doc].",
    validationFailed: false,
    hasCitations: true,
    humanReviewRequired: false,
    context: {},
    requestConversationId: null as string | null,
    ...overrides,
  };
}

function messagesEvent(inserts: InsertEvent[]) {
  return inserts.find((e) => e.table === "messages");
}
function conversationsInsert(inserts: InsertEvent[]) {
  // an insert (not the ownership select) targeting conversations
  return inserts.find((e) => e.table === "conversations");
}

Deno.test("trackConversation: owned id → reuses it, no new conversation created", async () => {
  const { client, inserts } = makeRecordingClient(DB);
  await trackConversation(client, trackParams({ requestConversationId: CONV_A }));
  assertEquals(conversationsInsert(inserts), undefined); // no create-new
  const msg = messagesEvent(inserts);
  assertEquals(Array.isArray(msg?.rows), true);
  assertEquals(msg?.rows[0].conversation_id, CONV_A);
  assertEquals(msg?.rows[1].conversation_id, CONV_A);
});

Deno.test("trackConversation: foreign id → no insert targets it; fresh caller-owned conversation created", async () => {
  const { client, inserts } = makeRecordingClient(DB);
  await trackConversation(client, trackParams({ requestConversationId: CONV_B }));
  const msg = messagesEvent(inserts);
  // No message row ever written to the foreign supplied id.
  assertEquals(msg?.rows.some((r: { conversation_id: string }) => r.conversation_id === CONV_B), false);
  // A new conversation was created, owned by the AUTHENTICATED tenant + user.
  const conv = conversationsInsert(inserts);
  assertEquals(conv?.rows.tenant_id, TENANT_A);
  assertEquals(conv?.rows.user_id, USER_A);
  // Both message rows target only the resolved safe (new) id.
  assertEquals(msg?.rows[0].conversation_id, NEW_ID);
  assertEquals(msg?.rows[1].conversation_id, NEW_ID);
});

Deno.test("trackConversation: malformed id → same safe fallback (new conversation, no foreign write)", async () => {
  const { client, inserts } = makeRecordingClient(DB);
  await trackConversation(client, trackParams({ requestConversationId: "not-a-uuid" }));
  const msg = messagesEvent(inserts);
  assertEquals(msg?.rows.some((r: { conversation_id: string }) => r.conversation_id === "not-a-uuid"), false);
  assertEquals(conversationsInsert(inserts) !== undefined, true);
  assertEquals(msg?.rows[0].conversation_id, NEW_ID);
});

Deno.test("trackConversation: missing id → existing new-conversation behavior unchanged", async () => {
  const { client, inserts } = makeRecordingClient(DB);
  await trackConversation(client, trackParams({ requestConversationId: null }));
  assertEquals(conversationsInsert(inserts) !== undefined, true);
  const msg = messagesEvent(inserts);
  assertEquals(msg?.rows[0].conversation_id, NEW_ID);
  assertEquals(msg?.rows[1].conversation_id, NEW_ID);
});

Deno.test("trackConversation: ownership lookup error → no write to supplied id (fail closed)", async () => {
  const { client, inserts } = makeRecordingClient(DB, { ownershipThrows: true });
  await trackConversation(client, trackParams({ requestConversationId: CONV_A }));
  const msg = messagesEvent(inserts);
  // Even a real owned-looking id must not be written to when the check errored.
  assertEquals(msg?.rows.some((r: { conversation_id: string }) => r.conversation_id === CONV_A), false);
  assertEquals(conversationsInsert(inserts) !== undefined, true);
  assertEquals(msg?.rows[0].conversation_id, NEW_ID);
  assertEquals(msg?.rows[1].conversation_id, NEW_ID);
});
