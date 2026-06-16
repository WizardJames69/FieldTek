/**
 * Direct API client for the field-assistant Edge Function.
 * Authenticates via Supabase Auth REST API, parses SSE streams.
 * Used by API-level E2E tests (assistant-pipeline, ai-security, etc.).
 */

export interface ChatResponse {
  status: number;
  body: string;
  headers: Headers;
  streamedContent: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Asserts at the contract level that the pipeline returned a real
 * assistant response, regardless of transport.
 *
 * field-assistant answers either as an SSE stream (Content-Type
 * text/event-stream, accumulated into `streamedContent`) OR as a
 * structured JSON 200 — e.g. the grounded-retrieval abstain gate
 * (`{ response, abstained: true, abstainReason }`) or a compliance block
 * (`{ compliance_blocked: true }`). The SSE parser leaves `streamedContent`
 * empty for those JSON shapes, so SSE-only assertions misread a valid
 * abstain/blocked answer as "no content". Returns false for an empty body
 * so a genuine empty-200 regression is still caught.
 */
export function hasAssistantContent(res: ChatResponse): boolean {
  if (res.streamedContent.length > 0) return true;
  try {
    const json = JSON.parse(res.body) as Record<string, unknown>;
    return Boolean(
      (typeof json.response === 'string' && json.response.length > 0) ||
        json.abstained === true ||
        typeof json.abstainReason === 'string' ||
        json.compliance_blocked === true,
    );
  } catch {
    return false;
  }
}

export interface ParsedFieldAssistantSSE {
  streamedContent: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Parse a field-assistant SSE response body into accumulated assistant content +
 * the metadata event. CONTENT-PRESERVING by design — the first live eval baseline
 * surfaced corrupted answers (mangled `[Source:]` markers, dropped tokens/spaces,
 * `24ACC636` → `24636`), so this parser must never lose or alter payload bytes:
 *  - splits on SSE event boundaries (a blank line), then collects the `data:`
 *    field line(s) within each event (SSE allows several, joined with "\n");
 *  - strips ONLY the single optional leading space after `data:` (per the SSE
 *    spec) — it never `.trim()`s the payload, so spaces, numbers, `°F`, and
 *    `[Source:]` survive exactly;
 *  - tolerates CRLF framing, `[DONE]`, and non-`data:` lines (event:/id:/comment).
 * Used by AIAPIClient.sendChatMessage (below) AND exported so the eval runner's
 * stream fidelity is unit-testable offline — see src/test/evals/streamFidelity.test.ts.
 */
export function parseFieldAssistantSSE(body: string): ParsedFieldAssistantSSE {
  let streamedContent = '';
  let metadata: Record<string, unknown> | undefined;
  let correlationId: string | undefined;
  if (typeof body !== 'string' || body.length === 0) {
    return { streamedContent, metadata, correlationId };
  }

  for (const event of body.split(/\r?\n\r?\n/)) {
    const dataLines: string[] = [];
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue; // ignore event:/id:/comment lines
      let value = line.slice(5);
      if (value.startsWith(' ')) value = value.slice(1); // strip ONE optional space only
      dataLines.push(value);
    }
    if (dataLines.length === 0) continue;
    const payload = dataLines.join('\n');
    if (payload === '[DONE]') break;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      continue; // a non-JSON data line is skipped, never throws
    }

    if (parsed.metadata && typeof parsed.metadata === 'object') {
      metadata = parsed.metadata as Record<string, unknown>;
      const cid = metadata.correlation_id;
      if (typeof cid === 'string') correlationId = cid;
      continue;
    }
    const delta = (parsed as { choices?: Array<{ delta?: { content?: unknown } }> })
      .choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) streamedContent += delta;
  }

  return { streamedContent, metadata, correlationId };
}

export class AIAPIClient {
  constructor(
    private supabaseUrl: string,
    private supabaseAnonKey: string,
  ) {}

  /** Authenticate via Supabase REST API and return an access_token */
  async getAuthToken(email: string, password: string): Promise<string> {
    const res = await fetch(
      `${this.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseAnonKey,
        },
        body: JSON.stringify({ email, password }),
      },
    );
    if (!res.ok) {
      throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    return data.access_token;
  }

  /** Send a chat message and parse the SSE stream */
  async sendChatMessage(params: {
    messages: Array<{
      role: string;
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
    context?: Record<string, unknown>;
    authToken: string;
  }): Promise<ChatResponse> {
    const res = await fetch(`${this.supabaseUrl}/functions/v1/field-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.authToken}`,
        apikey: this.supabaseAnonKey,
      },
      body: JSON.stringify({
        messages: params.messages,
        context: params.context,
      }),
    });

    const responseHeaders = res.headers;
    const body = await res.text();

    // Parse SSE if content-type is text/event-stream. Delegate to the shared,
    // content-preserving parser (unit-tested in src/test/evals/streamFidelity.test.ts)
    // so the eval runner and these E2E helpers share one stream-fidelity contract.
    let streamedContent = '';
    let metadata: Record<string, unknown> | undefined;
    let correlationId: string | undefined;

    const contentType = responseHeaders.get('content-type') || '';
    if (contentType.includes('text/event-stream') && res.ok) {
      const parsed = parseFieldAssistantSSE(body);
      streamedContent = parsed.streamedContent;
      metadata = parsed.metadata;
      correlationId = parsed.correlationId;
    }

    return {
      status: res.status,
      body,
      headers: responseHeaders,
      streamedContent,
      metadata,
      correlationId,
    };
  }

  /** Low-level fetch for error path tests (no stream parsing) */
  async sendRawRequest(
    requestBody: unknown,
    authToken?: string,
  ): Promise<{ status: number; body: string; headers: Headers }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: this.supabaseAnonKey,
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await fetch(`${this.supabaseUrl}/functions/v1/field-assistant`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    return {
      status: res.status,
      body: await res.text(),
      headers: res.headers,
    };
  }
}

/** Create an AIAPIClient from environment variables */
export function createAIClient(): AIAPIClient {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.test');
  }
  return new AIAPIClient(url, key);
}
