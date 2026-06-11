import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { SuggestedQuestions } from "@/components/assistant/SuggestedQuestions";
import { DocumentCitation, ContextIndicator } from "@/components/assistant/DocumentCitation";
import { SaveToJobNotes } from "@/components/assistant/SaveToJobNotes";
import { resolveDocumentSignedUrl } from "@/lib/documentLinks";

// Structured citation clicks resolve a signed URL or fall back to navigation.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock("@/lib/documentLinks", () => ({
  resolveDocumentSignedUrl: vi.fn(),
}));

describe("Sentinel AI Components", () => {
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

  describe("DocumentCitation (structured citations)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders a page number when present", () => {
      render(
        <DocumentCitation
          citations={[
            { document_id: "doc-1", document_name: "Carrier Manual", page_number: 12, section_name: "Startup" },
          ]}
        />,
      );
      expect(screen.getByText("Carrier Manual · p.12")).toBeInTheDocument();
    });

    it("renders name-only when page number is null", () => {
      render(
        <DocumentCitation
          citations={[{ document_id: "doc-1", document_name: "Carrier Manual", page_number: null }]}
        />,
      );
      expect(screen.getByText("Carrier Manual")).toBeInTheDocument();
      expect(screen.queryByText(/p\./)).toBeNull();
    });

    it("exposes the section name as a tooltip title", () => {
      render(
        <DocumentCitation
          citations={[
            { document_id: "doc-1", document_name: "Carrier Manual", page_number: 5, section_name: "Refrigerant Charge" },
          ]}
        />,
      );
      expect(screen.getByText("Carrier Manual · p.5")).toHaveAttribute("title", "Refrigerant Charge");
    });

    it("opens a signed URL at the page when a citation with document_id is clicked", async () => {
      vi.mocked(resolveDocumentSignedUrl).mockResolvedValue("https://signed.example/doc.pdf#page=12");
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      render(
        <DocumentCitation
          citations={[
            { document_id: "doc-1", document_name: "Carrier Manual", page_number: 12, section_name: "Startup" },
          ]}
        />,
      );
      fireEvent.click(screen.getByText("Carrier Manual · p.12"));

      await waitFor(() => expect(resolveDocumentSignedUrl).toHaveBeenCalledWith("doc-1", 12));
      await waitFor(() =>
        expect(openSpy).toHaveBeenCalledWith("https://signed.example/doc.pdf#page=12", "_blank"),
      );
      openSpy.mockRestore();
    });

    it("falls back to documents search when a citation has no document_id", async () => {
      render(<DocumentCitation citations={[{ document_name: "Carrier Manual", page_number: null }]} />);
      fireEvent.click(screen.getByText("Carrier Manual"));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith("/documents?search=Carrier%20Manual"),
      );
      expect(resolveDocumentSignedUrl).not.toHaveBeenCalled();
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
