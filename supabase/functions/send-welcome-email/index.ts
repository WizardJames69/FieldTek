import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[send-welcome-email] Function invoked');
  
  if (req.method === "OPTIONS") {
    console.log('[send-welcome-email] Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[send-welcome-email] Request body:', { 
      email: body.email, 
      hasFullName: !!body.fullName 
    });
    
    const { email, fullName }: WelcomeEmailRequest = body;

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ error: "Email and fullName are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const firstName = fullName.split(' ')[0];

    const emailResponse = await resend.emails.send({
      from: "FieldTek <info@fieldtek.ai>",
      to: [email],
      subject: `Welcome to FieldTek, ${firstName}! 🎉`,
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
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.7); font-size: 14px; letter-spacing: 0.5px;">Welcome Aboard</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <h2 style="margin: 0 0 8px; font-size: 22px; color: #1a1a2e; font-weight: 700;">
                Welcome, ${firstName}!
              </h2>
              
              <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 16px 0 24px;">
                Thank you for joining the FieldTek early access program! You're now on the list for priority access when we launch.
              </p>

              <!-- Getting Started Steps -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-left: 4px solid #F97316; padding: 20px 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 14px; font-size: 14px; font-weight: 700; color: #9A3412;">Get started in 3 simple steps:</p>
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;"><strong>1.</strong> Complete your company profile — add branding & details</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;"><strong>2.</strong> Add your first client — import or create records</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #78350F;"><strong>3.</strong> Schedule your first job — see dispatch in action</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 28px;">
                    <a href="https://fieldtek.ai/dashboard" 
                       style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                      Go to Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="background: #FAFAFA; padding: 20px 24px; border-radius: 12px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #1a1a2e;">What you get with FieldTek:</p>
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #52525b;">✦ Smart job scheduling & dispatch</td></tr>
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #52525b;">✦ AI-powered field assistant</td></tr>
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #52525b;">✦ Professional invoicing</td></tr>
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #52525b;">✦ Customer portal for service requests</td></tr>
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #52525b;">✦ Equipment tracking & history</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #52525b; line-height: 1.6; margin: 0 0 4px;">
                Need help? Just reply to this email — we're here for you!
              </p>
              <p style="font-size: 14px; color: #52525b; margin: 12px 0 0;">
                Best regards,<br><strong>The FieldTek Team</strong>
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
                You're receiving this because you signed up for FieldTek.<br>
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

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
