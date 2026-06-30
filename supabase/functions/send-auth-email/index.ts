import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveSafeRedirect,
  parseAllowedHosts,
  DEFAULT_SAFE_REDIRECT,
} from "../_shared/redirectAllowlist.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType = 'signup' | 'recovery' | 'email_change' | 'magiclink';

// Legacy shape: invoked directly from the frontend (VerifyEmail resend, ForgotPassword).
interface DirectEmailRequest {
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

// Supabase "Send Email" auth-hook shape. When configured in the dashboard, Supabase
// calls THIS function instead of sending its own built-in (Supabase-branded) email,
// so the user only ever sees the FieldTek-branded message. See the PR's dashboard notes.
interface AuthHookRequest {
  user: {
    email: string;
    user_metadata?: { full_name?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: string; // 'signup' | 'recovery' | 'magiclink' | 'invite' | 'email_change' | ...
    site_url?: string;
  };
}

// Mask an email for logs so we never print full PII (and never anything token-like).
const maskEmail = (email: string): string => {
  const [local, domain] = String(email).split("@");
  if (!domain) return "***";
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
};

const allowedHosts = parseAllowedHosts(Deno.env.get("AUTH_REDIRECT_ALLOWED_HOSTS"));
const safeFallback = Deno.env.get("AUTH_REDIRECT_FALLBACK") || DEFAULT_SAFE_REDIRECT;
const toSafeRedirect = (value?: string) =>
  resolveSafeRedirect(value, { allowedHosts, fallback: safeFallback });

const premiumWrapper = (content: string, subtitle: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      .ft-body { background-color: #09090b !important; }
      .ft-card { background-color: #18181b !important; box-shadow: none !important; }
      .ft-heading { color: #fafafa !important; }
      .ft-text { color: #e4e4e7 !important; }
      .ft-muted { color: #a1a1aa !important; }
      .ft-linkbox { background-color: #27272a !important; color: #e4e4e7 !important; }
      .ft-footer { color: #71717a !important; }
    }
  </style>
</head>
<body class="ft-body" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
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
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; letter-spacing: 0.5px;">${subtitle}</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td class="ft-card" style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p class="ft-footer" style="margin: 0 0 4px; font-size: 11px; color: #71717a;">
                <span style="color: #F97316; font-weight: 600;">FieldTek</span> · Field Service Management
              </p>
              <p class="ft-footer" style="margin: 0; font-size: 11px; color: #a1a1aa;">
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

const ctaButton = (url: string, label: string) => `
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 8px 0 28px;">
        <a href="${url}"
           style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
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
          <h2 class="ft-heading" style="margin: 0 0 8px; font-size: 22px; color: #18181b; font-weight: 700;">Verify your email address</h2>

          <p class="ft-text" style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin: 16px 0 24px;">
            Hi ${firstName}, thanks for signing up for FieldTek. Confirm your email address to activate your account — you'll be signed in automatically.
          </p>

          ${ctaButton(confirmationUrl, 'Verify Email Address')}

          <p class="ft-muted" style="font-size: 13px; color: #71717a; margin: 0 0 8px;">If the button doesn't work, copy this link into your browser:</p>
          <p class="ft-linkbox" style="font-size: 12px; color: #52525b; word-break: break-all; background-color: #f4f4f5; padding: 12px 16px; border-radius: 8px; margin: 0 0 20px;">
            ${confirmationUrl}
          </p>

          <p class="ft-muted" style="font-size: 12px; color: #71717a; text-align: center; margin: 0;">
            If you didn't create a FieldTek account, you can safely ignore this email.
          </p>
        `, 'Account Verification'),
      };

    case 'recovery':
      return {
        subject: 'Reset your FieldTek password',
        html: premiumWrapper(`
          <h2 class="ft-heading" style="margin: 0 0 8px; font-size: 22px; color: #18181b; font-weight: 700;">Reset your password</h2>

          <p class="ft-text" style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin: 16px 0 24px;">
            We received a request to reset the password for your FieldTek account. Choose a new password using the button below.
          </p>

          ${ctaButton(confirmationUrl, 'Reset Password')}

          <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
            <tr>
              <td class="ft-linkbox" style="background-color: #FFF7ED; border-left: 4px solid #F97316; padding: 16px 20px; border-radius: 0 12px 12px 0;">
                <p style="margin: 0; font-size: 13px; color: #9A3412;">
                  <strong>Security tip:</strong> this link expires in 1 hour. If you didn't request a reset, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        `, 'Password Reset'),
      };

    default:
      return {
        subject: 'Sign in to FieldTek',
        html: premiumWrapper(`
          <h2 class="ft-heading" style="margin: 0 0 8px; font-size: 22px; color: #18181b; font-weight: 700;">Sign in to FieldTek</h2>
          <p class="ft-text" style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin: 16px 0 24px;">Use the button below to continue to your FieldTek account.</p>
          ${ctaButton(confirmationUrl, 'Continue')}
          <p class="ft-muted" style="font-size: 12px; color: #71717a; text-align: center; margin: 0;">
            If you didn't request this, you can safely ignore this email.
          </p>
        `, 'Secure Sign-in'),
      };
  }
};

// Map a Supabase auth-hook action type to our template type.
const templateTypeFor = (actionType: string): EmailType => {
  if (actionType === 'recovery') return 'recovery';
  if (actionType === 'signup') return 'signup';
  return 'magiclink';
};

const handler = async (req: Request): Promise<Response> => {
  console.log('[send-auth-email] Function invoked');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json();

    // ── Mode A: Supabase "Send Email" auth hook ───────────────────────────────
    // Supabase posts { user, email_data }. We build the verify link from the
    // token_hash ourselves and send the FieldTek-branded email. Supabase does NOT
    // send its own email when this hook is configured, so no Supabase-branded
    // "Confirm Your Signup" reaches the user.
    if (raw && raw.email_data && raw.user) {
      const hook = raw as AuthHookRequest;
      const recipient = hook.user.email;
      const actionType = hook.email_data.email_action_type;
      const safeRedirect = toSafeRedirect(hook.email_data.redirect_to);
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

      console.log('[send-auth-email] Auth hook:', {
        email: maskEmail(recipient),
        action: actionType,
      });

      // Canonical Supabase verification endpoint built from the hook's token_hash.
      const confirmationUrl =
        `${supabaseUrl}/auth/v1/verify` +
        `?token=${encodeURIComponent(hook.email_data.token_hash)}` +
        `&type=${encodeURIComponent(actionType)}` +
        `&redirect_to=${encodeURIComponent(safeRedirect)}`;

      const { subject, html } = getEmailContent(
        templateTypeFor(actionType),
        recipient,
        confirmationUrl,
        hook.user.user_metadata?.full_name,
      );

      const emailResponse = await resend.emails.send({
        from: "FieldTek <info@fieldtek.ai>",
        to: [recipient],
        subject,
        html,
      });

      if (emailResponse.error) {
        console.error('[send-auth-email] Resend error (hook):', emailResponse.error);
        return new Response(JSON.stringify({ error: emailResponse.error }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      console.log('[send-auth-email] Hook email sent, id:', emailResponse.id);
      return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ── Mode B: legacy direct frontend invoke (resend / recovery) ─────────────
    const body = raw as DirectEmailRequest;
    console.log('[send-auth-email] Direct invoke:', {
      email: maskEmail(body.email || ''),
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

    // Never trust the caller-supplied origin: normalize to an allowlisted host.
    const redirectUrl = toSafeRedirect(redirect_to);

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
      console.error('[send-auth-email] Error generating link:', linkError.message);
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

    // NOTE: confirmationUrl contains a one-time token — never log it.
    console.log('[send-auth-email] Generated confirmation link (token redacted)');

    const userName = user?.user_metadata?.full_name;
    const { subject, html } = getEmailContent(type, email, confirmationUrl, userName);

    const emailResponse = await resend.emails.send({
      from: "FieldTek <info@fieldtek.ai>",
      to: [email],
      subject,
      html,
    });

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
    console.error('[send-auth-email] Error:', error?.message || 'unknown');
    return new Response(
      JSON.stringify({ error: error?.message || 'unknown error' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
