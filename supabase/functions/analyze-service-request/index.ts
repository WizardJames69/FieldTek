import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalysisResult {
  likely_issues: string[];
  required_skills: string[];
  estimated_time: number; // in minutes
  possible_parts: string[];
  warranty_notes: string;
  urgency_assessment: 'critical' | 'high' | 'medium' | 'low';
  dispatch_notes: string;
  recommended_stage: 'startup' | 'service' | 'maintenance' | 'inspection';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth verification failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { requestId, title, description, request_type, equipment_info, client_info } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Request ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that the authenticated user belongs to the tenant that owns this service request
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: serviceRequest, error: srError } = await supabaseAdmin
      .from("service_requests")
      .select("tenant_id")
      .eq("id", requestId)
      .single();

    if (srError || !serviceRequest) {
      return new Response(
        JSON.stringify({ error: "Service request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to this tenant
    const { data: membership } = await supabaseAdmin
      .from("tenant_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", serviceRequest.tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      console.error("User", user.id, "attempted to analyze service request from tenant", serviceRequest.tenant_id);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing service request:", requestId, "Title:", title);

    const systemPrompt = `You are an expert field service dispatcher AI. Analyze incoming service requests and provide structured recommendations.

Your analysis must return ONLY valid JSON matching this exact structure:
{
  "likely_issues": ["array of potential problems based on the description"],
  "required_skills": ["array of skills/certifications needed"],
  "estimated_time": <number in minutes>,
  "possible_parts": ["array of parts that might be needed"],
  "warranty_notes": "any warranty-related observations or empty string",
  "urgency_assessment": "critical" | "high" | "medium" | "low",
  "dispatch_notes": "brief notes for the dispatcher",
  "recommended_stage": "startup" | "service" | "maintenance" | "inspection"
}

Consider these factors:
- Safety implications (gas leaks, electrical hazards = critical)
- Customer impact (no heat in winter, no AC in summer = high)
- Equipment age and warranty status
- Description keywords indicating severity
- Time of year and weather considerations

Return ONLY the JSON object, no additional text or markdown formatting.`;

    const userPrompt = `Analyze this service request:

Title: ${title || 'Not provided'}
Description: ${description || 'Not provided'}
Request Type: ${request_type || 'General Service'}
${equipment_info ? `Equipment: ${JSON.stringify(equipment_info)}` : ''}
${client_info ? `Client Info: ${JSON.stringify(client_info)}` : ''}

Provide your analysis as a JSON object.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("AI response received:", content.substring(0, 200));

    // Parse the JSON response
    let analysis: AnalysisResult;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Provide a default analysis if parsing fails
      analysis = {
        likely_issues: ["Unable to automatically analyze - manual review required"],
        required_skills: ["General Technician"],
        estimated_time: 60,
        possible_parts: [],
        warranty_notes: "",
        urgency_assessment: "medium",
        dispatch_notes: "AI analysis failed - please review manually",
        recommended_stage: "service"
      };
    }

    // Update the service request with the analysis
    const { error: updateError } = await supabaseClient
      .from('service_requests')
      .update({
        ai_analysis: analysis,
        ai_analyzed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error("Failed to update service request:", updateError);
      // Don't fail the request, just log it
    }

    console.log("Analysis complete for request:", requestId);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
