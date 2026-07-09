import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// jsdom does not load external stylesheets, so these are source-level
// assertions on src/index.css. They guard the regression from fb36a43, where
// the GLOBAL light-theme --background was switched to a near-black value to
// style the landing page — pairing it with the dark --foreground and breaking
// every in-app surface (dark text on dark background on the technician mobile
// job sheet, grey-on-grey cards, invisible buttons).
const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");

/** The :root block (default/light theme tokens). */
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));

describe("theme tokens (index.css)", () => {
  it("light theme pairs a light --background with the dark --foreground", () => {
    const bg = rootBlock.match(/--background:\s*([\d.]+)\s+[\d.]+%\s+([\d.]+)%/);
    const fg = rootBlock.match(/--foreground:\s*([\d.]+)\s+[\d.]+%\s+([\d.]+)%/);
    expect(bg, "--background must be defined in :root").toBeTruthy();
    expect(fg, "--foreground must be defined in :root").toBeTruthy();

    const bgLightness = parseFloat(bg![2]);
    const fgLightness = parseFloat(fg![2]);
    // Light theme: background must be light, text dark — and far apart.
    expect(bgLightness, "light-theme --background lightness").toBeGreaterThan(80);
    expect(fgLightness, "light-theme --foreground lightness").toBeLessThan(30);
  });

  it("dark landing backdrop is scoped, not global", () => {
    // The dark canvas the landing needs lives on scoped selectors only.
    expect(css).toMatch(/html\.landing-html-bg/);
    expect(css).toMatch(/\.landing-page/);
    // And the :root background is not the old near-black landing value.
    expect(rootBlock).not.toContain("220 13% 4%");
  });

  it("sticky sheet headers carry a solid background (must not be transparent)", () => {
    // The glass-morphism class these headers used was removed in the PR-APP-4
    // register strip; the headers now use bg-card directly. When the surface
    // rule was missing once before, scrolled content showed through the sticky
    // sheet title.
    const myJobs = readFileSync(resolve(__dirname, "../../pages/MyJobs.tsx"), "utf8");
    const myCalendar = readFileSync(resolve(__dirname, "../../pages/MyCalendar.tsx"), "utf8");
    expect(myJobs).toMatch(/sticky top-0 bg-card/);
    expect(myCalendar).toMatch(/sticky top-0 bg-card/);
  });
});
