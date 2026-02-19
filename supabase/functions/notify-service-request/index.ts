import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId, tenantId } = await req.json();

    if (!requestId || !tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing requestId or tenantId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the service request details
    const { data: request, error: requestError } = await supabase
      .from("service_requests")
      .select(`
        *,
        clients (name, email)
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      console.error("Error fetching request:", requestError);
      return new Response(
        JSON.stringify({ error: "Service request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant details and branding
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, email")
      .eq("id", tenantId)
      .single();

    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("company_name, primary_color, logo_url")
      .eq("tenant_id", tenantId)
      .single();

    // Fetch admin/owner users for this tenant
    const { data: adminUsers, error: usersError } = await supabase
      .from("tenant_users")
      .select(`
        user_id,
        role,
        profiles!inner (email, full_name)
      `)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("role", ["owner", "admin"]);

    if (usersError) {
      console.error("Error fetching admin users:", usersError);
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.log("No admin users found for tenant:", tenantId);
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin emails
    const adminEmails = adminUsers
      .map((u: any) => u.profiles?.email)
      .filter((email: string | null) => email);

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email notification
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const companyName = branding?.company_name || tenant?.name || "FieldTek";
    const primaryColor = branding?.primary_color || "#2563eb";
    const clientName = request.clients?.name || "Unknown Customer";
    const requestType = request.request_type || "General";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Service Request</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background-color: ${primaryColor}; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                      🔔 New Service Request
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                      A new service request has been submitted and requires your attention.
                    </p>
                    
                    <!-- Request Details Card -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 24px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Request Type</p>
                                <p style="margin: 4px 0 0; color: #111827; font-size: 16px; font-weight: 600;">${requestType}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Subject</p>
                                <p style="margin: 4px 0 0; color: #111827; font-size: 16px; font-weight: 600;">${request.title}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Customer</p>
                                <p style="margin: 4px 0 0; color: #111827; font-size: 16px; font-weight: 600;">${clientName}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-top: 16px;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Description</p>
                                <p style="margin: 4px 0 0; color: #374151; font-size: 14px; line-height: 1.6;">${request.description || "No description provided"}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            Log in to your dashboard to review and respond to this request.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 32px; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                      This is an automated notification from ${companyName}.<br>
                      You're receiving this because you're an administrator.
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
      to: adminEmails,
      subject: `🔔 New Service Request: ${request.title}`,
      html: emailHtml,
    });

    console.log("Notification email sent:", emailResponse);

    // Also send push notifications to dispatchers
    const dispatcherUserIds = adminUsers.map((u: any) => u.user_id);
    
    // Also include dispatchers in push notifications
    const { data: dispatchers } = await supabase
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("role", "dispatcher");

    if (dispatchers) {
      dispatcherUserIds.push(...dispatchers.map((d: any) => d.user_id));
    }

    // Send push notification (fire and forget)
    if (dispatcherUserIds.length > 0) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            userIds: [...new Set(dispatcherUserIds)], // dedupe
            tenantId,
            payload: {
              title: "📨 New Service Request",
              body: `${requestType}: ${request.title}`,
              type: "service_request",
              tag: `service_request_${requestId}`,
              data: {
                requestId,
                url: `/service-requests?request=${requestId}`,
              },
              actions: [{ action: "view", title: "View Request" }],
            },
          }),
        });
        console.log("Push notifications sent to dispatchers");
      } catch (pushErr) {
        console.error("Failed to send push notifications:", pushErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-service-request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
