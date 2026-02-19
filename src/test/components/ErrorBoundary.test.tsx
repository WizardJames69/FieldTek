import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error from component");
  }
  return <div>Component rendered successfully</div>;
}

describe("ErrorBoundary", () => {
  // Suppress React error boundary console output during tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Component rendered successfully")).toBeInTheDocument();
  });

  it("renders fallback UI when error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should show error title
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    
    // Should show error ID
    expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
    
    // Should show Try Again button
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    
    // Should show Go Home button
    expect(screen.getByRole("button", { name: /go home/i })).toBeInTheDocument();
  });

  it("shows expandable technical details", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Find and click the technical details button
    const detailsButton = screen.getByRole("button", { name: /technical details/i });
    expect(detailsButton).toBeInTheDocument();
  });

  it("shows report issue button", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const reportButton = screen.getByRole("button", { name: /report this issue/i });
    expect(reportButton).toBeInTheDocument();
  });
});
