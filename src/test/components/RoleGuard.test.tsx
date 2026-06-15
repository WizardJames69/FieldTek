import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Configurable context mocks so each test can set the auth/tenant state.
const {
  mockNavigate,
  mockToast,
  useAuthMock,
  useTenantMock,
  signOutMock,
  refreshTenantMock,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: vi.fn(),
  useAuthMock: vi.fn(),
  useTenantMock: vi.fn(),
  signOutMock: vi.fn(),
  refreshTenantMock: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: useAuthMock }));
vi.mock("@/contexts/TenantContext", () => ({ useTenant: useTenantMock }));

import { RoleGuard } from "@/components/auth/RoleGuard";

describe("RoleGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue(undefined);
    refreshTenantMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: { id: "u1" },
      loading: false,
      signOut: signOutMock,
    });
    useTenantMock.mockReturnValue({
      role: "technician",
      loading: false,
      refreshTenant: refreshTenantMock,
    });
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

  it("shows the loading UI (not children, not the fallback) while loading", () => {
    useTenantMock.mockReturnValue({
      role: null,
      loading: true,
      refreshTenant: refreshTenantMock,
    });
    render(
      <RoleGuard allowedRoles={["technician"]}>
        <div>tech content</div>
      </RoleGuard>
    );
    expect(screen.queryByText("tech content")).toBeNull();
    expect(screen.queryByText("Couldn't load your workspace")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("toasts and redirects a truthy-but-disallowed role by default", () => {
    useTenantMock.mockReturnValue({
      role: "technician",
      loading: false,
      refreshTenant: refreshTenantMock,
    });
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

  it("silent: redirects a disallowed role without the Access denied toast", () => {
    useTenantMock.mockReturnValue({
      role: "technician",
      loading: false,
      refreshTenant: refreshTenantMock,
    });
    render(
      <RoleGuard allowedRoles={["owner", "admin"]} fallbackPath="/my-jobs" silent>
        <div>admin content</div>
      </RoleGuard>
    );
    expect(screen.queryByText("admin content")).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/my-jobs", { replace: true });
  });

  it("renders the recovery fallback (not a blank page) for an unresolved/null role", () => {
    useTenantMock.mockReturnValue({
      role: null,
      loading: false,
      refreshTenant: refreshTenantMock,
    });
    render(
      <RoleGuard allowedRoles={["technician"]}>
        <div>tech content</div>
      </RoleGuard>
    );
    expect(screen.getByText("Couldn't load your workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    // Children are NOT rendered — a missing role must not pass through.
    expect(screen.queryByText("tech content")).toBeNull();
    // No redirect for the null-role case (only truthy-but-disallowed redirects).
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("Retry re-runs the TenantContext fetch (refreshTenant), no redirect/mutation", async () => {
    useTenantMock.mockReturnValue({
      role: null,
      loading: false,
      refreshTenant: refreshTenantMock,
    });
    render(
      <RoleGuard allowedRoles={["technician"]}>
        <div>tech content</div>
      </RoleGuard>
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(refreshTenantMock).toHaveBeenCalledTimes(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("Sign out uses the cleanup-wrapped AuthContext signOut helper", async () => {
    useTenantMock.mockReturnValue({
      role: null,
      loading: false,
      refreshTenant: refreshTenantMock,
    });
    render(
      <RoleGuard allowedRoles={["technician"]}>
        <div>tech content</div>
      </RoleGuard>
    );
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
  });
});
