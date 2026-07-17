// ============================================================
// send-beta-approval — platform-admin-only beta approval email (PR-SEC-6 / Gap 2)
// ============================================================
// Thin wiring only. ALL request handling, authentication, and platform-admin
// authorization live in ./authz.ts (side-effect-free, unit-tested). This file
// just constructs the real service-role-backed dependencies and serves the
// handler, so importing authz.ts in tests never starts a server.
//
// Authorization is enforced in handleBetaApproval: OPTIONS → verify JWT →
// platform_admins lookup → only then any Resend send or beta_applications write.
// The function inherits verify_jwt=true (see supabase/config.toml — the
// verify_jwt=false override was removed in PR-SEC-6), so the gateway also rejects
// unauthenticated calls.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BetaApprovalDeps,
  BetaApprovalRequest,
  emailSinkActive,
  handleBetaApproval,
  lookupPlatformAdmin,
} from "./authz.ts";

function buildApprovalEmailHtml(companyName: string, promoCode: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      .ft-body { background-color: #09090b !important; }
      .ft-header { background-color: #18181b !important; border-bottom-color: #27272a !important; }
      .ft-mark-field { color: #fafafa !important; }
      .ft-header-sub { color: #a1a1aa !important; }
      .ft-card { background-color: #18181b !important; box-shadow: none !important; }
      .ft-heading { color: #fafafa !important; }
      .ft-text { color: #e4e4e7 !important; }
      .ft-footer { color: #a1a1aa !important; }
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
            <td class="ft-header" style="background-color: #ffffff; padding: 32px 40px 24px; text-align: center; border-radius: 16px 16px 0 0; border-bottom: 1px solid #ececee;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                <span class="ft-mark-field" style="color: #18181b;">Field</span><span style="color: #F97316;">Tek</span>
              </h1>
              <p class="ft-header-sub" style="margin: 8px 0 0; color: #71717a; font-size: 13px; letter-spacing: 0.5px;">Beta access approved</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td class="ft-card" style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <p class="ft-heading" style="font-size: 18px; color: #18181b; margin: 0 0 16px;">
                Hi <strong>${companyName}</strong> team,
              </p>

              <p class="ft-text" style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin: 0 0 24px;">
                Your FieldTek beta access is approved. Copy your access code below and create your account to get started.
              </p>

              <!-- Beta access code (light "island" — stays readable in light & dark clients) -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 12px;">
                <tr>
                  <td style="background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 22px 24px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0 0 12px; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Your beta access code</p>
                    <div style="font-family: 'SF Mono', 'Menlo', 'Consolas', monospace; font-size: 22px; font-weight: 700; color: #18181b; letter-spacing: 1px; white-space: nowrap;">${promoCode}</div>
                  </td>
                </tr>
              </table>

              <p class="ft-text" style="font-size: 13px; color: #71717a; text-align: center; margin: 0 0 28px;">
                Copy this code and paste it on the registration page.
              </p>

              <!-- Steps -->
              <h3 class="ft-heading" style="font-size: 16px; color: #18181b; margin: 0 0 16px; font-weight: 700;">Getting started</h3>

              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #3f3f46;"><strong style="color: #F97316;">1.</strong> <a href="https://fieldtek.ai/register" style="color: #18181b; text-decoration: underline; font-weight: 600;">Create your account</a> and enter your access code.</p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #3f3f46;"><strong style="color: #F97316;">2.</strong> Set up your company and invite your team.</p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #f4f4f5; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #3f3f46;"><strong style="color: #F97316;">3.</strong> Add your first client and job to see FieldTek in action.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="https://fieldtek.ai/register"
                       style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">
                      Create your account
                    </a>
                  </td>
                </tr>
              </table>

              <p class="ft-text" style="font-size: 14px; color: #3f3f46; line-height: 1.6; margin: 0;">
                If you have any questions, just reply to this email.
              </p>

              <p class="ft-text" style="font-size: 14px; color: #3f3f46; margin: 16px 0 0;">
                Best regards,<br><strong>The FieldTek Team</strong>
              </p>
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
}

function makeDeps(): BetaApprovalDeps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Service-role client: used to VERIFY the caller's token (getUser) and to look
  // up platform_admins. auth.getUser(token) authenticates the passed token; the
  // service key never authorizes the caller by itself.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  return {
    async getUserId(token) {
      try {
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data?.user) return null;
        return data.user.id;
      } catch {
        return null;
      }
    },
    isPlatformAdmin: (userId) => lookupPlatformAdmin(admin, userId),
    async sendApprovalEmail({ email, companyName, promoCode }: BetaApprovalRequest) {
      // PR-TEST-3 deterministic email seam. When BETA_APPROVAL_EMAIL_SINK=1 is set
      // ONLY in the isolated E2E environment, the branded email is NOT delivered to
      // Resend; the caller still reaches this operation and recordEmailResult still
      // stamps the (disposable) beta_applications row, so the authorized allow-path
      // is provable without sending real mail. FAIL-SAFE: the variable is unset in
      // production, so real delivery is the default; authentication and authorization
      // are enforced identically and are not touched by this seam.
      if (emailSinkActive(Deno.env)) {
        console.log("Email sink active (E2E only): skipping Resend delivery");
        return { ok: true, status: 200, messageId: "e2e-sink" };
      }
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY is not configured");
        return { ok: false, status: 500, error: "Email service not configured" };
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "FieldTek <info@fieldtek.ai>",
          to: [email],
          subject: "Welcome to FieldTek Beta — You're In",
          html: buildApprovalEmailHtml(companyName, promoCode),
        }),
      });
      const text = await res.text();
      // Log the provider status only — never request-controlled recipient/code.
      console.log(`Resend API response status: ${res.status}`);
      if (!res.ok) {
        console.error("Resend API error status:", res.status);
        return { ok: false, status: res.status, error: text };
      }
      let messageId: string | undefined;
      try {
        messageId = JSON.parse(text)?.id;
      } catch {
        // non-JSON success body — ignore, messageId stays undefined
      }
      return { ok: true, status: res.status, messageId };
    },
    async recordEmailResult(applicationId, result) {
      const update: Record<string, unknown> = {};
      if (result.sentAt !== undefined) update.email_sent_at = result.sentAt;
      if (result.error !== undefined) update.email_error = result.error;
      await admin.from("beta_applications").update(update).eq("id", applicationId);
    },
  };
}

serve((req) => handleBetaApproval(req, makeDeps()));
