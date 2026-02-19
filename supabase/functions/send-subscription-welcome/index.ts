import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SUBSCRIPTION-WELCOME] ${step}${detailsStr}`);
};

interface WelcomeEmailRequest {
  tier: string;
  isTrialing?: boolean;
  trialEndDate?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tier, isTrialing, trialEndDate }: WelcomeEmailRequest = await req.json();
    logStep("Request data", { tier, isTrialing, trialEndDate });

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const userName = profile?.full_name || user.email.split("@")[0];
    const tierName = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Professional";

    const trialMessage = isTrialing && trialEndDate
      ? `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
          <tr>
            <td style="background: linear-gradient(135deg, #ECFDF5, #D1FAE5); border-radius: 12px; padding: 20px 24px;">
              <table role="presentation" style="border-collapse: collapse;">
                <tr>
                  <td style="vertical-align: top; padding-right: 12px;">
                    <span style="font-size: 24px;">🎉</span>
                  </td>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #065F46;">Your 14-day free trial is active!</p>
                    <p style="margin: 0; font-size: 13px; color: #047857; line-height: 1.5;">
                      Trial ends on <strong>${new Date(trialEndDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>. You won't be charged until then.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`
      : "";

    const tierFeatures = tier === "starter"
      ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Up to 2 technicians</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ 100 jobs per month</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Client management</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Job scheduling & dispatch</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Basic invoicing</td></tr>`
      : tier === "growth"
      ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Up to 5 technicians</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ 500 jobs per month</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ AI Field Assistant</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Equipment tracking</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Customer portal</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Advanced reporting</td></tr>`
      : `<tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Up to 10 technicians</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Unlimited jobs</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Custom workflows</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ API access</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ Priority support</td></tr>
         <tr><td style="padding: 4px 0; font-size: 13px; color: #78350F;">✦ All Growth features</td></tr>`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F5F0EB;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1F1B18 0%, #292524 50%, #1F1B18 100%); padding: 48px 40px 40px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0 0 6px; font-size: 30px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #F5F0EB;">Field</span><span style="color: #F97316;">Tek</span>
              </h1>
              <p style="margin: 0 0 20px; font-size: 12px; color: rgba(245,240,235,0.5); letter-spacing: 2px; text-transform: uppercase;">Field Service Management</p>
              
              <!-- Gradient divider -->
              <table role="presentation" style="width: 80px; border-collapse: collapse; margin: 0 auto 20px;">
                <tr>
                  <td style="height: 2px; background: linear-gradient(90deg, transparent, #F97316, transparent);"></td>
                </tr>
              </table>
              
              <p style="margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #F5F0EB;">Welcome aboard, ${userName}!</p>
              <p style="margin: 0; font-size: 14px; color: rgba(245,240,235,0.7);">Your <strong style="color: #F97316;">${tierName}</strong> plan is now active</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
              
              ${trialMessage}

              <!-- Plan Features -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 32px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 14px; font-size: 13px; font-weight: 700; color: #9A3412; letter-spacing: 0.5px; text-transform: uppercase;">Your ${tierName} plan includes</p>
                    <table role="presentation" style="border-collapse: collapse;">
                      ${tierFeatures}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <p style="margin: 0 0 16px; font-size: 15px; font-weight: 700; color: #1F1B18;">Get started in 3 steps:</p>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 32px;">
                <tr>
                  <td style="padding: 14px 16px; background: #FAFAF9; border-radius: 10px; border: 1px solid #E7E5E4;">
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: top; padding-right: 14px;">
                          <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #F97316, #EA580C); color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700;">1</span>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #1F1B18;">Set up your brand</p>
                          <p style="margin: 0; font-size: 13px; color: #78716C;">Add your logo and company colors</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 14px 16px; background: #FAFAF9; border-radius: 10px; border: 1px solid #E7E5E4;">
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: top; padding-right: 14px;">
                          <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #F97316, #EA580C); color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700;">2</span>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #1F1B18;">Invite your team</p>
                          <p style="margin: 0; font-size: 13px; color: #78716C;">Add technicians and dispatchers</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 14px 16px; background: #FAFAF9; border-radius: 10px; border: 1px solid #E7E5E4;">
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: top; padding-right: 14px;">
                          <span style="display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #F97316, #EA580C); color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px; font-weight: 700;">3</span>
                        </td>
                        <td>
                          <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #1F1B18;">Schedule your first job</p>
                          <p style="margin: 0; font-size: 13px; color: #78716C;">Add a client and create a service call</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 28px;">
                    <a href="https://fieldtek.ai/dashboard" 
                       style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 44px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #A8A29E; text-align: center; margin: 0;">
                Need help? Reach us at <a href="mailto:info@fieldtek.ai" style="color: #F97316; text-decoration: none;">info@fieldtek.ai</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #A8A29E;">
                <span style="color: #44403C; font-weight: 600;">Field</span><span style="color: #F97316; font-weight: 600;">Tek</span> · Field Service Management
              </p>
              <p style="margin: 0; font-size: 11px; color: #D6D3D1;">
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

    const emailResponse = await resend.emails.send({
      from: "FieldTek Pro <info@fieldtek.ai>",
      to: [user.email],
      subject: `Welcome to FieldTek Pro ${tierName}! 🎉`,
      html: emailHtml,
    });

    logStep("Email sent successfully", { response: emailResponse });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
