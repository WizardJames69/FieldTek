import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaymentReceiptRequest {
  invoiceId: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PAYMENT-RECEIPT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId }: PaymentReceiptRequest = await req.json();
    logStep("Processing payment receipt", { invoiceId });

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        id,
        invoice_number,
        total,
        paid_at,
        tenant_id,
        clients (
          id,
          name,
          email
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      logStep("Invoice not found", { error: invoiceError?.message });
      throw new Error("Invoice not found");
    }

    const client = invoice.clients as unknown as { id: string; name: string; email: string } | null;
    
    if (!client?.email) {
      logStep("No client email found", { invoiceId });
      return new Response(
        JSON.stringify({ success: false, message: "No client email found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant branding
    const { data: branding } = await supabaseClient
      .from("tenant_branding")
      .select("company_name, logo_url, primary_color")
      .eq("tenant_id", invoice.tenant_id)
      .single();

    const { data: tenant } = await supabaseClient
      .from("tenants")
      .select("name, email, phone")
      .eq("id", invoice.tenant_id)
      .single();

    const companyName = branding?.company_name || tenant?.name || "Service Provider";
    const primaryColor = branding?.primary_color || "#1F1B18";
    const logoUrl = branding?.logo_url;
    const companyEmail = tenant?.email;
    const companyPhone = tenant?.phone;

    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(invoice.total) || 0);

    const paidDate = invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    logStep("Sending receipt email", { 
      to: client.email, 
      invoiceNumber: invoice.invoice_number,
      total: formattedTotal 
    });

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
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; letter-spacing: 0.5px;">Payment Receipt</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <!-- Success Icon -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td align="center">
                    <table role="presentation" style="border-collapse: collapse;">
                      <tr>
                        <td style="width: 64px; height: 64px; background: linear-gradient(135deg, #22C55E, #16A34A); border-radius: 50%; text-align: center; line-height: 64px;">
                          <span style="color: #ffffff; font-size: 28px;">✓</span>
                        </td>
                      </tr>
                    </table>
                    <h2 style="margin: 16px 0 4px; font-size: 22px; color: #1a1a2e; font-weight: 700;">Payment Received</h2>
                    <p style="margin: 0; font-size: 15px; color: #71717a;">Thank you for your payment!</p>
                  </td>
                </tr>
              </table>

              <!-- Receipt Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="background: #FAFAFA; padding: 20px 24px; border-radius: 12px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Invoice Number</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #1a1a2e; text-align: right; font-weight: 600;">${invoice.invoice_number}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #71717a;">Payment Date</td>
                        <td style="padding: 8px 0; font-size: 14px; color: #1a1a2e; text-align: right; font-weight: 600;">${paidDate}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 12px 0 0;">
                          <hr style="border: none; border-top: 2px solid #f4f4f5; margin: 0;">
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 0; font-size: 16px; color: #1a1a2e; font-weight: 700;">Amount Paid</td>
                        <td style="padding: 12px 0 0; font-size: 22px; color: #22C55E; text-align: right; font-weight: 800;">${formattedTotal}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #52525b; line-height: 1.7; margin: 0 0 24px;">
                Dear ${client.name},<br><br>
                We have received your payment of <strong>${formattedTotal}</strong> for invoice <strong>${invoice.invoice_number}</strong>. This email serves as your official payment receipt.<br><br>
                If you have any questions about this payment, please don't hesitate to contact us.
              </p>

              <!-- Contact Info -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 20px 0; border-top: 1px solid #f4f4f5; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 14px; color: #1a1a2e; font-weight: 600;">${companyName}</p>
                    ${companyEmail ? `<p style="margin: 0 0 4px; font-size: 12px; color: #71717a;">${companyEmail}</p>` : ''}
                    ${companyPhone ? `<p style="margin: 0; font-size: 12px; color: #71717a;">${companyPhone}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #a1a1aa;">
                This is an automated payment receipt from ${companyName}.
              </p>
              <p style="margin: 0 0 8px; font-size: 11px; color: #a1a1aa;">Please keep this email for your records.</p>
              <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                Powered by <span style="color: #1F1B18; font-weight: 600;">Field</span><span style="color: #F97316; font-weight: 600;">Tek</span>
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
      from: `${companyName} <info@fieldtek.ai>`,
      to: [client.email],
      subject: `Payment Receipt - Invoice ${invoice.invoice_number}`,
      html: emailHtml,
    });

    logStep("Email sent successfully", { response: JSON.stringify(emailResponse) });

    return new Response(
      JSON.stringify({ success: true, response: emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
