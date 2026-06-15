import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceLoadError } from "@/components/auth/WorkspaceLoadError";

describe("WorkspaceLoadError", () => {
  it("renders the title, copy, and both actions as an alert", () => {
    render(<WorkspaceLoadError onRetry={vi.fn()} onSignOut={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load your workspace")).toBeInTheDocument();
    expect(
      screen.getByText(/couldn't confirm your workspace access/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("calls onRetry when Try again is clicked", () => {
    const onRetry = vi.fn();
    render(<WorkspaceLoadError onRetry={onRetry} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("calls onSignOut when Sign out is clicked", () => {
    const onSignOut = vi.fn();
    render(<WorkspaceLoadError onRetry={vi.fn()} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("disables both actions while retrying", () => {
    render(<WorkspaceLoadError onRetry={vi.fn()} onSignOut={vi.fn()} retrying />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeDisabled();
  });

  it("disables both actions while signing out", () => {
    render(<WorkspaceLoadError onRetry={vi.fn()} onSignOut={vi.fn()} signingOut />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeDisabled();
  });
});
