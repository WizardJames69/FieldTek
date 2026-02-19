import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-CAMPAIGN] ${step}${detailsStr}`);
};

interface CampaignRequest {
  subject: string;
  content: string;
  targetAudience: {
    type: "all" | "tier" | "industry";
    value?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { data: adminData, error: adminError } = await supabaseClient
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (adminError || !adminData) {
      throw new Error("Access denied: Platform admin privileges required");
    }
    logStep("Admin verified", { userId: user.id });

    const { subject, content, targetAudience }: CampaignRequest = await req.json();

    if (!subject || !content) {
      throw new Error("Subject and content are required");
    }

    // Build query for target tenants
    let tenantsQuery = supabaseClient.from("tenants").select("id, name, email, owner_id");

    if (targetAudience.type === "tier" && targetAudience.value) {
      tenantsQuery = tenantsQuery.eq("subscription_tier", targetAudience.value);
    } else if (targetAudience.type === "industry" && targetAudience.value) {
      tenantsQuery = tenantsQuery.eq("industry", targetAudience.value);
    }

    const { data: tenants, error: tenantsError } = await tenantsQuery;
    if (tenantsError) throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);

    logStep("Found target tenants", { count: tenants?.length });

    // Get owner emails for each tenant
    const ownerIds = tenants?.map(t => t.owner_id).filter(Boolean) || [];
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", ownerIds);

    const emailMap = new Map(profiles?.map(p => [p.user_id, { email: p.email, name: p.full_name }]) || []);

    // Collect all recipient emails
    const recipients: { email: string; name: string; tenantName: string }[] = [];
    for (const tenant of tenants || []) {
      // Use tenant email if available, otherwise owner's profile email
      let email = tenant.email;
      let name = tenant.name;

      if (!email && tenant.owner_id) {
        const ownerInfo = emailMap.get(tenant.owner_id);
        if (ownerInfo?.email) {
          email = ownerInfo.email;
          name = ownerInfo.name || tenant.name;
        }
      }

      if (email) {
        recipients.push({ email, name, tenantName: tenant.name });
      }
    }

    logStep("Collected recipients", { count: recipients.length });

    if (recipients.length === 0) {
      throw new Error("No valid email recipients found for the selected audience");
    }

    // Save campaign to database
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("email_campaigns")
      .insert({
        subject,
        content,
        target_audience: targetAudience,
        status: "sending",
        sent_by: user.id,
        recipient_count: recipients.length,
      })
      .select()
      .single();

    if (campaignError) throw new Error(`Failed to save campaign: ${campaignError.message}`);
    logStep("Campaign saved", { campaignId: campaign.id });

    // Send emails via Resend
    const resend = new Resend(resendKey);
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        await resend.emails.send({
          from: "FieldTek <info@fieldtek.ai>",
          to: [recipient.email],
          subject: subject,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">FieldTek</h1>
              </div>
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin-top: 0;">Hi ${recipient.name || "there"},</p>
                <div style="margin: 20px 0;">
                  ${content.replace(/\n/g, "<br>")}
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                  This email was sent to you as a FieldTek customer.<br>
                  If you have any questions, please contact us at <a href="mailto:info@fieldtek.ai" style="color: #f97316;">info@fieldtek.ai</a>
                </p>
              </div>
            </body>
            </html>
          `,
        });
        successCount++;
      } catch (emailError) {
        console.error(`Failed to send to ${recipient.email}:`, emailError);
        failCount++;
      }
    }

    logStep("Emails sent", { success: successCount, failed: failCount });

    // Update campaign status
    await supabaseClient
      .from("email_campaigns")
      .update({
        status: failCount === 0 ? "sent" : "partial",
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: campaign.id,
        recipientCount: recipients.length,
        successCount,
        failCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
