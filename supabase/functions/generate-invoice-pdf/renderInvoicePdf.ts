// ============================================================
// generate-invoice-pdf — real PDF rendering (PR-APP-6)
// ============================================================
// Side-effect-free (no top-level I/O or server startup) so the pure helpers can
// be imported directly by renderInvoicePdf.test.ts — same pattern as
// authorize.ts. index.ts fetches the invoice/tenant/branding/line-items (with
// the service-role client, AFTER the B1 authorization gate) and hands the data
// here; this module returns the finished PDF bytes.
//
// pdf-lib is pure JS/Wasm-free and runs in the Supabase Deno edge runtime — no
// headless Chrome (which the runtime can't launch). Standard Helvetica is a
// WinAnsi font, so all caller text is sanitized to WinAnsi before drawing.

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "https://esm.sh/pdf-lib@1.17.1";

export interface InvoicePdfInput {
  invoice: {
    invoice_number?: string | null;
    status?: string | null;
    created_at?: string | null;
    due_date?: string | null;
    subtotal?: number | null;
    tax_amount?: number | null;
    total?: number | null;
    notes?: string | null;
    clients?: {
      name?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      zip_code?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    scheduled_jobs?: { title?: string | null } | null;
  };
  tenant?: { name?: string | null; address?: string | null; phone?: string | null; email?: string | null } | null;
  branding?: { company_name?: string | null; primary_color?: string | null } | null;
  lineItems?: Array<{
    description?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total?: number | null;
  }> | null;
  /** Optional fixed "generated on" date (ISO). Injected in tests for determinism. */
  generatedAt?: string;
}

const DEFAULT_PRIMARY = "#1e3a5f";

// ── Pure helpers (unit-tested without pdf-lib) ──────────────

// WinAnsi (CP1252) can't encode codepoints above 0xFF or a handful of holes;
// pdf-lib's StandardFont.encodeText throws on anything it can't map. Real-world
// invoice text (names, notes) may contain emoji/CJK/smart-quotes, so replace
// unmappable characters rather than 500 the whole download.
const WINANSI_HOLES = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);
export function sanitizeWinAnsi(input: unknown): string {
  if (input === null || input === undefined) return "";
  let out = "";
  for (const ch of String(input)) {
    const cp = ch.codePointAt(0)!;
    out += cp > 0xff || cp === 0x7f || WINANSI_HOLES.has(cp) ? "?" : ch;
  }
  return out;
}

export function hexToRgb(hex: string | null | undefined): RGB {
  const fallback = rgb(0x1e / 255, 0x3a / 255, 0x5f / 255);
  if (!hex) return fallback;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return fallback;
  const n = parseInt(h, 16);
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

export function formatMoney(n: number | null | undefined): string {
  const v = Number(n);
  return `$${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Greedy word-wrap. `measure` returns the rendered width of a string; it is
 * injected so the wrapping logic is testable without a pdf-lib font. A single
 * word wider than `maxWidth` is hard-broken so it never overflows the column.
 */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const clean = sanitizeWinAnsi(text).replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of clean.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else if (!line && measure(word) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (chunk && measure(chunk + ch) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const STATUS_STYLE: Record<string, { bg: RGB; fg: RGB }> = {
  draft: { bg: rgb(0.953, 0.957, 0.965), fg: rgb(0.42, 0.447, 0.502) },
  sent: { bg: rgb(0.859, 0.918, 0.996), fg: rgb(0.114, 0.306, 0.847) },
  paid: { bg: rgb(0.863, 0.988, 0.906), fg: rgb(0.082, 0.502, 0.239) },
  overdue: { bg: rgb(0.996, 0.886, 0.886), fg: rgb(0.863, 0.149, 0.149) },
  cancelled: { bg: rgb(0.953, 0.957, 0.965), fg: rgb(0.42, 0.447, 0.502) },
};

// ── PDF rendering ───────────────────────────────────────────

const PAGE_W = 612;
const PAGE_H = 792;
const M = 40; // margin
const RIGHT = PAGE_W - M;
const FOOTER_RESERVE = 70;

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { invoice, tenant, branding, generatedAt } = input;
  const lineItems = input.lineItems ?? [];
  const primary = hexToRgb(branding?.primary_color || DEFAULT_PRIMARY);
  const companyName = branding?.company_name || tenant?.name || "Company";

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const DARK = rgb(0.2, 0.2, 0.2);
  const GRAY = rgb(0.4, 0.4, 0.4);
  const LIGHT = rgb(0.9, 0.9, 0.9);
  const WHITE = rgb(1, 1, 1);

  const draw = (p: PDFPage, s: string, x: number, y: number, size: number, f: PDFFont = font, color: RGB = DARK) =>
    p.drawText(sanitizeWinAnsi(s), { x, y, size, font: f, color });
  const drawRight = (p: PDFPage, s: string, xRight: number, y: number, size: number, f: PDFFont = font, color: RGB = DARK) => {
    const clean = sanitizeWinAnsi(s);
    p.drawText(clean, { x: xRight - f.widthOfTextAtSize(clean, size), y, size, font: f, color });
  };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  // ── Header ──
  draw(page, companyName, M, y - 16, 22, bold, primary);
  let hy = y - 16 - 14;
  for (const line of [
    tenant?.address,
    tenant?.phone ? `Phone: ${tenant.phone}` : null,
    tenant?.email ? `Email: ${tenant.email}` : null,
  ]) {
    if (line) {
      draw(page, String(line), M, hy, 9, font, GRAY);
      hy -= 12;
    }
  }
  drawRight(page, "INVOICE", RIGHT, y - 18, 26, bold, primary);
  drawRight(page, invoice.invoice_number || "", RIGHT, y - 34, 11, bold, DARK);

  y = Math.min(hy, y - 44) - 6;
  page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 2, color: primary });
  y -= 26;

  // ── Bill To / Invoice Details ──
  const colR = M + 300;
  draw(page, "BILL TO", M, y, 10, bold, primary);
  draw(page, "INVOICE DETAILS", colR, y, 10, bold, primary);
  page.drawLine({ start: { x: M, y: y - 4 }, end: { x: M + 266, y: y - 4 }, thickness: 0.5, color: LIGHT });
  page.drawLine({ start: { x: colR, y: y - 4 }, end: { x: RIGHT, y: y - 4 }, thickness: 0.5, color: LIGHT });

  // left column: client
  const c = invoice.clients;
  const clientLines: string[] = [];
  if (c) {
    if (c.name) clientLines.push(c.name);
    if (c.address) clientLines.push(c.address);
    const cityLine = [c.city, c.state, c.zip_code].filter(Boolean).join(", ");
    if (cityLine) clientLines.push(cityLine);
    if (c.email) clientLines.push(c.email);
    if (c.phone) clientLines.push(c.phone);
  }
  if (clientLines.length === 0) clientLines.push("-");
  let ly = y - 18;
  clientLines.forEach((l, i) => {
    draw(page, String(l), M, ly, i === 0 ? 10 : 9, i === 0 ? bold : font);
    ly -= 13;
  });

  // right column: details
  let ry = y - 18;
  const detailRow = (label: string, value: string) => {
    draw(page, label, colR, ry, 9, bold);
    draw(page, value, colR + bold.widthOfTextAtSize(label, 9) + 4, ry, 9, font);
    ry -= 13;
  };
  detailRow("Invoice Date:", formatDate(invoice.created_at));
  detailRow("Due Date:", formatDate(invoice.due_date));
  if (invoice.scheduled_jobs?.title) detailRow("Job:", invoice.scheduled_jobs.title);

  // status badge
  const status = (invoice.status || "draft").toLowerCase();
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  const badgeText = status.toUpperCase();
  const badgeW = bold.widthOfTextAtSize(badgeText, 8) + 16;
  ry -= 4;
  page.drawRectangle({ x: colR, y: ry - 10, width: badgeW, height: 16, color: style.bg });
  draw(page, badgeText, colR + 8, ry - 6, 8, bold, style.fg);
  ry -= 20;

  y = Math.min(ly, ry) - 12;

  // ── Line-items table (paginating) ──
  const DESC_X = M;
  const QTY_X = M + 300;
  const UNIT_X = M + 372;
  const AMT_RIGHT = RIGHT;
  const DESC_W = 288;
  const ROW_PAD = 8;
  const LINE_H = 12;

  const drawTableHeader = (p: PDFPage, top: number): number => {
    p.drawRectangle({ x: M, y: top - 18, width: RIGHT - M, height: 20, color: primary });
    const ty = top - 13;
    draw(p, "DESCRIPTION", DESC_X + 6, ty, 9, bold, WHITE);
    draw(p, "QTY", QTY_X, ty, 9, bold, WHITE);
    draw(p, "UNIT PRICE", UNIT_X, ty, 9, bold, WHITE);
    drawRight(p, "AMOUNT", AMT_RIGHT - 6, ty, 9, bold, WHITE);
    return top - 22;
  };

  const newPage = (): number => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    return PAGE_H - M;
  };

  y = drawTableHeader(page, y);

  if (lineItems.length === 0) {
    draw(page, "No line items", M + 6, y - 16, 9, font, GRAY);
    y -= 30;
  } else {
    for (const item of lineItems) {
      const descLines = wrapText(item.description ?? "", DESC_W, (s) => font.widthOfTextAtSize(s, 9));
      const rowH = Math.max(descLines.length * LINE_H, LINE_H) + ROW_PAD;
      if (y - rowH < M + FOOTER_RESERVE) {
        y = drawTableHeader(page, newPage());
      }
      const rowTop = y - ROW_PAD / 2;
      descLines.forEach((dl, i) => draw(page, dl, DESC_X + 6, rowTop - 4 - i * LINE_H, 9, font));
      draw(page, String(item.quantity ?? 1), QTY_X, rowTop - 4, 9, font);
      draw(page, formatMoney(item.unit_price), UNIT_X, rowTop - 4, 9, font);
      drawRight(page, formatMoney(item.total), AMT_RIGHT - 6, rowTop - 4, 9, font);
      y -= rowH;
      page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 0.5, color: LIGHT });
    }
  }

  // ── Totals ──
  const needed = 3 * 16 + 20;
  if (y - needed < M + FOOTER_RESERVE) y = newPage();
  y -= 18;
  const totalsLabelX = RIGHT - 200;
  const totalRow = (label: string, value: string, strong = false) => {
    const f = strong ? bold : font;
    const size = strong ? 12 : 10;
    draw(page, label, totalsLabelX, y, size, f, strong ? primary : DARK);
    drawRight(page, value, RIGHT, y, size, f, strong ? primary : DARK);
    y -= strong ? 4 : 2;
    page.drawLine({ start: { x: totalsLabelX, y: y }, end: { x: RIGHT, y: y }, thickness: strong ? 1.5 : 0.5, color: strong ? primary : LIGHT });
    y -= strong ? 16 : 14;
  };
  totalRow("Subtotal", formatMoney(invoice.subtotal));
  totalRow("Tax", formatMoney(invoice.tax_amount));
  totalRow("Total Due", formatMoney(invoice.total), true);

  // ── Notes ──
  if (invoice.notes) {
    const noteLines = wrapText(invoice.notes, RIGHT - M - 24, (s) => font.widthOfTextAtSize(s, 9));
    const boxH = noteLines.length * 12 + 30;
    if (y - boxH < M + 30) y = newPage();
    y -= 10;
    page.drawRectangle({ x: M, y: y - boxH + 14, width: RIGHT - M, height: boxH, color: rgb(0.976, 0.98, 0.984) });
    draw(page, "NOTES", M + 12, y, 9, bold, primary);
    let ny = y - 16;
    for (const nl of noteLines) {
      draw(page, nl, M + 12, ny, 9, font, GRAY);
      ny -= 12;
    }
    y = ny - 14;
  }

  // ── Footer (bottom of the last page) ──
  const genDate = formatDate(generatedAt ?? new Date().toISOString());
  page.drawLine({ start: { x: M, y: M + 34 }, end: { x: RIGHT, y: M + 34 }, thickness: 0.5, color: LIGHT });
  const f1 = "Thank you for your business!";
  page.drawText(f1, { x: (PAGE_W - font.widthOfTextAtSize(f1, 9)) / 2, y: M + 20, size: 9, font, color: GRAY });
  const f2 = `Generated on ${genDate}`;
  page.drawText(f2, { x: (PAGE_W - font.widthOfTextAtSize(f2, 8)) / 2, y: M + 8, size: 8, font, color: rgb(0.6, 0.6, 0.6) });

  return await doc.save();
}
