import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const MAX_DEMOS_PER_IP_PER_DAY = 3;
const SESSION_DURATION_SECONDS = 180; // 3 minutes
const ELEVENLABS_TIMEOUT_MS = 10000; // 10 second timeout for ElevenLabs calls

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID().slice(0, 8);
  console.log(`[demo-token] Request started (requestId=${requestId})`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Lightweight ping endpoint for connectivity checks
  const url = new URL(req.url);
  if (url.searchParams.get("ping") === "1") {
    console.log(`[demo-token] Ping request (requestId=${requestId})`);
    return new Response(
      JSON.stringify({ ok: true, ts: Date.now(), requestId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
      console.error("[demo-token] ElevenLabs configuration missing");
      return new Response(
        JSON.stringify({ error: "ElevenLabs not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     req.headers.get("x-real-ip") ||
                     "unknown";

    // Check IP-based rate limit (3 demos per IP per day)
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const dbStartTime = Date.now();
    const { count: ipDemoCount } = await supabase
      .from("demo_sessions")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIP)
      .gte("started_at", dayStart.toISOString());
    console.log(`[demo-token] DB rate-limit check: ${Date.now() - dbStartTime}ms`);

    if ((ipDemoCount || 0) >= MAX_DEMOS_PER_IP_PER_DAY) {
      return new Response(
        JSON.stringify({
          error: "Daily demo limit reached for this network",
          reason: "ip_limit_exceeded",
          limit: MAX_DEMOS_PER_IP_PER_DAY,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create demo session with IP and max duration
    const sessionInsertStart = Date.now();
    const { data: session, error: sessionError } = await supabase
      .from("demo_sessions")
      .insert({
        user_id: null,
        ip_address: clientIP,
        started_at: new Date().toISOString(),
        max_duration_seconds: SESSION_DURATION_SECONDS,
      })
      .select("id, session_token")
      .single();
    console.log(`[demo-token] DB session insert: ${Date.now() - sessionInsertStart}ms`);

    if (sessionError) {
      console.error("[demo-token] Failed to create demo session:", sessionError);
    }

    // Fetch BOTH ElevenLabs endpoints in parallel with timeouts
    console.log("[demo-token] Starting parallel ElevenLabs requests");
    const elevenLabsStart = Date.now();

    const [tokenResult, signedUrlResult] = await Promise.allSettled([
      // WebRTC conversation token
      fetchWithTimeout(
        `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${ELEVENLABS_AGENT_ID}`,
        {
          headers: { "xi-api-key": ELEVENLABS_API_KEY },
        },
        ELEVENLABS_TIMEOUT_MS
      ).then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Token API error ${res.status}: ${errorText}`);
        }
        return res.json();
      }),

      // WebSocket signed URL
      fetchWithTimeout(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
        {
          headers: { "xi-api-key": ELEVENLABS_API_KEY },
        },
        ELEVENLABS_TIMEOUT_MS
      ).then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`SignedUrl API error ${res.status}: ${errorText}`);
        }
        return res.json();
      }),
    ]);

    console.log(`[demo-token] ElevenLabs parallel fetch: ${Date.now() - elevenLabsStart}ms`);

    // Extract results
    let token: string | null = null;
    let signedUrl: string | null = null;
    const warnings: string[] = [];

    if (tokenResult.status === "fulfilled") {
      token = tokenResult.value?.token ?? null;
      console.log("[demo-token] Token fetch succeeded");
    } else {
      console.error("[demo-token] Token fetch failed:", tokenResult.reason);
      warnings.push(`Token fetch failed: ${tokenResult.reason?.message || "unknown error"}`);
    }

    if (signedUrlResult.status === "fulfilled") {
      signedUrl = signedUrlResult.value?.signed_url ?? null;
      console.log("[demo-token] SignedUrl fetch succeeded");
    } else {
      console.error("[demo-token] SignedUrl fetch failed:", signedUrlResult.reason);
      warnings.push(`SignedUrl fetch failed: ${signedUrlResult.reason?.message || "unknown error"}`);
    }

    // We need at least one to succeed
    if (!token && !signedUrl) {
      console.error("[demo-token] Both ElevenLabs endpoints failed");
      return new Response(
        JSON.stringify({
          error: "Failed to connect to voice service",
          details: warnings.join("; "),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`[demo-token] Total request time: ${totalTime}ms (requestId=${requestId})`);

    return new Response(
      JSON.stringify({
        token,
        signedUrl,
        sessionId: session?.id,
        sessionToken: session?.session_token,
        demoCount: (ipDemoCount || 0) + 1,
        maxDemos: null,
        maxDurationSeconds: SESSION_DURATION_SECONDS,
        warnings: warnings.length > 0 ? warnings : undefined,
        requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[demo-token] Error after ${totalTime}ms (requestId=${requestId}):`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
