/**
 * HTTP + polling helpers for the authorization regression spec (PR-TEST-3).
 *
 * All calls run in the Playwright NODE context (spec body), never in a browser
 * page. The service-role key is used ONLY here and in authz-fixtures.ts for
 * out-of-band inspection/seeding — it must never be handed to a `page`, a
 * `route`, a screenshot, or any browser-visible surface.
 */

import { getAdminClient } from './supabase-admin';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env.test`);
  return v;
}

const supabaseUrl = () => env('VITE_SUPABASE_URL');
const anonKey = () => env('VITE_SUPABASE_PUBLISHABLE_KEY');
const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY');

/** Sign a user in via the GoTrue password grant and return an access_token (JWT). */
export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`signIn failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export interface FnResponse {
  status: number;
  body: string;
  json: Record<string, unknown> | undefined;
  headers: Headers;
}

/**
 * Invoke an edge function over HTTP.
 * - `bearer`: explicit Authorization bearer value (a user JWT, the anon key, a
 *   garbage string, …). Omit for no Authorization header.
 * - `serviceRole: true`: use the service-role key as the bearer. NODE-ONLY — this
 *   is the "trusted internal caller"; never reachable from browser code.
 * The `apikey` header is always the publishable/anon key, mirroring how the
 * frontend and the existing AI specs call functions.
 */
export async function invokeFunction(
  name: string,
  opts: { bearer?: string; serviceRole?: boolean; body?: unknown; method?: string } = {},
): Promise<FnResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey(),
  };
  const bearer = opts.serviceRole ? serviceKey() : opts.bearer;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const res = await fetch(`${supabaseUrl()}/functions/v1/${name}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const body = await res.text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(body) as Record<string, unknown>;
  } catch {
    json = undefined;
  }
  return { status: res.status, body, json, headers: res.headers };
}

/**
 * Bounded eventually-assert with exponential backoff (500ms → 4000ms cap). Returns
 * the first truthy value `fn` yields; throws after `timeoutMs`. Mirrors the
 * existing waitForAuditLog backoff — NEVER a fixed sleep.
 */
export async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  opts: { timeoutMs?: number; label?: string } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const start = Date.now();
  let delay = 500;
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 4000);
  }
  throw new Error(`pollUntil timed out after ${timeoutMs}ms${opts.label ? `: ${opts.label}` : ''}`);
}

/** Service-role row count for a table filtered by an equality match. */
export async function adminCount(
  table: string,
  match: Record<string, unknown>,
): Promise<number> {
  const client = getAdminClient();
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .match(match);
  if (error) throw new Error(`adminCount ${table}: ${error.message}`);
  return count ?? 0;
}

/** Service-role select of rows for a table filtered by an equality match. */
export async function adminSelect(
  table: string,
  columns: string,
  match: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const client = getAdminClient();
  const { data, error } = await client.from(table).select(columns).match(match);
  if (error) throw new Error(`adminSelect ${table}: ${error.message}`);
  return (data as Record<string, unknown>[]) ?? [];
}
