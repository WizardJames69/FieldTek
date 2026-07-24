// Week 0 D2 regression: the automated sweep must never email a customer of
// a tenant that has not explicitly opted in (founder decision 3: default
// OFF), while the manual per-invoice reminder — an explicit human action —
// is never blocked by the flag. This is the flag-ON/flag-OFF send-path
// matrix; asserting it here (pure, no Resend) is the founder-approved
// alternative to an e2e test that would email live addresses on every CI
// run. Run: deno test --allow-env supabase/functions/send-invoice-reminder/

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { shouldSendReminder } from "./sweepPolicy.ts";

Deno.test("sweep + opted-in tenant → sends", () => {
  const d = shouldSendReminder({ sweepMode: true, tenantOptIn: true });
  assertEquals(d.send, true);
});

Deno.test("sweep + opted-out tenant (explicit false) → skipped", () => {
  const d = shouldSendReminder({ sweepMode: true, tenantOptIn: false });
  assertEquals(d.send, false);
  assertEquals(d.skipReason, "Reminders disabled for tenant");
});

Deno.test("sweep + null flag → skipped (no accidental opt-in)", () => {
  const d = shouldSendReminder({ sweepMode: true, tenantOptIn: null });
  assertEquals(d.send, false);
});

Deno.test("sweep + missing tenant_settings row → skipped (fail-safe)", () => {
  const d = shouldSendReminder({ sweepMode: true, tenantOptIn: undefined });
  assertEquals(d.send, false);
});

Deno.test("manual per-invoice reminder ignores an off flag", () => {
  const d = shouldSendReminder({ sweepMode: false, tenantOptIn: false });
  assertEquals(d.send, true);
});

Deno.test("manual per-invoice reminder with no settings row still sends", () => {
  const d = shouldSendReminder({ sweepMode: false, tenantOptIn: undefined });
  assertEquals(d.send, true);
});
