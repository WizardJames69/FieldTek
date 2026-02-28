import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const recipient = Deno.env.get("ALERT_EMAIL_RECIPIENT") || "founder@fieldtek.ai";
    const body = await req.json();

    // Validate, truncate, and escape all dynamic inputs
    const alertType = escapeHtml(String(body.alertType || "unknown").slice(0, 100));
    const severity = escapeHtml(String(body.severity || "unknown").slice(0, 20));
    const message = escapeHtml(String(body.message || "No details").slice(0, 1000));
    const source = escapeHtml(String(body.source || "unknown").slice(0, 100));

    const resend = new Resend(resendKey);
    // Derived from strict ternary — safe, not user-controlled
    const emoji = body.severity === "critical" ? "\u{1F534}" : "\u{1F7E0}";
    const color = body.severity === "critical" ? "#ef4444" : "#f97316";
    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });

    await resend.emails.send({
      from: "FieldTek Alerts <info@fieldtek.ai>",
      to: [recipient],
      subject: `${emoji} ${severity.toUpperCase()}: ${alertType.replace(/_/g, " ")}`,
      html: `<html><body style="font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f5f5f5;">
        <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <div style="background:${color};padding:20px 28px;">
            <h1 style="margin:0;font-size:18px;color:#fff;">${emoji} ${severity.toUpperCase()} Alert</h1>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.85);">${timestamp}</p>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;">Alert Type</p>
            <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#333;">${alertType.replace(/_/g, " ")}</p>
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;">Details</p>
            <p style="margin:0 0 20px;font-size:14px;color:#333;background:#f9fafb;padding:12px 16px;border-radius:8px;border-left:3px solid ${color};">${message}</p>
            <p style="margin:0 0 8px;font-size:13px;color:#888;">Source: ${source}</p>
            <a href="https://fieldtek.ai/admin/system-health" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View Dashboard</a>
          </div>
        </div>
      </body></html>`,
    });

    console.log(`[HEALTH-ALERT] Email sent: ${alertType} (${severity})`);
    return new Response(JSON.stringify({ sent: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[HEALTH-ALERT] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
