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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { clientId, tenantId } = await req.json();
    if (!clientId || !tenantId) throw new Error("clientId and tenantId are required");

    // Verify the user is an admin/owner/dispatcher in this tenant
    const { data: tenantUser } = await supabaseAdmin
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!tenantUser || !["owner", "admin", "dispatcher"].includes(tenantUser.role)) {
      throw new Error("Insufficient permissions");
    }

    // Get client details
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, email")
      .eq("id", clientId)
      .eq("tenant_id", tenantId)
      .single();

    if (clientError || !client) throw new Error("Client not found");
    if (!client.email) throw new Error("Client has no email address");

    // Get tenant/company name and branding
    const { data: branding } = await supabaseAdmin
      .from("tenant_branding")
      .select("company_name, primary_color, logo_url")
      .eq("tenant_id", tenantId)
      .single();

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const companyName = branding?.company_name || tenant?.name || "Your Service Provider";
    const primaryColor = branding?.primary_color || "#1F1B18";
    const logoUrl = branding?.logo_url;

    // Generate a secure token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();

    // Insert invitation record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: insertError } = await supabaseAdmin
      .from("portal_invitations")
      .insert({
        client_id: clientId,
        tenant_id: tenantId,
        email: client.email,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) throw new Error(`Failed to create invitation: ${insertError.message}`);

    // Build signup URL
    const appUrl = "https://fieldtek.ai";
    const signupUrl = `${appUrl}/portal/signup?token=${token}`;

    // Derive a lighter accent from primaryColor for highlight boxes
    const headerBg = primaryColor;
    const logoSection = logoUrl
      ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 48px; max-width: 200px;" />`
      : `<h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>`;

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${companyName} <noreply@fieldtek.ai>`,
        to: [client.email],
        subject: `${companyName} — You're Invited to Your Customer Portal`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${headerBg} 0%, ${headerBg}dd 100%); padding: 40px 40px 36px; text-align: center; border-radius: 16px 16px 0 0;">
              ${logoSection}
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; letter-spacing: 0.5px;">Customer Portal Invitation</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <p style="font-size: 18px; color: #1a1a2e; margin: 0 0 8px;">
                Hi <strong>${client.name}</strong>,
              </p>
              
              <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 16px 0 24px;">
                You've been invited to join the <strong>${companyName}</strong> customer portal — your personal hub for managing service requests, tracking jobs, and more.
              </p>

              <!-- Feature Highlight Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-left: 4px solid #F97316; padding: 20px 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #9A3412;">What you can do:</p>
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ Submit service requests anytime</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ Track your jobs in real time</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ View and pay invoices online</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ See your full equipment history</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 32px;">
                    <a href="${signupUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                      Create Your Account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #a1a1aa; line-height: 1.6; margin: 0; text-align: center;">
                This invitation expires in 7 days. If you have questions, contact ${companyName} directly.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #a1a1aa;">
                Powered by <span style="color: #1F1B18; font-weight: 600;">Field</span><span style="color: #F97316; font-weight: 600;">Tek</span>
              </p>
              <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                © ${new Date().getFullYear()} FieldTek. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      }),
    });

    if (!emailRes.ok) {
      const emailError = await emailRes.text();
      console.error("Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Invitation sent to ${client.email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-portal-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
