import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp } from "../_shared/rateLimit.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WaitlistEmailRequest {
  email: string;
  companyName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[send-waitlist-email] Function invoked');
  
  if (req.method === "OPTIONS") {
    console.log('[send-waitlist-email] Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit by IP
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(supabase, {
      identifierType: "waitlist_email",
      identifier: clientIp,
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
    });
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body = await req.json();
    console.log('[send-waitlist-email] Request body:', { 
      email: body.email, 
      hasCompanyName: !!body.companyName 
    });
    
    const { email, companyName }: WaitlistEmailRequest = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending waitlist confirmation email to: ${email}`);

    const emailResponse = await resend.emails.send({
      from: "FieldTek <info@fieldtek.ai>",
      to: [email],
      subject: "You're on the FieldTek Waitlist! 🎉",
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
            <td style="background: linear-gradient(135deg, #1F1B18 0%, #292524 100%); padding: 40px 40px 36px; text-align: center; border-radius: 16px 16px 0 0;">
              <p style="margin: 0 0 8px; font-size: 28px;">🚀</p>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                <span style="color: #ffffff;">Field</span><span style="color: #F97316;">Tek</span>
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.7); font-size: 14px; letter-spacing: 0.5px;">You're on the list!</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a2e; font-weight: 700; text-align: center;">
                You're on the list!
              </h2>
              
              <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 16px 0 24px; text-align: center;">
                Thanks for joining the FieldTek waitlist${companyName ? ` on behalf of <strong>${companyName}</strong>` : ''}. We're building something special for field service teams like yours.
              </p>

              <!-- Benefits -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-left: 4px solid #F97316; padding: 20px 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #9A3412;">As a waitlist member, you'll get:</p>
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ <strong>Priority access</strong> when we launch</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ <strong>Exclusive early-bird pricing</strong> — locked in forever</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ <strong>Direct line</strong> to our founding team</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;">✦ <strong>Sneak peeks</strong> of new features before anyone else</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What is FieldTek -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="background: #FAFAFA; padding: 20px 24px; border-radius: 12px;">
                    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: #1a1a2e;">What's FieldTek all about?</p>
                    <p style="margin: 0; font-size: 13px; color: #52525b; line-height: 1.6;">
                      FieldTek is the AI-powered field service platform that helps HVAC, plumbing, and electrical contractors manage their operations — from smart scheduling to invoicing to an AI assistant that helps your techs in the field.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #52525b; line-height: 1.6; margin: 0 0 4px;">
                We'll be in touch soon with updates. In the meantime, reply to this email with any questions — we read every message!
              </p>
              <p style="font-size: 14px; color: #52525b; margin: 12px 0 0;">
                Talk soon,<br><strong>The FieldTek Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #a1a1aa;">
                <span style="color: #1F1B18; font-weight: 600;">Field</span><span style="color: #F97316; font-weight: 600;">Tek</span> · Field Service Management
              </p>
              <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                You're receiving this because you signed up for the FieldTek waitlist.<br>
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
    });

    console.log("Waitlist email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-waitlist-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
