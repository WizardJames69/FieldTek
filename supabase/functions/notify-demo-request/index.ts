import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAX_REQUESTS_PER_DAY = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DemoRequestData {
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  industry?: string;
  team_size?: string;
  preferred_date?: string;
  preferred_time?: string;
  message?: string;
}

async function checkRateLimit(supabase: any, email: string): Promise<{ allowed: boolean; remaining: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
  
  // Check existing rate limit record
  const { data: existing, error: fetchError } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("identifier", normalizedEmail)
    .eq("identifier_type", "demo_request_email")
    .gte("window_start", windowStart.toISOString())
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error("[notify-demo-request] Rate limit fetch error:", fetchError);
  }

  if (existing) {
    if (existing.request_count >= MAX_REQUESTS_PER_DAY) {
      console.log("[notify-demo-request] Rate limit exceeded for:", normalizedEmail);
      return { allowed: false, remaining: 0 };
    }
    
    // Increment count
    const { error: updateError } = await supabase
      .from("rate_limits")
      .update({ request_count: existing.request_count + 1 })
      .eq("id", existing.id);
      
    if (updateError) {
      console.error("[notify-demo-request] Rate limit update error:", updateError);
    }
    
    return { allowed: true, remaining: MAX_REQUESTS_PER_DAY - existing.request_count - 1 };
  }

  // Create new rate limit record
  const { error: insertError } = await supabase
    .from("rate_limits")
    .insert({
      identifier: normalizedEmail,
      identifier_type: "demo_request_email",
      request_count: 1,
      window_start: windowStart.toISOString(),
    });

  if (insertError) {
    console.error("[notify-demo-request] Rate limit insert error:", insertError);
  }

  return { allowed: true, remaining: MAX_REQUESTS_PER_DAY - 1 };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[notify-demo-request] Function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: DemoRequestData = await req.json();
    console.log("[notify-demo-request] Received data:", { email: data.email, company: data.company_name });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(supabase, data.email);
    
    if (!allowed) {
      console.log("[notify-demo-request] Rate limit blocked request for:", data.email);
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded", 
          message: "You've reached the maximum number of demo requests for today. Please try again tomorrow.",
          rateLimited: true
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[notify-demo-request] Rate limit passed, remaining requests:", remaining);

    // Fetch platform admins
    const { data: admins, error: adminError } = await supabase
      .from("platform_admins")
      .select("email");

    if (adminError) {
      console.error("[notify-demo-request] Error fetching platform admins:", adminError);
    }

    const adminEmails = admins?.map(a => a.email) || [];
    console.log("[notify-demo-request] Platform admin emails:", adminEmails);

    const formattedDate = data.preferred_date 
      ? new Date(data.preferred_date).toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })
      : 'Not specified';

    const firstName = data.name.split(' ')[0];

    // Send admin notification if admins exist
    let adminEmailResponse = null;
    if (adminEmails.length > 0) {
      const adminEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Demo Request</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color: #1e3a5f; margin-top: 0;">Contact: ${data.name}</h2>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
              <p><strong>Company:</strong> ${data.company_name || 'Not provided'}</p>
              <p><strong>Industry:</strong> ${data.industry || 'Not specified'}</p>
              <p><strong>Team Size:</strong> ${data.team_size || 'Not specified'}</p>
              <p><strong>Preferred Date:</strong> ${formattedDate}</p>
              <p><strong>Preferred Time:</strong> ${data.preferred_time || 'Not specified'}</p>
              ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ''}
            </div>
          </div>
        </div>
      `;

      const adminRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "FieldTek <sales@fieldtek.ai>",
          to: adminEmails,
          subject: `New Demo Request: ${data.company_name || data.name}`,
          html: adminEmailHtml,
        }),
      });

      adminEmailResponse = await adminRes.json();
      console.log("[notify-demo-request] Admin notification sent:", adminEmailResponse);
    } else {
      console.log("[notify-demo-request] No platform admins configured, skipping admin notification");
    }

    // Send user confirmation email
    const userConfirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Demo Request Confirmed!</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151;">Hi ${firstName},</p>
          <p style="font-size: 16px; color: #374151;">
            Thank you for requesting a consultation with FieldTek! We've received your request and a product specialist will reach out within 24 hours.
          </p>
          
          <div style="background: white; border-radius: 12px; padding: 24px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #1e3a5f;">Your Request Details:</h3>
            <p style="margin: 8px 0;"><strong>Company:</strong> ${data.company_name || 'Not provided'}</p>
            <p style="margin: 8px 0;"><strong>Industry:</strong> ${data.industry || 'Not specified'}</p>
            <p style="margin: 8px 0;"><strong>Preferred Date:</strong> ${formattedDate}</p>
            <p style="margin: 8px 0;"><strong>Preferred Time:</strong> ${data.preferred_time || 'Not specified'}</p>
          </div>
          
          <p style="font-size: 16px; color: #374151;">
            In the meantime, feel free to explore our <a href="https://fieldtek.ai/demo-sandbox" style="color: #2563eb;">interactive demo</a> to see FieldTek in action.
          </p>
          
          <p style="font-size: 16px; color: #374151; margin-top: 24px;">
            Best regards,<br>
            <strong>The FieldTek Team</strong>
          </p>
        </div>
        <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>© 2025 FieldTek. All rights reserved.</p>
        </div>
      </div>
    `;

    const userEmailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FieldTek <info@fieldtek.ai>",
        to: [data.email],
        subject: "Your FieldTek Demo Request is Confirmed!",
        html: userConfirmationHtml,
      }),
    });

    const userEmailResponse = await userEmailRes.json();
    console.log("[notify-demo-request] User confirmation sent:", userEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        adminNotification: adminEmailResponse,
        userConfirmation: userEmailResponse,
        remainingRequests: remaining
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[notify-demo-request] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
