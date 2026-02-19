import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { SuggestedQuestions } from "@/components/assistant/SuggestedQuestions";
import { DocumentCitation, ContextIndicator } from "@/components/assistant/DocumentCitation";
import { SaveToJobNotes } from "@/components/assistant/SaveToJobNotes";

describe("AI Assistant Components", () => {
  describe("SuggestedQuestions", () => {
    it("renders suggested questions when provided", () => {
      const suggestions = [
        "What are the pressure ranges?",
        "How do I check the capacitor?",
      ];
      const onSelect = vi.fn();

      render(<SuggestedQuestions suggestions={suggestions} onSelect={onSelect} />);

      expect(screen.getByText("What are the pressure ranges?")).toBeInTheDocument();
      expect(screen.getByText("How do I check the capacitor?")).toBeInTheDocument();
    });

    it("calls onSelect when question is clicked", async () => {
      const suggestions = ["Test question"];
      const onSelect = vi.fn();

      render(<SuggestedQuestions suggestions={suggestions} onSelect={onSelect} />);

      const questionButton = screen.getByText("Test question");
      fireEvent.click(questionButton);

      expect(onSelect).toHaveBeenCalledWith("Test question");
    });

    it("does not render suggestions when empty", () => {
      render(<SuggestedQuestions suggestions={[]} onSelect={vi.fn()} />);
      
      // Should not show the follow-up section
      expect(screen.queryByText(/Follow-up questions/i)).toBeNull();
    });
  });

  describe("DocumentCitation", () => {
    it("renders citation badges for sources", () => {
      const sources = ["Carrier Installation Guide", "Service Manual"];
      const onSourceClick = vi.fn();

      render(<DocumentCitation sources={sources} onSourceClick={onSourceClick} />);

      expect(screen.getByText("Carrier Installation Guide")).toBeInTheDocument();
      expect(screen.getByText("Service Manual")).toBeInTheDocument();
    });

    it("calls onSourceClick when badge is clicked", () => {
      const sources = ["Test Manual"];
      const onSourceClick = vi.fn();

      render(<DocumentCitation sources={sources} onSourceClick={onSourceClick} />);

      fireEvent.click(screen.getByText("Test Manual"));
      expect(onSourceClick).toHaveBeenCalledWith("Test Manual");
    });

    it("does not render citation badges when no sources", () => {
      render(<DocumentCitation sources={[]} />);
      
      // Should not show any badges
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("ContextIndicator", () => {
    it("renders job context when provided", () => {
      render(<ContextIndicator jobTitle="AC Repair" documentCount={0} />);

      expect(screen.getByText("AC Repair")).toBeInTheDocument();
    });

    it("renders equipment context when provided", () => {
      render(<ContextIndicator equipmentType="Air Conditioner" documentCount={0} />);

      expect(screen.getByText("Air Conditioner")).toBeInTheDocument();
    });

    it("renders document count", () => {
      render(<ContextIndicator documentCount={5} />);

      expect(screen.getByText(/5 docs/)).toBeInTheDocument();
    });

    it("does not render context when empty", () => {
      render(<ContextIndicator documentCount={0} />);
      
      // Should not show context label
      expect(screen.queryByText(/Context:/)).toBeNull();
    });
  });

  describe("SaveToJobNotes", () => {
    it("renders save button when jobId is provided", () => {
      render(<SaveToJobNotes jobId="test-job-123" content="Test insight" />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is disabled when no jobId", () => {
      render(<SaveToJobNotes jobId="" content="Test insight" />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });
});
