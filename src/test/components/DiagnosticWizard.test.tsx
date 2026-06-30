import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { DiagnosticWizard, getDiagnosticPath } from "@/components/assistant/DiagnosticWizard";
import { shouldAutoOpenDiagnosticWizard } from "@/config/industryAssistantConfig";

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
    expect(path?.id).toBe("hvac-electrical");
  });

  it("returns noise path for noise symptoms", () => {
    const path = getDiagnosticPath("loud noise");
    expect(path).not.toBeNull();
    expect(path?.id).toBe("hvac-noise");
  });

  it("returns pressure path for refrigerant symptoms", () => {
    const path = getDiagnosticPath("refrigerant pressure");
    expect(path).not.toBeNull();
    expect(path?.id).toBe("hvac-pressure");
  });

  it("returns null for unmatched symptoms", () => {
    const path = getDiagnosticPath("something completely different");
    expect(path).toBeNull();
  });
});

describe("findDiagnosticPath precision (no incidental substring matches)", () => {
  it('"outdoor" does NOT match the elevator Door Diagnostic', () => {
    const path = getDiagnosticPath("the outdoor unit isn't running");
    expect(path?.id).not.toBe("elevator-door");
  });

  it('"elevator door won\'t close" DOES match the Door Diagnostic', () => {
    const path = getDiagnosticPath("elevator door won't close");
    expect(path?.id).toBe("elevator-door");
  });

  it('"discharge line" does NOT match refrigerant via "charge"', () => {
    expect(getDiagnosticPath("discharge line")).toBeNull();
  });

  it('"leakage log" does NOT match refrigerant/water-leak via "leak"', () => {
    expect(getDiagnosticPath("leakage log")).toBeNull();
  });

  it('"I\'m in charge" does NOT match refrigerant via "charge"', () => {
    expect(getDiagnosticPath("I'm in charge")).toBeNull();
  });

  it('"no hot water from the tankless heater, it\'s cold" matches the No Hot Water Diagnostic', () => {
    const path = getDiagnosticPath("no hot water from the tankless heater, it's cold");
    expect(path?.id).toBe("plumbing-no-hot-water");
  });

  it('"what maintenance does a tankless heater need" does NOT match a diagnostic path', () => {
    expect(getDiagnosticPath("what maintenance does a tankless heater need")).toBeNull();
  });

  it("scopes to industry: an HVAC tenant question never matches an elevator path", () => {
    // "door" would otherwise be reachable; HVAC scope must exclude elevator paths.
    expect(getDiagnosticPath("door operator", "hvac")?.industry).not.toBe("elevator");
    // Elevator tenant still gets the Door Diagnostic.
    expect(getDiagnosticPath("door won't close", "elevator")?.id).toBe("elevator-door");
  });
});

describe("shouldAutoOpenDiagnosticWizard (intent gate)", () => {
  const phase2Prompt =
    "Our quarterly maintenance checklist already includes lubricating the blower motor bearings, so what are the other quarterly tasks I should pair with it?";

  it("does NOT auto-open for the Phase 2 informational maintenance prompt", () => {
    const path = getDiagnosticPath(phase2Prompt);
    expect(shouldAutoOpenDiagnosticWizard(phase2Prompt, path)).toBe(false);
  });

  it("does NOT auto-open an informational question that matches a path via a trigger word", () => {
    const msg = "what does the bearing maintenance schedule include";
    const path = getDiagnosticPath(msg);
    expect(path?.id).toBe("mechanical-bearing"); // matcher still matches the trigger
    expect(shouldAutoOpenDiagnosticWizard(msg, path)).toBe(false); // but intent gate suppresses
  });

  it("DOES auto-open for a clear bearing-failure symptom prompt", () => {
    // "grinding"/"failure" are symptom signals; this matches a diagnostic path
    // (the first match is hvac-noise, which also lists "grinding") and the
    // intent gate must auto-open it.
    const msg = "bearing failure, grinding and hot bearing";
    const path = getDiagnosticPath(msg);
    expect(path).not.toBeNull();
    expect(shouldAutoOpenDiagnosticWizard(msg, path)).toBe(true);
  });

  it("DOES auto-open and routes specifically to the Bearing Diagnostic for a unique bearing symptom", () => {
    const msg = "hot bearing on the blower motor, it failed";
    const path = getDiagnosticPath(msg);
    expect(path?.id).toBe("mechanical-bearing");
    expect(shouldAutoOpenDiagnosticWizard(msg, path)).toBe(true);
  });

  it("DOES auto-open for a clear no-hot-water symptom prompt", () => {
    const msg = "no hot water from the tankless heater, it's cold";
    const path = getDiagnosticPath(msg);
    expect(shouldAutoOpenDiagnosticWizard(msg, path)).toBe(true);
  });

  it("does NOT auto-open when no path matches", () => {
    const msg = "what maintenance does a tankless heater need";
    expect(shouldAutoOpenDiagnosticWizard(msg, getDiagnosticPath(msg))).toBe(false);
  });

  it("symptom signal wins even alongside informational words", () => {
    const msg = "what do I do, the door won't close";
    const path = getDiagnosticPath(msg);
    expect(shouldAutoOpenDiagnosticWizard(msg, path)).toBe(true);
  });
});

describe("DiagnosticWizard escape hatch", () => {
  it('"Ask as a question instead" calls onCancel exactly once', () => {
    const onCancel = vi.fn();
    render(
      <DiagnosticWizard
        symptomText="not cooling properly"
        onComplete={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /ask as a question instead/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
