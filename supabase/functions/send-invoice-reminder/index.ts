import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[INVOICE-REMINDER] ${step}${detailsStr}`);
};

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  total: number;
  due_date: string;
  client: {
    name: string;
    email: string;
  };
  tenant: {
    name: string;
  };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse request body for optional filters
    let specificInvoiceId: string | null = null;
    let tenantId: string | null = null;
    
    try {
      const body = await req.json();
      specificInvoiceId = body.invoice_id || null;
      tenantId = body.tenant_id || null;
    } catch {
      // No body provided, will process all overdue invoices
    }

    // Build query for overdue invoices
    let query = supabaseClient
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total,
        due_date,
        client:clients(name, email),
        tenant:tenants(name)
      `)
      .or('status.eq.overdue,and(status.eq.sent,due_date.lt.now())');

    if (specificInvoiceId) {
      query = query.eq('id', specificInvoiceId);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: overdueInvoices, error: queryError } = await query;

    if (queryError) {
      logStep("Error fetching invoices", { error: queryError.message });
      throw new Error(`Failed to fetch overdue invoices: ${queryError.message}`);
    }

    logStep("Found overdue invoices", { count: overdueInvoices?.length || 0 });

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No overdue invoices found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results: { invoice_id: string; status: string; error?: string }[] = [];

    for (const invoice of overdueInvoices as unknown as OverdueInvoice[]) {
      const clientEmail = invoice.client?.email;
      const clientName = invoice.client?.name || 'Valued Customer';
      const companyName = invoice.tenant?.name || 'Your Service Provider';

      if (!clientEmail) {
        logStep("Skipping invoice - no client email", { invoiceId: invoice.id });
        results.push({ invoice_id: invoice.id, status: "skipped", error: "No client email" });
        continue;
      }

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const formattedTotal = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(invoice.total || 0);
      const formattedDueDate = dueDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      try {
        const emailResponse = await resend.emails.send({
          from: `${companyName} <info@fieldtek.ai>`,
          to: [clientEmail],
          subject: `Payment Reminder: Invoice #${invoice.invoice_number} is Past Due`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
              <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">
                    ${companyName}
                  </h1>
                </div>
                
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                  <p style="color: #dc2626; font-weight: 600; margin: 0; font-size: 16px;">
                    ⚠️ Payment Overdue - ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} past due
                  </p>
                </div>
                
                <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
                  Dear ${clientName},
                </p>
                
                <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
                  This is a friendly reminder that payment for the following invoice is now overdue:
                </p>
                
                <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice Number:</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1a1a1a;">#${invoice.invoice_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Due Date:</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">${formattedDueDate}</td>
                    </tr>
                    <tr style="border-top: 2px solid #e5e7eb;">
                      <td style="padding: 16px 0 8px 0; color: #6b7280; font-size: 14px;">Amount Due:</td>
                      <td style="padding: 16px 0 8px 0; text-align: right; font-weight: 700; font-size: 24px; color: #1a1a1a;">${formattedTotal}</td>
                    </tr>
                  </table>
                </div>
                
                <p style="font-size: 16px; color: #555; margin-bottom: 24px;">
                  Please arrange payment at your earliest convenience to avoid any service interruptions. If you've already sent payment, please disregard this notice.
                </p>
                
                <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
                  If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <p style="font-size: 14px; color: #6b7280; margin: 0;">
                  Thank you for your business,<br>
                  <strong>${companyName}</strong>
                </p>
              </div>
              
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
                This is an automated payment reminder. Please do not reply directly to this email.
              </p>
            </body>
            </html>
          `,
        });

        logStep("Email sent successfully", { invoiceId: invoice.id });
        results.push({ invoice_id: invoice.id, status: "sent" });

        // Update invoice status to overdue if it wasn't already
        await supabaseClient
          .from('invoices')
          .update({ status: 'overdue' })
          .eq('id', invoice.id)
          .eq('status', 'sent');

      } catch (emailError: any) {
        logStep("Failed to send email", { invoiceId: invoice.id, error: emailError.message });
        results.push({ invoice_id: invoice.id, status: "failed", error: emailError.message });
      }
    }

    const sentCount = results.filter(r => r.status === "sent").length;
    logStep("Completed", { total: results.length, sent: sentCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentCount} reminder${sentCount !== 1 ? 's' : ''}`,
        sent: sentCount,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
