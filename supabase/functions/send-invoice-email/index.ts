import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvoiceEmailRequest {
  invoiceId: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Invalid token:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user: ${userId}`);

    const { invoiceId }: InvoiceEmailRequest = await req.json();

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    console.log(`Processing invoice email for ID: ${invoiceId}`);

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Verify user has access to this invoice's tenant
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        clients (name, email, address, city, state, zip_code),
        scheduled_jobs (title)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.error("Error fetching invoice:", invoiceError);
      throw new Error("Invoice not found");
    }

    const { data: tenantUser, error: tenantUserError } = await supabase
      .from("tenant_users")
      .select("role, is_active")
      .eq("user_id", userId)
      .eq("tenant_id", invoice.tenant_id)
      .eq("is_active", true)
      .single();

    if (tenantUserError || !tenantUser) {
      console.error("User not authorized for this tenant:", tenantUserError);
      return new Response(
        JSON.stringify({ success: false, error: "You don't have access to this invoice" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const allowedRoles = ["owner", "admin", "dispatcher"];
    if (!allowedRoles.includes(tenantUser.role)) {
      console.error(`User role ${tenantUser.role} not authorized to send invoices`);
      return new Response(
        JSON.stringify({ success: false, error: "You don't have permission to send invoices" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`User ${userId} authorized with role ${tenantUser.role}`);

    // Fetch tenant branding
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("company_name, primary_color, logo_url")
      .eq("tenant_id", invoice.tenant_id)
      .single();

    // Fetch line items
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at");

    const clientEmail = invoice.clients?.email;
    const clientName = invoice.clients?.name || "Valued Customer";
    const companyName = branding?.company_name || "FieldTek";
    const primaryColor = branding?.primary_color || "#1F1B18";
    const logoUrl = branding?.logo_url;

    if (!clientEmail) {
      throw new Error("Client email not found");
    }

    console.log(`Sending invoice to: ${clientEmail}`);

    // Format line items
    const formattedLineItems = (lineItems || [])
      .map(
        (item: LineItem) => `
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #374151;">${item.description}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #f4f4f5; text-align: center; font-size: 14px; color: #374151;">${item.quantity}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #f4f4f5; text-align: right; font-size: 14px; color: #374151;">$${item.unit_price.toFixed(2)}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #f4f4f5; text-align: right; font-size: 14px; color: #1a1a2e; font-weight: 600;">$${item.total.toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    const dueDate = invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Upon Receipt";

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
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; letter-spacing: 0.5px;">Invoice ${invoice.invoice_number}</p>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
              
              <p style="font-size: 16px; color: #1a1a2e; margin: 0 0 16px;">
                Dear <strong>${clientName}</strong>,
              </p>
              
              <p style="font-size: 15px; color: #52525b; line-height: 1.7; margin: 0 0 24px;">
                Please find below the details of your invoice. We appreciate your business and look forward to serving you again.
              </p>

              <!-- Invoice Details Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="background: #FAFAFA; padding: 20px 24px; border-radius: 12px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Invoice Number</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1a1a2e; text-align: right; font-weight: 600;">${invoice.invoice_number}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Due Date</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1a1a2e; text-align: right; font-weight: 600;">${dueDate}</td>
                      </tr>
                      ${invoice.scheduled_jobs ? `
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #71717a;">Service</td>
                        <td style="padding: 6px 0; font-size: 14px; color: #1a1a2e; text-align: right; font-weight: 600;">${invoice.scheduled_jobs.title}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Line Items Table -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <thead>
                  <tr>
                    <th style="padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f4f4f5;">Description</th>
                    <th style="padding: 12px 16px; text-align: center; font-size: 11px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f4f4f5;">Qty</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f4f4f5;">Price</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f4f4f5;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${formattedLineItems}
                </tbody>
              </table>

              <!-- Totals -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 8px 16px; font-size: 14px; color: #71717a;">Subtotal</td>
                  <td style="padding: 8px 16px; font-size: 14px; color: #1a1a2e; text-align: right;">$${(invoice.subtotal || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 16px; font-size: 14px; color: #71717a;">Tax</td>
                  <td style="padding: 8px 16px; font-size: 14px; color: #1a1a2e; text-align: right;">$${(invoice.tax_amount || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 0;"><hr style="border: none; border-top: 2px solid #f4f4f5; margin: 8px 16px;"></td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 18px; color: #1a1a2e; font-weight: 700;">Total Due</td>
                  <td style="padding: 12px 16px; font-size: 20px; color: #F97316; text-align: right; font-weight: 800;">$${(invoice.total || 0).toFixed(2)}</td>
                </tr>
              </table>

              ${invoice.notes ? `
              <!-- Notes -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #FFF7ED, #FFEDD5); border-left: 4px solid #F97316; padding: 16px 20px; border-radius: 0 12px 12px 0;">
                    <p style="margin: 0; font-size: 13px; color: #9A3412;"><strong>Notes:</strong> ${invoice.notes}</p>
                  </td>
                </tr>
              </table>` : ''}

              <p style="font-size: 13px; color: #a1a1aa; text-align: center; margin: 0;">
                Please remit payment by the due date. Questions? Contact us directly.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #71717a;">${companyName}</p>
              <p style="margin: 0 0 8px; font-size: 11px; color: #a1a1aa;">Thank you for your business!</p>
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

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: `${companyName} <info@fieldtek.ai>`,
      to: [clientEmail],
      subject: `Invoice ${invoice.invoice_number} from ${companyName}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update invoice status
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Error updating invoice status:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invoice sent to ${clientEmail}`,
        emailId: emailResponse.data?.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-invoice-email function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send invoice email",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
