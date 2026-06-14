import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryErrorState } from "@/components/ui/QueryErrorState";

describe("QueryErrorState", () => {
  it("renders a default title and copy with role=alert", () => {
    render(<QueryErrorState />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Couldn't load this data")).toBeInTheDocument();
    expect(screen.getByText("Check your connection and try again.")).toBeInTheDocument();
  });

  it("renders a custom title and description", () => {
    render(<QueryErrorState title="Couldn't load jobs" description="Custom copy." />);
    expect(screen.getByText("Couldn't load jobs")).toBeInTheDocument();
    expect(screen.getByText("Custom copy.")).toBeInTheDocument();
  });

  it("shows no retry button when onRetry is omitted", () => {
    render(<QueryErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a text 'Try again' button and calls onRetry when clicked", () => {
    const onRetry = vi.fn();
    render(<QueryErrorState onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: /try again/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows a retrying state and disables the button while retrying", () => {
    const onRetry = vi.fn();
    render(<QueryErrorState onRetry={onRetry} retrying />);
    const btn = screen.getByRole("button", { name: /retrying/i });
    expect(btn).toBeDisabled();
  });

  it("applies the testId to the root element", () => {
    render(<QueryErrorState testId="my-error" />);
    expect(screen.getByTestId("my-error")).toBeInTheDocument();
  });
});
