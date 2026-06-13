import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleGuard } from "@/components/auth/RoleGuard";

// A technician hitting a non-allowed route is redirected to fallbackPath. For
// routes the app itself targets (e.g. /dashboard, the PWA start_url), that
// redirect is the designed flow — `silent` suppresses the "Access denied"
// toast there so technicians don't see a destructive error on every launch.
const { mockNavigate, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "tech-user" }, loading: false }),
}));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ role: "technician", loading: false }),
}));

describe("RoleGuard", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockToast.mockClear();
  });

  it("renders children for an allowed role", () => {
    render(
      <RoleGuard allowedRoles={["technician"]}>
        <div>tech content</div>
      </RoleGuard>
    );
    expect(screen.getByText("tech content")).toBeInTheDocument();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("toasts and redirects a non-allowed role by default", () => {
    render(
      <RoleGuard allowedRoles={["owner", "admin"]} fallbackPath="/my-jobs">
        <div>admin content</div>
      </RoleGuard>
    );
    expect(screen.queryByText("admin content")).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Access denied" })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/my-jobs", { replace: true });
  });

  it("silent: redirects without the Access denied toast", () => {
    render(
      <RoleGuard allowedRoles={["owner", "admin"]} fallbackPath="/my-jobs" silent>
        <div>admin content</div>
      </RoleGuard>
    );
    expect(screen.queryByText("admin content")).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/my-jobs", { replace: true });
  });
});
