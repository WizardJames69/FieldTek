import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _adminClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client that uses the service role key.
 * This bypasses RLS and is only used in Node.js scripts (global-setup, global-teardown).
 * NEVER expose the service role key to the browser.
 */
export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.test. ' +
        'See .env.test for setup instructions.'
    );
  }

  _adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _adminClient;
}
