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

    // Parse SSE if content-type is text/event-stream
    let streamedContent = '';
    let metadata: Record<string, unknown> | undefined;
    let correlationId: string | undefined;

    const contentType = responseHeaders.get('content-type') || '';
    if (contentType.includes('text/event-stream') && res.ok) {
      const lines = body.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;

        try {
          const parsed = JSON.parse(payload);

          // Metadata event
          if (parsed.metadata) {
            metadata = parsed.metadata;
            correlationId = parsed.metadata.correlation_id;
            continue;
          }

          // Text chunk event
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            streamedContent += delta;
          }
        } catch {
          // Non-JSON line, skip
        }
      }
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
