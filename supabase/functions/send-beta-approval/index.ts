import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BetaApprovalRequest {
  email: string;
  companyName: string;
  promoCode: string;
  applicationId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      throw new Error('Email service not configured');
    }

    const { email, companyName, promoCode, applicationId }: BetaApprovalRequest = await req.json();

    if (!email || !companyName || !promoCode) {
      throw new Error('Missing required fields: email, companyName, promoCode');
    }

    console.log(`Sending beta approval email to ${email} for ${companyName}`);

    const emailHtml = `
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
            <td style="background: linear-gradient(135deg, #1F1B18 0%, #292524 100%); padding: 40px 40px 36px; text-align: center; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                <span style="color: #ffffff;">Field</span><span style="color: #F97316;">Tek</span>
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; letter-spacing: 0.5px;">Beta Program — You're In</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td class="ft-card" style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <p class="ft-heading" style="font-size: 18px; color: #18181b; margin: 0 0 16px;">
                Hi <strong>${companyName}</strong> team,
              </p>

              <p class="ft-text" style="font-size: 15px; color: #3f3f46; line-height: 1.7; margin: 0 0 24px;">
                Congratulations — your application to the FieldTek Beta Program has been <strong>approved</strong>. You're now one of our Founding Members.
              </p>

              <!-- Promo Code Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #F97316, #EA580C); padding: 28px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0 0 10px; color: #ffffff; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Exclusive Discount Code</p>
                    <table role="presentation" style="margin: 0 auto; border-collapse: collapse;">
                      <tr>
                        <td style="background-color: #ffffff; padding: 14px 32px; border-radius: 8px;">
                          <span style="font-size: 24px; font-weight: 800; color: #1F1B18; letter-spacing: 3px; font-family: monospace;">${promoCode}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 14px 0 0; color: #ffffff; font-size: 16px; font-weight: 700;">50% OFF your first year!</p>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <h3 class="ft-heading" style="font-size: 16px; color: #18181b; margin: 0 0 16px; font-weight: 700;">What's Next?</h3>
              
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 12px 16px; background: #FAFAFA; border-radius: 8px; margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #52525b;"><strong style="color: #F97316;">1.</strong> <a href="https://fieldtek.ai/register" style="color: #1F1B18; text-decoration: underline; font-weight: 600;">Register your account</a> using the promo code above</p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background: #FAFAFA; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #52525b;"><strong style="color: #F97316;">2.</strong> Set up your company and invite your team</p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background: #FAFAFA; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #52525b;"><strong style="color: #F97316;">3.</strong> Explore the platform and AI-powered features</p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background: #FAFAFA; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #52525b;"><strong style="color: #F97316;">4.</strong> Share your feedback — your input shapes the product!</p>
                  </td>
                </tr>
              </table>

              <!-- Founding Member Benefits -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 28px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-left: 4px solid #F97316; padding: 20px 24px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #9A3412;">Founding Member Benefits</p>
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #78350F;">✦ 50% discount on your first year subscription</td></tr>
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #78350F;">✦ Direct line to our product team</td></tr>
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #78350F;">✦ Early access to new features</td></tr>
                      <tr><td style="padding: 3px 0; font-size: 13px; color: #78350F;">✦ Founding Member badge on your account</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="https://fieldtek.ai/register" 
                       style="display: inline-block; background: linear-gradient(135deg, #F97316, #EA580C); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                      Get Started Now
                    </a>
                  </td>
                </tr>
              </table>

              <p class="ft-text" style="font-size: 14px; color: #3f3f46; line-height: 1.6; margin: 0;">
                We're glad to have you on board. If you have any questions, just reply to this email.
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

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'FieldTek <info@fieldtek.ai>',
        to: [email],
        subject: 'Welcome to FieldTek Beta — You\'re In',
        html: emailHtml,
      }),
    });

    const responseBody = await response.text();
    console.log(`Resend API response status: ${response.status}, body: ${responseBody}`);

    if (!response.ok) {
      console.error('Resend API error:', responseBody);
      
      if (applicationId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('beta_applications')
          .update({ 
            email_error: `Failed to send email: ${response.status} - ${responseBody}`
          })
          .eq('id', applicationId);
      }
      
      throw new Error(`Failed to send email: ${response.status}`);
    }

    const result = JSON.parse(responseBody);
    console.log('Email sent successfully:', result);

    if (applicationId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('beta_applications')
        .update({ 
          email_sent_at: new Date().toISOString(),
          email_error: null
        })
        .eq('id', applicationId);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-beta-approval:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
