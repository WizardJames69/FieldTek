import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { JobCompletionDialog } from "@/components/jobs/JobCompletionDialog";

// VoiceInput pulls in heavy media APIs that aren't relevant here.
vi.mock("@/components/assistant/VoiceInput", () => ({
  VoiceInput: () => null,
}));

const VALID_NOTES = "Replaced the capacitor and tested the system";

describe("JobCompletionDialog", () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    onConfirm.mockReset();
    onOpenChange.mockReset();
  });

  it("disables Complete until the minimum-length notes are entered", () => {
    render(
      <JobCompletionDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} jobTitle="AC Repair" />
    );
    const complete = screen.getByRole("button", { name: /complete job/i });
    expect(complete).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/resolution notes/i), { target: { value: "short" } });
    expect(complete).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/resolution notes/i), { target: { value: VALID_NOTES } });
    expect(complete).toBeEnabled();
  });

  it("submits the notes WITHOUT clearing them, so a failed submit keeps the text", () => {
    render(
      <JobCompletionDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} jobTitle="AC Repair" />
    );
    const textarea = screen.getByLabelText(/resolution notes/i);
    fireEvent.change(textarea, { target: { value: VALID_NOTES } });
    fireEvent.click(screen.getByRole("button", { name: /complete job/i }));

    expect(onConfirm).toHaveBeenCalledWith(VALID_NOTES);
    // The parent will keep `open` true on failure; the text must still be there.
    expect(textarea).toHaveValue(VALID_NOTES);
  });

  it("shows a loading state and locks input while submitting", () => {
    const { rerender } = render(
      <JobCompletionDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} isSubmitting={false} />
    );
    fireEvent.change(screen.getByLabelText(/resolution notes/i), { target: { value: VALID_NOTES } });

    rerender(
      <JobCompletionDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} isSubmitting={true} />
    );

    const submitting = screen.getByRole("button", { name: /completing/i });
    expect(submitting).toBeDisabled();
    expect(submitting).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(screen.getByLabelText(/resolution notes/i)).toBeDisabled();
  });

  it("clears the notes when the dialog closes (fresh open starts empty)", () => {
    const { rerender } = render(
      <JobCompletionDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />
    );
    fireEvent.change(screen.getByLabelText(/resolution notes/i), { target: { value: VALID_NOTES } });
    expect(screen.getByLabelText(/resolution notes/i)).toHaveValue(VALID_NOTES);

    rerender(<JobCompletionDialog open={false} onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    rerender(<JobCompletionDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    expect(screen.getByLabelText(/resolution notes/i)).toHaveValue("");
  });
});
