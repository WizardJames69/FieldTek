import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DiagnosticWizard, getDiagnosticPath } from "@/components/assistant/DiagnosticWizard";

describe("DiagnosticWizard", () => {
  const defaultProps = {
    symptomText: "not cooling properly",
    onComplete: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders wizard for cooling symptom", () => {
    render(<DiagnosticWizard {...defaultProps} />);

    expect(screen.getByText(/Not Cooling Diagnostic/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1/i)).toBeInTheDocument();
  });

  it("renders wizard for electrical symptom", () => {
    render(<DiagnosticWizard {...defaultProps} symptomText="no power to the unit" />);

    expect(screen.getByText(/Electrical Issue Diagnostic/i)).toBeInTheDocument();
  });

  it("renders wizard for noise symptom", () => {
    render(<DiagnosticWizard {...defaultProps} symptomText="loud rattling noise" />);

    expect(screen.getByText(/Noise Complaint Diagnostic/i)).toBeInTheDocument();
  });

  it("renders wizard for pressure/refrigerant symptom", () => {
    render(<DiagnosticWizard {...defaultProps} symptomText="refrigerant leak" />);

    expect(screen.getByText(/Refrigerant System Diagnostic/i)).toBeInTheDocument();
  });

  it("shows step progress indicator", () => {
    render(<DiagnosticWizard {...defaultProps} />);

    // Should show step indicator
    expect(screen.getByText(/Step 1 of/i)).toBeInTheDocument();
  });

  it("does not render wizard content for unmatched symptoms", () => {
    render(<DiagnosticWizard {...defaultProps} symptomText="random unmatched text" />);
    
    // Should not show any diagnostic wizard title
    expect(screen.queryByText(/Diagnostic/i)).toBeNull();
  });
});

describe("getDiagnosticPath", () => {
  it("returns cooling path for cooling symptoms", () => {
    const path = getDiagnosticPath("not cooling");
    expect(path).not.toBeNull();
    expect(path?.id).toBe("not-cooling");
  });

  it("returns electrical path for power symptoms", () => {
    const path = getDiagnosticPath("no power");
    expect(path).not.toBeNull();
    expect(path?.id).toBe("electrical");
  });

  it("returns noise path for noise symptoms", () => {
    const path = getDiagnosticPath("loud noise");
    expect(path).not.toBeNull();
    expect(path?.id).toBe("noise");
  });

  it("returns pressure path for refrigerant symptoms", () => {
    const path = getDiagnosticPath("refrigerant pressure");
    expect(path).not.toBeNull();
    expect(path?.id).toBe("pressure");
  });

  it("returns null for unmatched symptoms", () => {
    const path = getDiagnosticPath("something completely different");
    expect(path).toBeNull();
  });
});
