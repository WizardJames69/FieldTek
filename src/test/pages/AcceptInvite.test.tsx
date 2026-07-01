import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Configurable mocks so each test drives auth/signUp/rpc state.
const {
  useAuthMock,
  mockNavigate,
  signUpMock,
  signOutMock,
  rpcMock,
  toastSuccess,
  toastError,
  tokenGetMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  mockNavigate: vi.fn(),
  signUpMock: vi.fn(),
  signOutMock: vi.fn(),
  rpcMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  tokenGetMock: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [{ get: tokenGetMock } as unknown as URLSearchParams],
  };
});
vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: useAuthMock }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signUp: signUpMock, signOut: signOutMock },
    rpc: rpcMock,
  },
}));

import AcceptInvite from "@/pages/AcceptInvite";

const TOKEN = "super-secret-invite-token-abc123";
const INVITE = {
  valid: true,
  email: "tech@example.com",
  role: "technician",
  tenant_name: "Jen's HVAC",
};

function loadInvitationOk(acceptResult: unknown = { data: { success: true, tenant_id: "t1" }, error: null }) {
  rpcMock.mockImplementation((fn: string) => {
    if (fn === "get_invitation_by_token") return Promise.resolve({ data: INVITE, error: null });
    if (fn === "accept_team_invitation") return Promise.resolve(acceptResult);
    return Promise.resolve({ data: null, error: null });
  });
}

async function fillAndSubmitSignupForm() {
  const fullName = await screen.findByPlaceholderText("John Doe");
  fireEvent.change(fullName, { target: { value: "Tech Person" } });
  const passwords = document.querySelectorAll('input[type="password"]');
  fireEvent.change(passwords[0], { target: { value: "password123" } });
  fireEvent.change(passwords[1], { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: /create account & join/i }));
}

describe("AcceptInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenGetMock.mockReturnValue(TOKEN);
    useAuthMock.mockReturnValue({ user: null });
    loadInvitationOk();
  });

  it("signUp with no session shows the confirm-email state and does NOT call accept_team_invitation", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });

    render(<AcceptInvite />);
    await fillAndSubmitSignupForm();

    await screen.findByText("Check your email");
    // The RPC that requires a session must not be called before confirmation.
    expect(rpcMock).not.toHaveBeenCalledWith("accept_team_invitation", expect.anything());
    // No confusing failure toast; a success "account created" toast instead.
    expect(toastError).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("signUp with a session completes acceptance immediately and navigates", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "x" } },
      error: null,
    });

    render(<AcceptInvite />);
    await fillAndSubmitSignupForm();

    await waitFor(() =>
      expect(rpcMock).toHaveBeenCalledWith(
        "accept_team_invitation",
        expect.objectContaining({ p_user_id: "u1", p_token: TOKEN }),
      ),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });

  it("maps a raw 'User identity mismatch' error to friendly copy and never shows it raw", async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: "u1" }, session: { access_token: "x" } },
      error: null,
    });
    loadInvitationOk({ data: null, error: { message: "User identity mismatch" } });

    render(<AcceptInvite />);
    await fillAndSubmitSignupForm();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [, opts] = toastError.mock.calls[0];
    expect(opts.description).toMatch(/could not verify your session/i);
    expect(opts.description).not.toMatch(/User identity mismatch/);
  });

  it("shows a friendly wrong-account prompt when signed in with a different email", async () => {
    useAuthMock.mockReturnValue({ user: { id: "owner1", email: "owner@example.com" } });

    render(<AcceptInvite />);

    await screen.findByText("Wrong account");
    expect(screen.getByText(/sign out and use the invited email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    // Never auto-invokes the accept RPC from the wrong account.
    expect(rpcMock).not.toHaveBeenCalledWith("accept_team_invitation", expect.anything());
  });

  it("does not expose the invite token in the confirm-email UI or toast copy", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });

    render(<AcceptInvite />);
    await fillAndSubmitSignupForm();

    await screen.findByText("Check your email");
    expect(document.body.textContent ?? "").not.toContain(TOKEN);
    for (const [, opts] of toastSuccess.mock.calls) {
      if (opts?.description) expect(opts.description).not.toContain(TOKEN);
    }
  });
});
