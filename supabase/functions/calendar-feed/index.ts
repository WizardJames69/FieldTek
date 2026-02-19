import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format a date/time to iCalendar DTSTART/DTEND
function formatICalDate(dateStr: string, timeStr: string | null, durationMin: number | null): { start: string; end: string } {
  // Parse date
  const [year, month, day] = dateStr.split("-").map(Number);
  
  if (!timeStr) {
    // All-day event
    const startDate = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
    // End date for all-day is the next day in iCal
    const endDateObj = new Date(year, month - 1, day + 1);
    const endDate = `${endDateObj.getFullYear()}${String(endDateObj.getMonth() + 1).padStart(2, "0")}${String(endDateObj.getDate()).padStart(2, "0")}`;
    return { start: `VALUE=DATE:${startDate}`, end: `VALUE=DATE:${endDate}` };
  }

  const [hour, minute] = timeStr.split(":").map(Number);
  const startMs = new Date(year, month - 1, day, hour, minute).getTime();
  const endMs = startMs + ((durationMin ?? 60) * 60 * 1000);

  const fmt = (ms: number) => {
    const d = new Date(ms);
    return (
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}` +
      `T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`
    );
  };

  return { start: fmt(startMs), end: fmt(endMs) };
}

// Escape iCal text values
function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

// Fold long iCal lines at 75 octets
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

function formatLastModified(updatedAt: string): string {
  const d = new Date(updatedAt);
  return (
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}` +
    `T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract token from URL path: /calendar-feed/TOKEN.ics
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const tokenFile = pathParts[pathParts.length - 1]; // e.g. "abc123.ics"
    const icalToken = tokenFile.replace(/\.ics$/, "");

    if (!icalToken || icalToken.length < 10) {
      return new Response("Not Found", { status: 404 });
    }

    // Use service role to bypass RLS — the token IS the credential
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("calendar_sync_tokens")
      .select("user_id, tenant_id")
      .eq("ical_token", icalToken)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response("Not Found", { status: 404 });
    }

    const { user_id, tenant_id } = tokenRow;

    // Date range: past 30 days to next 90 days
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 30);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 90);

    const startStr = pastDate.toISOString().split("T")[0];
    const endStr = futureDate.toISOString().split("T")[0];

    // Fetch assigned jobs
    const { data: jobs, error: jobsErr } = await supabase
      .from("scheduled_jobs")
      .select(`
        id,
        title,
        description,
        job_type,
        scheduled_date,
        scheduled_time,
        estimated_duration,
        address,
        status,
        notes,
        updated_at,
        client:clients(name)
      `)
      .eq("tenant_id", tenant_id)
      .eq("assigned_to", user_id)
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", startStr)
      .lte("scheduled_date", endStr)
      .order("scheduled_date", { ascending: true });

    if (jobsErr) {
      console.error("Jobs query error:", jobsErr);
      return new Response("Internal Server Error", { status: 500 });
    }

    // Build iCal output
    const now_stamp = formatLastModified(new Date().toISOString());
    const vevents = (jobs ?? []).map((job) => {
      const { start, end } = formatICalDate(
        job.scheduled_date!,
        job.scheduled_time,
        job.estimated_duration
      );

      const isAllDay = !job.scheduled_time;
      const dtstart = isAllDay ? `DTSTART;${start}` : `DTSTART:${start}`;
      const dtend = isAllDay ? `DTEND;${end}` : `DTEND:${end}`;

      const status = job.status === "cancelled" ? "CANCELLED" : "CONFIRMED";

      // Build description
      const descParts: string[] = [];
      if (job.job_type) descParts.push(`Type: ${job.job_type}`);
      if ((job.client as { name?: string } | null)?.name) descParts.push(`Client: ${(job.client as { name: string }).name}`);
      if (job.description) descParts.push(job.description);
      if (job.notes) descParts.push(`Notes: ${job.notes}`);

      const lines = [
        "BEGIN:VEVENT",
        foldLine(`UID:job-${job.id}@fieldtek.ai`),
        `DTSTAMP:${now_stamp}`,
        foldLine(`LAST-MODIFIED:${formatLastModified(job.updated_at)}`),
        foldLine(dtstart),
        foldLine(dtend),
        foldLine(`SUMMARY:${escapeIcal(job.title)}`),
        `STATUS:${status}`,
      ];

      if (descParts.length > 0) {
        lines.push(foldLine(`DESCRIPTION:${escapeIcal(descParts.join("\\n"))}`));
      }
      if (job.address) {
        lines.push(foldLine(`LOCATION:${escapeIcal(job.address)}`));
      }

      lines.push("END:VEVENT");
      return lines.join("\r\n");
    });

    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FieldTek//FieldTek Jobs//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:FieldTek Jobs",
      "X-WR-CALDESC:Your assigned jobs from FieldTek",
      "X-WR-TIMEZONE:UTC",
      ...vevents,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ical, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="fieldtek-jobs.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (err) {
    console.error("calendar-feed error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
