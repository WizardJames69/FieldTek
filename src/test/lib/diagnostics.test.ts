import { describe, it, expect } from "vitest";
import {
  parseSupabaseProjectRef,
  buildDiagnosticsReport,
  formatDiagnosticsText,
  formatLastSync,
  type DiagnosticsInput,
  type DiagnosticsSources,
} from "@/lib/diagnostics";

const baseSources: DiagnosticsSources = {
  appVersion: "2026.06.15.1",
  mode: "production",
  supabaseUrl: "https://fgemfxhwushaiiguqxfe.supabase.co",
  serviceWorkerSupported: true,
  serviceWorkerControlling: true,
  displayMode: "standalone",
};

const baseInput: DiagnosticsInput = {
  route: "/my-jobs",
  online: true,
  pendingCount: 2,
  isSyncing: false,
  syncErrorCount: 1,
  lastSyncAt: new Date("2026-06-15T17:00:00Z"),
  tenantName: "ACME HVAC",
  tenantId: "tenant-uuid-123",
  userEmail: "tech@example.com",
  role: "technician",
  supportSessionId: "ABC123-XYZ",
};

describe("parseSupabaseProjectRef", () => {
  it("extracts only the project ref from a Supabase URL", () => {
    expect(parseSupabaseProjectRef("https://fgemfxhwushaiiguqxfe.supabase.co")).toBe(
      "fgemfxhwushaiiguqxfe"
    );
  });

  it("returns ONLY the ref even when the URL carries a credential-like query", () => {
    const ref = parseSupabaseProjectRef(
      "https://fgemfxhwushaiiguqxfe.supabase.co/auth/v1?apikey=eyJhbGciOiSUPERSECRET"
    );
    expect(ref).toBe("fgemfxhwushaiiguqxfe");
    expect(ref).not.toContain("eyJ");
    expect(ref).not.toContain("apikey");
  });

  it("returns null for a non-Supabase host", () => {
    expect(parseSupabaseProjectRef("https://example.com")).toBeNull();
    expect(parseSupabaseProjectRef("http://localhost:8080")).toBeNull();
  });

  it("returns null for missing / malformed input", () => {
    expect(parseSupabaseProjectRef(undefined)).toBeNull();
    expect(parseSupabaseProjectRef("")).toBeNull();
    expect(parseSupabaseProjectRef("not a url")).toBeNull();
  });
});

describe("formatLastSync", () => {
  it("renders 'Never' for null/undefined", () => {
    expect(formatLastSync(null)).toBe("Never");
    expect(formatLastSync(undefined)).toBe("Never");
  });

  it("renders 'Unknown' for an unparseable date", () => {
    expect(formatLastSync("not-a-date")).toBe("Unknown");
  });

  it("renders a human-readable string for a valid date", () => {
    expect(formatLastSync(new Date("2026-06-15T17:00:00Z"))).not.toBe("Never");
    expect(formatLastSync(new Date("2026-06-15T17:00:00Z"))).not.toBe("Unknown");
  });
});

describe("buildDiagnosticsReport", () => {
  it("maps app state + sources into a safe report", () => {
    const report = buildDiagnosticsReport(baseInput, baseSources);
    expect(report.appVersion).toBe("2026.06.15.1");
    expect(report.mode).toBe("production");
    expect(report.route).toBe("/my-jobs");
    expect(report.backendRef).toBe("fgemfxhwushaiiguqxfe");
    expect(report.connection).toBe("Online");
    expect(report.serviceWorker).toBe("Active (controlling this page)");
    expect(report.displayMode).toBe("standalone");
    expect(report.pendingCount).toBe(2);
    expect(report.syncing).toBe(false);
    expect(report.syncErrorCount).toBe(1);
    expect(report.tenant).toBe("ACME HVAC");
    expect(report.account).toBe("tech@example.com");
    expect(report.role).toBe("technician");
    expect(report.supportSessionId).toBe("ABC123-XYZ");
  });

  it("reports Offline when not online", () => {
    expect(buildDiagnosticsReport({ ...baseInput, online: false }, baseSources).connection).toBe(
      "Offline"
    );
  });

  it("describes service-worker states correctly", () => {
    expect(
      buildDiagnosticsReport(baseInput, {
        ...baseSources,
        serviceWorkerSupported: false,
      }).serviceWorker
    ).toBe("Not supported");
    expect(
      buildDiagnosticsReport(baseInput, {
        ...baseSources,
        serviceWorkerControlling: false,
      }).serviceWorker
    ).toBe("Registered, not controlling yet");
  });

  it("collapses missing values to Unknown / Not available rather than leaking blanks", () => {
    const report = buildDiagnosticsReport(
      {
        route: "",
        online: false,
        pendingCount: 0,
        isSyncing: false,
        syncErrorCount: 0,
        lastSyncAt: null,
        tenantName: null,
        tenantId: undefined,
        userEmail: "   ",
        role: null,
        supportSessionId: null,
      },
      {
        appVersion: "",
        mode: "",
        supabaseUrl: undefined,
        serviceWorkerSupported: false,
        serviceWorkerControlling: false,
        displayMode: "unknown",
      }
    );
    expect(report.appVersion).toBe("Unknown");
    expect(report.mode).toBe("Unknown");
    expect(report.route).toBe("Unknown");
    expect(report.backendRef).toBe("Unknown");
    expect(report.lastSync).toBe("Never");
    expect(report.tenant).toBe("Not available");
    expect(report.tenantId).toBe("Not available");
    expect(report.account).toBe("Not available");
    expect(report.role).toBe("Not available");
    expect(report.supportSessionId).toBe("Not available");
  });
});

describe("formatDiagnosticsText", () => {
  it("includes the safe fields", () => {
    const text = formatDiagnosticsText(buildDiagnosticsReport(baseInput, baseSources));
    expect(text).toContain("FieldTek diagnostics");
    expect(text).toContain("App version: 2026.06.15.1");
    expect(text).toContain("Route: /my-jobs");
    expect(text).toContain("Backend ref: fgemfxhwushaiiguqxfe");
    expect(text).toContain("Connection: Online");
    expect(text).toContain("Pending sync: 2");
    expect(text).toContain("Company: ACME HVAC");
    expect(text).toContain("Account: tech@example.com");
  });

  it("never leaks secret-like values even when the source URL carries them", () => {
    const text = formatDiagnosticsText(
      buildDiagnosticsReport(baseInput, {
        ...baseSources,
        supabaseUrl:
          "https://fgemfxhwushaiiguqxfe.supabase.co/rest/v1?apikey=eyJhbGciOiJSUPER.SECRET.TOKEN",
      })
    );
    expect(text).toContain("Backend ref: fgemfxhwushaiiguqxfe");
    expect(text).not.toContain("eyJ");
    expect(text).not.toContain("apikey");
    expect(text).not.toContain("supabase.co");
    expect(text.toLowerCase()).not.toContain("secret");
  });

  it("includes the generated timestamp only when provided", () => {
    const report = buildDiagnosticsReport(baseInput, baseSources);
    expect(formatDiagnosticsText(report)).not.toContain("Generated:");
    expect(formatDiagnosticsText(report, "2026-06-15 10:00")).toContain(
      "Generated: 2026-06-15 10:00"
    );
  });
});
