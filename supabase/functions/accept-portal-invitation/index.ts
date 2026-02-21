import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Authentication required");
    }
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Authentication required");

    const { token } = await req.json();
    if (!token) throw new Error("token is required");

    // Look up the invitation
    const { data: invitation, error: invError } = await supabaseAdmin
      .from("portal_invitations")
      .select("*")
      .eq("token", token)
      .is("accepted_at", null)
      .single();

    if (invError || !invitation) throw new Error("Invalid or expired invitation");

    // Check expiry
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("This invitation has expired");
    }

    // Verify the authenticated user's email matches the invitation email
    if (user.email?.toLowerCase() !== invitation.email?.toLowerCase()) {
      console.error("Email mismatch:", user.email, "vs invitation:", invitation.email);
      throw new Error("This invitation was sent to a different email address");
    }

    // Link the authenticated user to the clients record (use verified user.id, not request body)
    const { error: updateClientError } = await supabaseAdmin
      .from("clients")
      .update({ user_id: user.id })
      .eq("id", invitation.client_id)
      .eq("tenant_id", invitation.tenant_id);

    if (updateClientError) {
      throw new Error(`Failed to link account: ${updateClientError.message}`);
    }

    // Mark invitation as accepted
    const { error: updateInvError } = await supabaseAdmin
      .from("portal_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    if (updateInvError) {
      console.error("Failed to mark invitation as accepted:", updateInvError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in accept-portal-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});