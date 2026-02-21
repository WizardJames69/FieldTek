import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, getClientIp } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const clientIp = getClientIp(req);
    const { allowed } = await checkRateLimit(supabase, {
      identifierType: 'validate_access_code',
      identifier: clientIp,
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
    });
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
