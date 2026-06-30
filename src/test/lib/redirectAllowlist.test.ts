import { describe, it, expect } from "vitest";
import {
  resolveSafeRedirect,
  parseAllowedHosts,
  DEFAULT_SAFE_REDIRECT,
} from "../../../supabase/functions/_shared/redirectAllowlist";

// Pins the auth-email redirect allowlist so a localhost/untrusted origin can never
// reach a production verification email (the bug that shipped redirect_to=http://localhost:3000).

describe("resolveSafeRedirect", () => {
  it("returns the fallback for missing input", () => {
    expect(resolveSafeRedirect(undefined)).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect(null)).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("")).toBe(DEFAULT_SAFE_REDIRECT);
  });

  it("rejects http://localhost:3000 → fallback (the original incident)", () => {
    expect(resolveSafeRedirect("http://localhost:3000")).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("http://localhost:3000/dashboard")).toBe(DEFAULT_SAFE_REDIRECT);
  });

  it("rejects any non-HTTPS scheme (incl. http on an allowed host)", () => {
    expect(resolveSafeRedirect("http://fieldtek.ai/dashboard")).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("ftp://fieldtek.ai")).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("javascript:alert(1)")).toBe(DEFAULT_SAFE_REDIRECT);
  });

  it("rejects non-allowlisted hosts (incl. lookalike subdomains and IPs)", () => {
    expect(resolveSafeRedirect("https://evil.com/dashboard")).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("https://fieldtek.ai.evil.com")).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("https://phish-fieldtek.ai")).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("https://127.0.0.1")).toBe(DEFAULT_SAFE_REDIRECT);
  });

  it("rejects malformed / non-absolute input → fallback", () => {
    expect(resolveSafeRedirect("/dashboard")).toBe(DEFAULT_SAFE_REDIRECT);
    expect(resolveSafeRedirect("not a url")).toBe(DEFAULT_SAFE_REDIRECT);
  });

  it("passes through allowlisted apex + www HTTPS hosts", () => {
    expect(resolveSafeRedirect("https://fieldtek.ai/dashboard")).toBe("https://fieldtek.ai/dashboard");
    expect(resolveSafeRedirect("https://www.fieldtek.ai/dashboard")).toBe("https://www.fieldtek.ai/dashboard");
  });

  it("preserves path + query for allowlisted hosts (e.g. invite token)", () => {
    const url = "https://fieldtek.ai/accept-invite?token=abc123";
    expect(resolveSafeRedirect(url)).toBe(url);
  });

  it("is case-insensitive on the host", () => {
    expect(resolveSafeRedirect("https://FieldTek.ai/dashboard")).toBe("https://fieldtek.ai/dashboard");
  });

  it("honors a custom allowlist + fallback override", () => {
    expect(
      resolveSafeRedirect("https://staging.fieldtek.ai/x", {
        allowedHosts: ["staging.fieldtek.ai"],
        fallback: "https://fieldtek.ai/home",
      }),
    ).toBe("https://staging.fieldtek.ai/x");
    expect(
      resolveSafeRedirect("https://fieldtek.ai/x", {
        allowedHosts: ["staging.fieldtek.ai"],
        fallback: "https://fieldtek.ai/home",
      }),
    ).toBe("https://fieldtek.ai/home");
  });
});

describe("parseAllowedHosts", () => {
  it("returns undefined for empty/missing input (caller uses defaults)", () => {
    expect(parseAllowedHosts(undefined)).toBeUndefined();
    expect(parseAllowedHosts("")).toBeUndefined();
    expect(parseAllowedHosts("   ")).toBeUndefined();
  });

  it("splits on commas/whitespace and lowercases", () => {
    expect(parseAllowedHosts("fieldtek.ai, www.fieldtek.ai")).toEqual(["fieldtek.ai", "www.fieldtek.ai"]);
    expect(parseAllowedHosts("Fieldtek.AI  Staging.Fieldtek.AI")).toEqual(["fieldtek.ai", "staging.fieldtek.ai"]);
  });
});
