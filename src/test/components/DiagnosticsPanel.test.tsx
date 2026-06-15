import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { DiagnosticsContent } from "@/components/support/DiagnosticsPanel";

// Sonner toast — assert the copy success/failure messaging.
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

// Shared offline-sync state (H1 single-engine context).
vi.mock("@/contexts/OfflineSyncContext", () => ({
  useOfflineSyncContext: () => ({
    isOnline: true,
    isSyncing: false,
    pendingCount: 3,
    lastSyncAt: null,
    syncErrors: ["one error"],
  }),
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenant: { name: "ACME HVAC", id: "tenant-uuid-123" },
    role: "technician",
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "tech@example.com" } }),
}));

vi.mock("@/lib/errorTracking", () => ({ getSessionId: () => "SESSION-XYZ" }));

// Keep the real (safe) builders/parsers; only inject controlled sources so we
// can verify a credential-laden URL never reaches the UI.
vi.mock("@/lib/diagnostics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/diagnostics")>();
  return {
    ...actual,
    collectSources: () => ({
      appVersion: "2026.06.15.1",
      mode: "production",
      supabaseUrl:
        "https://fgemfxhwushaiiguqxfe.supabase.co/auth/v1?apikey=eyJhbGciOiJSUPER.SECRET",
      serviceWorkerSupported: true,
      serviceWorkerControlling: true,
      displayMode: "standalone" as const,
    }),
  };
});

function mockClipboard(impl?: () => Promise<void>) {
  const writeText = vi.fn(impl ?? (() => Promise.resolve()));
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe("DiagnosticsContent", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders the safe diagnostic fields", () => {
    render(<DiagnosticsContent />);
    expect(screen.getByText("2026.06.15.1")).toBeInTheDocument();
    expect(screen.getByText("fgemfxhwushaiiguqxfe")).toBeInTheDocument();
    expect(screen.getByText("ACME HVAC")).toBeInTheDocument();
    expect(screen.getByText("tech@example.com")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    // pending count
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("never renders secret-like values from the backend URL", () => {
    const { container } = render(<DiagnosticsContent />);
    const text = container.textContent ?? "";
    expect(text).toContain("fgemfxhwushaiiguqxfe");
    expect(text).not.toContain("eyJ");
    expect(text).not.toContain("apikey");
    expect(text).not.toContain("supabase.co");
    expect(text.toLowerCase()).not.toContain("secret");
  });

  it("copies a safe plain-text summary and confirms with a toast", async () => {
    const writeText = mockClipboard();
    render(<DiagnosticsContent />);

    fireEvent.click(screen.getByRole("button", { name: /copy diagnostics/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("App version: 2026.06.15.1");
    expect(copied).toContain("Backend ref: fgemfxhwushaiiguqxfe");
    expect(copied).toContain("Company: ACME HVAC");
    expect(copied).not.toContain("eyJ");
    expect(copied).not.toContain("supabase.co");

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Diagnostics copied"));
  });

  it("shows an error toast when copying fails", async () => {
    mockClipboard(() => Promise.reject(new Error("denied")));
    render(<DiagnosticsContent />);

    fireEvent.click(screen.getByRole("button", { name: /copy diagnostics/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Couldn't copy diagnostics",
        expect.objectContaining({ description: expect.any(String) })
      )
    );
  });
});
