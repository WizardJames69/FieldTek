import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp } from "../_shared/rateLimit.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContactInquiryRequest {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  inquiryType: "sales" | "support" | "general" | "partnership";
  message: string;
  _hp?: string; // Honeypot field
}

// Map inquiry types to email addresses
const emailMapping: Record<string, string> = {
  sales: "sales@fieldtek.ai",
  support: "info@fieldtek.ai",
  general: "info@fieldtek.ai",
  partnership: "sales@fieldtek.ai",
};

const inquiryTypeLabels: Record<string, string> = {
  sales: "Sales Inquiry",
  support: "Customer Support",
  general: "General Question",
  partnership: "Partnership Opportunity",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP for rate limiting
    const clientIp = getClientIp(req);

    const data: ContactInquiryRequest = await req.json();

    // Honeypot check - if the hidden field is filled, it's likely a bot
    if (data._hp) {
      console.log(`Honeypot triggered - rejecting submission from IP: ${clientIp}`);
      // Return success to not alert bots, but don't process
      return new Response(
        JSON.stringify({ success: true, message: "Contact inquiry sent successfully" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate required fields
    if (!data.name || !data.email || !data.inquiryType || !data.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate inquiry type
    if (!Object.keys(emailMapping).includes(data.inquiryType)) {
      return new Response(
        JSON.stringify({ error: "Invalid inquiry type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check rate limits (by IP and email)
    const [ipRateLimit, emailRateLimit] = await Promise.all([
      checkRateLimit(supabase, {
        identifierType: "contact_form_ip",
        identifier: clientIp,
        windowMs: 60 * 60 * 1000,
        maxRequests: 5,
      }),
      checkRateLimit(supabase, {
        identifierType: "contact_form_email",
        identifier: data.email.toLowerCase(),
        windowMs: 60 * 60 * 1000,
        maxRequests: 5,
      }),
    ]);

    if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp} or email: ${data.email}`);
      return new Response(
        JSON.stringify({
          error: "Too many submissions. Please try again later.",
          retryAfter: 3600
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "3600",
            ...corsHeaders
          }
        }
      );
    }

    const targetEmail = emailMapping[data.inquiryType];
    const inquiryLabel = inquiryTypeLabels[data.inquiryType];

    console.log(`Sending ${data.inquiryType} inquiry from ${data.email} to ${targetEmail}`);

    // Send notification to FieldTek team
    const internalEmailResponse = await resend.emails.send({
      from: "FieldTek Contact <info@fieldtek.ai>",
      to: [targetEmail],
      reply_to: data.email,
      subject: `New ${inquiryLabel}: ${data.name}${data.company ? ` (${data.company})` : ""}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${inquiryLabel}</p>
          </div>
          
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <strong style="color: #6b7280;">Name:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  ${data.name}
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <strong style="color: #6b7280;">Email:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <a href="mailto:${data.email}" style="color: #f97316; text-decoration: none;">${data.email}</a>
                </td>
              </tr>
              ${data.company ? `
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <strong style="color: #6b7280;">Company:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  ${data.company}
                </td>
              </tr>
              ` : ""}
              ${data.phone ? `
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <strong style="color: #6b7280;">Phone:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <a href="tel:${data.phone}" style="color: #f97316; text-decoration: none;">${data.phone}</a>
                </td>
              </tr>
              ` : ""}
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <strong style="color: #6b7280;">Inquiry Type:</strong>
                </td>
                <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                  <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 14px;">${inquiryLabel}</span>
                </td>
              </tr>
            </table>
            
            <div style="margin-top: 24px;">
              <strong style="color: #6b7280; display: block; margin-bottom: 8px;">Message:</strong>
              <div style="background: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre-wrap;">
                ${data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </div>
            </div>
            
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              <a href="mailto:${data.email}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Reply to ${data.name}
              </a>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Internal email sent:", internalEmailResponse);

    // Send confirmation email to the person who submitted the form
    const confirmationEmailResponse = await resend.emails.send({
      from: "FieldTek <info@fieldtek.ai>",
      to: [data.email],
      subject: "We received your message - FieldTek",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #1f2937; font-size: 28px; margin: 0;">Thank You for Reaching Out!</h1>
          </div>
          
          <p>Hi ${data.name.split(" ")[0]},</p>
          
          <p>We've received your ${inquiryLabel.toLowerCase()} and our team will review it shortly. You can expect a response within 1-2 business days.</p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Your Message:</strong></p>
            <p style="margin: 0; color: #6b7280; white-space: pre-wrap;">${data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          
          <p>In the meantime, you might find these helpful:</p>
          <ul style="padding-left: 20px;">
            <li><a href="https://fieldtek.ai/demo-sandbox" style="color: #f97316;">Try our interactive demo</a></li>
            <li><a href="https://fieldtek.ai/book-demo" style="color: #f97316;">Schedule a live consultation</a></li>
          </ul>
          
          <p>Best regards,<br><strong>The FieldTek Team</strong></p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            © ${new Date().getFullYear()} FieldTek. All rights reserved.<br>
            <a href="mailto:info@fieldtek.ai" style="color: #f97316;">info@fieldtek.ai</a>
          </p>
        </body>
        </html>
      `,
    });

    console.log("Confirmation email sent:", confirmationEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Contact inquiry sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contact-inquiry function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send contact inquiry" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
