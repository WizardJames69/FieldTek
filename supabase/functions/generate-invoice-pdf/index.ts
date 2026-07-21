import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAuthorizedForInvoice } from "./authorize.ts";
import { renderInvoicePdf } from "./renderInvoicePdf.ts";

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

    // SECURITY (PR-SEC-5): authorize the caller for THIS invoice before rendering
    // any of its PII/financials. `getUser` above only proves the caller is *some*
    // logged-in user; without this check any authenticated user (any tenant's
    // staff, any portal customer, a demo user) could fetch another tenant's
    // invoice by UUID. Authorized = active staff of the invoice's tenant
    // (owner/admin/dispatcher) OR the owning portal client. Anything else returns
    // the same 404 as a missing invoice (non-enumerating).
    if (!(await isAuthorizedForInvoice(supabase, user.id, invoice))) {
      console.warn("[generate-invoice-pdf] Unauthorized invoice access blocked", { userId: user.id });
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

    // Render a real PDF (PR-APP-6). Previously this returned print-ready HTML the
    // browser had to save-as-PDF; now the endpoint returns application/pdf bytes
    // so "Download PDF" in the app and portal produces an actual .pdf file.
    const pdfBytes = await renderInvoicePdf({ invoice, tenant, branding, lineItems });

    const safeNumber = String(invoice.invoice_number || "invoice").replace(/[^a-zA-Z0-9._-]/g, "-");
    // Copy into a fresh Uint8Array<ArrayBuffer> so it satisfies Deno's BodyInit
    // typing (pdf-lib's save() is typed Uint8Array<ArrayBufferLike>).
    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${safeNumber}.pdf"`,
        "Cache-Control": "no-store",
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
