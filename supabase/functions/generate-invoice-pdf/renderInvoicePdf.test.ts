// PR-APP-6: unit coverage for the real-PDF renderer. The pure helpers are tested
// directly; renderInvoicePdf is smoke-tested for a valid %PDF byte stream across
// empty / large / hostile inputs so a bad invoice can never 500 the download.
// Run: deno test --allow-env --allow-read supabase/functions/generate-invoice-pdf/

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  formatDate,
  formatMoney,
  hexToRgb,
  renderInvoicePdf,
  sanitizeWinAnsi,
  wrapText,
  type InvoicePdfInput,
} from "./renderInvoicePdf.ts";

const pdfHeader = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5));

// ── sanitizeWinAnsi ──
Deno.test("sanitizeWinAnsi keeps Latin-1, replaces non-WinAnsi with '?'", () => {
  assertEquals(sanitizeWinAnsi("Acme Café & Sons"), "Acme Café & Sons"); // é is WinAnsi
  assertEquals(sanitizeWinAnsi("emoji 🚀 here"), "emoji ? here");
  assertEquals(sanitizeWinAnsi("字 CJK"), "? CJK");
  assertEquals(sanitizeWinAnsi(null), "");
  assertEquals(sanitizeWinAnsi(undefined), "");
  assertEquals(sanitizeWinAnsi(42), "42");
});

// ── hexToRgb ──
Deno.test("hexToRgb parses valid hex and falls back on garbage", () => {
  const navy = hexToRgb("#1e3a5f");
  assertEquals(
    [Math.round(navy.red * 255), Math.round(navy.green * 255), Math.round(navy.blue * 255)],
    [0x1e, 0x3a, 0x5f],
  );
  const short = hexToRgb("#abc");
  assertEquals(Math.round(short.red * 255), 0xaa);
  // invalid → default navy (not a throw)
  const fb = hexToRgb("not-a-color");
  assertEquals(Math.round(fb.red * 255), 0x1e);
  assertEquals(Math.round(hexToRgb(null).red * 255), 0x1e);
});

// ── formatMoney / formatDate ──
Deno.test("formatMoney handles null, numbers, strings", () => {
  assertEquals(formatMoney(null), "$0.00");
  assertEquals(formatMoney(150), "$150.00");
  assertEquals(formatMoney(9.5), "$9.50");
  assertEquals(formatMoney(undefined), "$0.00");
});
Deno.test("formatDate handles null and invalid", () => {
  assertEquals(formatDate(null), "-");
  assertEquals(formatDate("nonsense"), "-");
  assertStringIncludes(formatDate("2026-08-01T00:00:00Z"), "2026");
});

// ── wrapText (injected measurer, no pdf-lib font) ──
Deno.test("wrapText greedily wraps by measured width", () => {
  const measure = (s: string) => s.length;
  assertEquals(wrapText("the quick brown fox", 10, measure), ["the quick", "brown fox"]);
  assertEquals(wrapText("", 10, measure), [""]);
  assertEquals(wrapText("   ", 10, measure), [""]);
});
Deno.test("wrapText hard-breaks a single over-long word", () => {
  const measure = (s: string) => s.length;
  assertEquals(wrapText("abcdefghij", 5, measure), ["abcde", "fghij"]);
});

// ── renderInvoicePdf smoke ──
const baseInput: InvoicePdfInput = {
  invoice: {
    invoice_number: "INV-1042",
    status: "sent",
    created_at: "2026-07-01T00:00:00Z",
    due_date: "2026-08-01T00:00:00Z",
    subtotal: 150,
    tax_amount: 12,
    total: 162,
    notes: "Net 30. Thanks!",
    clients: { name: "Jane Doe", address: "1 Main St", city: "Vancouver", state: "BC", zip_code: "V5K", email: "j@x.co", phone: "555-1" },
    scheduled_jobs: { title: "Furnace repair" },
  },
  tenant: { name: "North Shore HVAC", address: "2 King St", phone: "555-2", email: "ops@ns.co" },
  branding: { company_name: "North Shore HVAC", primary_color: "#1e3a5f" },
  lineItems: [
    { description: "Labor - 2 hours", quantity: 2, unit_price: 75, total: 150 },
  ],
  generatedAt: "2026-07-17T00:00:00Z",
};

Deno.test("renderInvoicePdf returns a valid %PDF stream", async () => {
  const bytes = await renderInvoicePdf(baseInput);
  assert(bytes instanceof Uint8Array);
  assert(bytes.length > 500);
  assertEquals(pdfHeader(bytes), "%PDF-");
});

Deno.test("renderInvoicePdf handles no line items", async () => {
  const bytes = await renderInvoicePdf({ ...baseInput, lineItems: [] });
  assertEquals(pdfHeader(bytes), "%PDF-");
});

Deno.test("renderInvoicePdf paginates many line items without throwing", async () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    description: `Line item ${i} with a fairly long description that should wrap across the column width more than once to exercise wrapping`,
    quantity: i + 1,
    unit_price: 10 + i,
    total: (i + 1) * (10 + i),
  }));
  const bytes = await renderInvoicePdf({ ...baseInput, lineItems: many });
  assertEquals(pdfHeader(bytes), "%PDF-");
  assert(bytes.length > 2000);
});

Deno.test("renderInvoicePdf tolerates hostile / missing fields (never throws)", async () => {
  const bytes = await renderInvoicePdf({
    invoice: {
      invoice_number: "🚀INV/异", // non-WinAnsi must not throw
      status: "weird-status",
      clients: null,
      scheduled_jobs: null,
      notes: "字 emoji 🚀 note",
    },
    tenant: null,
    branding: null,
    lineItems: null,
  });
  assertEquals(pdfHeader(bytes), "%PDF-");
});
