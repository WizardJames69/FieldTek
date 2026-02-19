import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string, fromName: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <info@fieldtek.ai>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvitationRequest {
  email: string;
  role: string;
  tenantId?: string;
  resend?: boolean;
  invitationId?: string;
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, role, tenantId, resend: isResend, invitationId }: InvitationRequest = await req.json();

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let effectiveTenantId = tenantId;
    let effectiveEmail = email;
    let effectiveRole = role;

    if (isResend && invitationId) {
      const { data: existingInv, error: invError } = await supabaseAdmin
        .from("team_invitations")
        .select("tenant_id, email, role")
        .eq("id", invitationId)
        .single();

      if (invError || !existingInv) {
        throw new Error("Invitation not found");
      }

      effectiveTenantId = existingInv.tenant_id;
      effectiveEmail = existingInv.email;
      effectiveRole = existingInv.role;
    }

    if (!effectiveEmail || !effectiveRole || !effectiveTenantId) {
      throw new Error("Missing required fields: email, role, tenantId");
    }

    // Verify user has permission to invite
    const { data: tenantUser, error: permError } = await supabaseAdmin
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", effectiveTenantId)
      .eq("is_active", true)
      .single();

    if (permError || !tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      throw new Error("You do not have permission to invite team members");
    }

    // Get tenant details + branding
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", effectiveTenantId)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    const { data: branding } = await supabaseAdmin
      .from("tenant_branding")
      .select("company_name, primary_color, logo_url")
      .eq("tenant_id", effectiveTenantId)
      .single();

    const companyName = branding?.company_name || tenant.name;
    const primaryColor = branding?.primary_color || "#1F1B18";
    const logoUrl = branding?.logo_url;

    // Get inviter's profile
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .single();

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "A team member";

    // Generate secure token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (isResend && invitationId) {
      const { error: updateError } = await supabaseAdmin
        .from("team_invitations")
        .update({
          token: token,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error("Failed to update invitation");
      }
    } else {
      const { data: existingInvite } = await supabaseAdmin
        .from("team_invitations")
        .select("id")
        .eq("tenant_id", effectiveTenantId)
        .eq("email", effectiveEmail.toLowerCase())
        .is("accepted_at", null)
        .single();

      if (existingInvite) {
        await supabaseAdmin
          .from("team_invitations")
          .delete()
          .eq("id", existingInvite.id);
      }

      const { error: insertError } = await supabaseAdmin
        .from("team_invitations")
        .insert({
          tenant_id: effectiveTenantId,
          email: effectiveEmail.toLowerCase(),
          role: effectiveRole,
          token: token,
          invited_by: user.id,
          expires_at: expiresAt,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Failed to create invitation");
      }
    }

    const inviteUrl = `https://fieldtek.ai/accept-invite?token=${token}`;

    const roleLabels: Record<string, string> = {
      admin: "Administrator",
      dispatcher: "Dispatcher",
      technician: "Technician",
      client: "Client",
    };

    const headerBg = primaryColor;
    const logoSection = logoUrl
      ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 48px; max-width: 200px;" />`
      : `<h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>`;

    const emailHtml = `
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
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; letter-spacing: 0.5px;">Team Invitation</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a2e; font-weight: 700;">You're Invited!</h2>
              
              <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 16px 0 24px;">
                <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> as a <strong>${roleLabels[effectiveRole] || effectiveRole}</strong>.
              </p>

              <!-- Role Highlight Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-left: 4px solid #F97316; padding: 20px 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #9A3412;">Your Role: ${roleLabels[effectiveRole] || effectiveRole}</p>
                    <p style="margin: 0; font-size: 13px; color: #78350F; line-height: 1.6;">
                      Accept this invitation to get started with ${companyName}'s field service platform. You'll be able to access the dashboard, manage jobs, and collaborate with your team.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 32px;">
                    <a href="${inviteUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #a1a1aa; line-height: 1.6; margin: 0; text-align: center;">
                This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
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
    `;

    const emailResponse = await sendEmail(
      effectiveEmail,
      `You're invited to join ${companyName} on FieldTek`,
      emailHtml,
      companyName
    );

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Invitation sent to ${effectiveEmail}` 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-team-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
