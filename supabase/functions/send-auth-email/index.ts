import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType = 'signup' | 'recovery' | 'email_change' | 'magiclink';

interface AuthEmailRequest {
  email: string;
  type: EmailType;
  redirect_to?: string;
  user?: {
    email: string;
    user_metadata?: {
      full_name?: string;
    };
  };
}

const premiumWrapper = (content: string, subtitle: string) => `
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
            <td style="background: linear-gradient(135deg, #1F1B18 0%, #292524 100%); padding: 40px 40px 36px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                <span style="color: #ffffff;">Field</span><span style="color: #F97316;">Tek</span>
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.7); font-size: 14px; letter-spacing: 0.5px;">${subtitle}</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #a1a1aa;">
                <span style="color: #1F1B18; font-weight: 600;">Field</span><span style="color: #F97316; font-weight: 600;">Tek</span> · Field Service Management
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

const getEmailContent = (
  type: EmailType,
  email: string,
  confirmationUrl: string,
  userName?: string
): { subject: string; html: string } => {
  const firstName = userName?.split(' ')[0] || 'there';

  switch (type) {
    case 'signup':
      return {
        subject: 'Verify your FieldTek account',
        html: premiumWrapper(`
          <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a2e; font-weight: 700;">Verify your email address</h2>
          
          <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 16px 0 24px;">
            Hi ${firstName}, thanks for signing up for FieldTek! Click the button below to verify your email and activate your account.
          </p>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 8px 0 28px;">
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                  Verify Email Address
                </a>
              </td>
            </tr>
          </table>

          <p style="font-size: 13px; color: #a1a1aa; margin: 0 0 8px;">If the button doesn't work, copy this link:</p>
          <p style="font-size: 12px; color: #71717a; word-break: break-all; background: #FAFAFA; padding: 12px 16px; border-radius: 8px; margin: 0 0 20px;">
            ${confirmationUrl}
          </p>

          <p style="font-size: 12px; color: #a1a1aa; text-align: center; margin: 0;">
            If you didn't create an account with FieldTek, you can safely ignore this email.
          </p>
        `, 'Account Verification'),
      };

    case 'recovery':
      return {
        subject: 'Reset your FieldTek password',
        html: premiumWrapper(`
          <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a2e; font-weight: 700;">Reset your password</h2>
          
          <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 16px 0 24px;">
            We received a request to reset the password for your FieldTek account. Click the button below to choose a new password.
          </p>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 8px 0 28px;">
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                  Reset Password
                </a>
              </td>
            </tr>
          </table>

          <!-- Security Tip -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
            <tr>
              <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-left: 4px solid #F97316; padding: 16px 20px; border-radius: 0 12px 12px 0;">
                <p style="margin: 0; font-size: 13px; color: #9A3412;">
                  <strong>Security tip:</strong> This link expires in 1 hour. If you didn't request a password reset, please ignore this email.
                </p>
              </td>
            </tr>
          </table>
        `, 'Password Reset'),
      };

    default:
      return {
        subject: 'FieldTek Account Notification',
        html: premiumWrapper(`
          <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 0 0 24px;">Click the button below to continue:</p>
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 8px 0 28px;">
                <a href="${confirmationUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                  Continue
                </a>
              </td>
            </tr>
          </table>
        `, 'Account Notification'),
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log('[send-auth-email] Function invoked');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: AuthEmailRequest = await req.json();
    console.log('[send-auth-email] Request received:', {
      email: body.email,
      type: body.type,
      hasRedirectTo: !!body.redirect_to,
    });

    const { email, type, redirect_to, user } = body;

    if (!email || !type) {
      console.error('[send-auth-email] Missing required fields');
      return new Response(
        JSON.stringify({ error: "Email and type are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const redirectUrl = redirect_to || 'https://fieldtek.ai/dashboard';
    
    console.log('[send-auth-email] Generating link for:', email, 'type:', type);
    
    let linkType: 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change_new' | 'email_change_current' = 'magiclink';
    
    if (type === 'recovery') {
      linkType = 'recovery';
    } else if (type === 'signup') {
      linkType = 'magiclink';
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: linkType,
      email,
      options: { redirectTo: redirectUrl },
    });

    if (linkError) {
      console.error('[send-auth-email] Error generating link:', linkError);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const confirmationUrl = linkData.properties?.action_link || '';
    
    if (!confirmationUrl) {
      console.error('[send-auth-email] No action link generated');
      return new Response(
        JSON.stringify({ error: "Failed to generate verification link" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('[send-auth-email] Generated confirmation URL successfully');

    const userName = user?.user_metadata?.full_name;
    const { subject, html } = getEmailContent(type, email, confirmationUrl, userName);

    console.log('[send-auth-email] Sending email via Resend...');
    
    const emailResponse = await resend.emails.send({
      from: "FieldTek <info@fieldtek.ai>",
      to: [email],
      subject,
      html,
    });

    console.log('[send-auth-email] Resend response:', emailResponse);

    if (emailResponse.error) {
      console.error('[send-auth-email] Resend error:', emailResponse.error);
      return new Response(
        JSON.stringify({ error: emailResponse.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('[send-auth-email] Email sent successfully, id:', emailResponse.id);
    return new Response(
      JSON.stringify({ success: true, id: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('[send-auth-email] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
