import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[generate-invoice-pdf] Authenticated user:", user.id);
    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "Invoice ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice with client and line items
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        clients (
          name,
          email,
          phone,
          address,
          city,
          state,
          zip_code
        ),
        scheduled_jobs (
          title
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant branding
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("company_name, logo_url, primary_color")
      .eq("tenant_id", invoice.tenant_id)
      .single();

    // Fetch tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, address, phone, email")
      .eq("id", invoice.tenant_id)
      .single();

    // Fetch line items
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at");

    const companyName = branding?.company_name || tenant?.name || "Company";
    const primaryColor = branding?.primary_color || "#1e3a5f";

    // Format date
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return "-";
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      border-bottom: 3px solid ${primaryColor};
      padding-bottom: 20px;
    }
    .company-info h1 {
      color: ${primaryColor};
      font-size: 24px;
      margin-bottom: 8px;
    }
    .company-info p {
      color: #666;
      font-size: 11px;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h2 {
      font-size: 28px;
      color: ${primaryColor};
      margin-bottom: 8px;
    }
    .invoice-title p {
      color: #666;
      font-size: 11px;
    }
    .invoice-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .bill-to, .invoice-details {
      width: 48%;
    }
    .bill-to h3, .invoice-details h3 {
      color: ${primaryColor};
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 8px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
    }
    .bill-to p, .invoice-details p {
      margin-bottom: 4px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .status-draft { background: #f3f4f6; color: #6b7280; }
    .status-sent { background: #dbeafe; color: #1d4ed8; }
    .status-paid { background: #dcfce7; color: #15803d; }
    .status-overdue { background: #fee2e2; color: #dc2626; }
    .status-cancelled { background: #f3f4f6; color: #6b7280; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead {
      background: ${primaryColor};
      color: white;
    }
    th {
      padding: 12px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
    }
    th:last-child, td:last-child {
      text-align: right;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #eee;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .totals {
      width: 300px;
      margin-left: auto;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .totals-row.total {
      font-size: 16px;
      font-weight: bold;
      color: ${primaryColor};
      border-bottom: 2px solid ${primaryColor};
      border-top: 2px solid ${primaryColor};
      margin-top: 8px;
      padding-top: 12px;
    }
    .notes {
      margin-top: 40px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .notes h3 {
      color: ${primaryColor};
      margin-bottom: 8px;
      font-size: 12px;
    }
    .notes p {
      color: #666;
      font-size: 11px;
    }
    .footer {
      margin-top: 60px;
      text-align: center;
      color: #999;
      font-size: 10px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${companyName}</h1>
      ${tenant?.address ? `<p>${tenant.address}</p>` : ""}
      ${tenant?.phone ? `<p>Phone: ${tenant.phone}</p>` : ""}
      ${tenant?.email ? `<p>Email: ${tenant.email}</p>` : ""}
    </div>
    <div class="invoice-title">
      <h2>INVOICE</h2>
      <p><strong>${invoice.invoice_number}</strong></p>
    </div>
  </div>

  <div class="invoice-meta">
    <div class="bill-to">
      <h3>Bill To</h3>
      ${invoice.clients ? `
        <p><strong>${invoice.clients.name}</strong></p>
        ${invoice.clients.address ? `<p>${invoice.clients.address}</p>` : ""}
        ${invoice.clients.city || invoice.clients.state || invoice.clients.zip_code ? `
          <p>${[invoice.clients.city, invoice.clients.state, invoice.clients.zip_code].filter(Boolean).join(", ")}</p>
        ` : ""}
        ${invoice.clients.email ? `<p>${invoice.clients.email}</p>` : ""}
        ${invoice.clients.phone ? `<p>${invoice.clients.phone}</p>` : ""}
      ` : "<p>-</p>"}
    </div>
    <div class="invoice-details">
      <h3>Invoice Details</h3>
      <p><strong>Invoice Date:</strong> ${formatDate(invoice.created_at)}</p>
      <p><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>
      ${invoice.scheduled_jobs ? `<p><strong>Job:</strong> ${invoice.scheduled_jobs.title}</p>` : ""}
      <span class="status-badge status-${invoice.status || "draft"}">${(invoice.status || "draft").toUpperCase()}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%">Description</th>
        <th style="width: 15%">Quantity</th>
        <th style="width: 17%">Unit Price</th>
        <th style="width: 18%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${(lineItems || []).map((item: any) => `
        <tr>
          <td>${item.description}</td>
          <td>${item.quantity || 1}</td>
          <td>$${Number(item.unit_price).toFixed(2)}</td>
          <td>$${Number(item.total).toFixed(2)}</td>
        </tr>
      `).join("")}
      ${(!lineItems || lineItems.length === 0) ? `
        <tr>
          <td colspan="4" style="text-align: center; color: #999; padding: 30px;">No line items</td>
        </tr>
      ` : ""}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>$${Number(invoice.subtotal || 0).toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>Tax</span>
      <span>$${Number(invoice.tax_amount || 0).toFixed(2)}</span>
    </div>
    <div class="totals-row total">
      <span>Total Due</span>
      <span>$${Number(invoice.total || 0).toFixed(2)}</span>
    </div>
  </div>

  ${invoice.notes ? `
    <div class="notes">
      <h3>Notes</h3>
      <p>${invoice.notes}</p>
    </div>
  ` : ""}

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  </div>
</body>
</html>
    `;

    // Return HTML that can be printed/saved as PDF
    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate invoice" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
