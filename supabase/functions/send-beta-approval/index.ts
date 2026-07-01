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
