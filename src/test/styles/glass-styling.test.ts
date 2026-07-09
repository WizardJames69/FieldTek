import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Source-level guards for the PR-APP-4 register strip: overlay primitives must
// carry their own SOLID background. The glass classes they previously relied on
// (dialog-glass / sheet-glass, deleted with the strip) supplied the background
// via !important — removing them without a bg-background fallback shipped
// transparent dialogs once before.
const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

describe("overlay primitives are solid (register strip)", () => {
  it("DialogContent declares bg-background", () => {
    const src = read("../../components/ui/dialog.tsx");
    expect(src).toMatch(/border bg-background p-6/);
    expect(src).not.toContain("dialog-glass");
  });

  it("SheetContent declares bg-background", () => {
    const src = read("../../components/ui/sheet.tsx");
    expect(src).toMatch(/bg-background/);
    expect(src).not.toContain("sheet-glass");
  });

  it("chat bubbles keep their styling classes", () => {
    const css = read("../../index.css");
    expect(css).toMatch(/\.chat-bubble-user\s*{/);
    expect(css).toMatch(/\.chat-bubble-assistant\s*{/);
  });
});
