import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 10;

async function checkRateLimit(supabase: any, identifier: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("identifier", identifier)
    .eq("identifier_type", "validate_access_code")
    .gte("window_start", windowStart)
    .single();

  if (error && error.code !== "PGRST116") return true; // allow on error

  if (!data) {
    await supabase.from("rate_limits").insert({
      identifier, identifier_type: "validate_access_code",
      request_count: 1, window_start: new Date().toISOString(),
    });
    return true;
  }

  if (data.request_count >= MAX_REQUESTS_PER_WINDOW) return false;

  await supabase.from("rate_limits")
    .update({ request_count: data.request_count + 1 })
    .eq("id", data.id);
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit by IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const allowed = await checkRateLimit(supabase, clientIp);
    if (!allowed) {
      console.log('[validate-access-code] Rate limit exceeded for IP:', clientIp);
      return new Response(
        JSON.stringify({ valid: false, error: 'Too many attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { code } = await req.json();
    
    if (!code || typeof code !== 'string') {
      console.log('[validate-access-code] Missing or invalid code');
      return new Response(
        JSON.stringify({ valid: false, error: 'Access code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const inputCode = code.toLowerCase().trim();

    // Get valid codes from environment variable
    const validCodesEnv = Deno.env.get('BETA_ACCESS_CODES') || '';
    const envCodes = validCodesEnv.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
    
    console.log('[validate-access-code] Found', envCodes.length, 'codes from env var');

    // ALSO check approved promo codes from the database
    const { data: approvedApplications, error: dbError } = await supabase
      .from('beta_applications')
      .select('promo_code')
      .eq('status', 'approved')
      .not('promo_code', 'is', null);

    if (dbError) {
      console.error('[validate-access-code] Database error:', dbError);
      // Continue with env codes only if database fails
    }

    const dbCodes = approvedApplications?.map(a => a.promo_code?.toLowerCase()).filter(Boolean) || [];
    console.log('[validate-access-code] Found', dbCodes.length, 'approved codes from database');

    // Combine all valid codes (deduplicated)
    const allValidCodes = [...new Set([...envCodes, ...dbCodes])];
    console.log('[validate-access-code] Total valid codes:', allValidCodes.length);
    
    const isValid = allValidCodes.includes(inputCode);
    const isBetaCode = dbCodes.includes(inputCode);
    
    console.log('[validate-access-code] Code valid:', isValid, 'Is beta code:', isBetaCode);
    
    return new Response(
      JSON.stringify({ valid: isValid, is_beta_code: isBetaCode }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[validate-access-code] Error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
