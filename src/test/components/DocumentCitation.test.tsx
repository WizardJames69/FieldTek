import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DocumentCitation } from "@/components/assistant/DocumentCitation";

// PR-3b: lesson-sourced citations (source_type: "lesson") render a distinct
// "Approved Lesson" badge and are NOT clickable PDF links (no file). Regular
// document citations are unchanged.

function renderCitations(citations: Parameters<typeof DocumentCitation>[0]["citations"]) {
  return render(
    <MemoryRouter>
      <DocumentCitation citations={citations} />
    </MemoryRouter>,
  );
}

describe("DocumentCitation — Approved Lesson label", () => {
  it("renders an Approved Lesson badge for lesson-sourced citations", () => {
    renderCitations([
      {
        document_id: null,
        document_name: "Approved Lesson: why is the compressor short-cycling?",
        source_type: "lesson",
      },
    ]);
    expect(screen.getByTestId("lesson-citation")).toBeInTheDocument();
    expect(screen.getByText("Approved Lesson")).toBeInTheDocument();
  });

  it("renders a normal document citation unchanged (no lesson badge)", () => {
    renderCitations([
      {
        document_id: "doc-1",
        document_name: "Carrier 24ACC636 Installation Manual",
        page_number: 4,
        source_type: "document",
      },
    ]);
    expect(screen.queryByTestId("lesson-citation")).not.toBeInTheDocument();
    expect(screen.getByText(/Carrier 24ACC636 Installation Manual · p\.4/)).toBeInTheDocument();
  });

  it("treats citations with no source_type as regular documents", () => {
    renderCitations([{ document_id: "doc-2", document_name: "HVAC Maintenance Best Practices" }]);
    expect(screen.queryByTestId("lesson-citation")).not.toBeInTheDocument();
    expect(screen.getByText("HVAC Maintenance Best Practices")).toBeInTheDocument();
  });

  it("renders mixed lesson + document citations together", () => {
    renderCitations([
      { document_id: "doc-3", document_name: "Warranty Terms", source_type: "document" },
      { document_id: null, document_name: "Approved Lesson: reset procedure", source_type: "lesson" },
    ]);
    expect(screen.getByTestId("lesson-citation")).toBeInTheDocument();
    expect(screen.getByText("Warranty Terms")).toBeInTheDocument();
  });
});
