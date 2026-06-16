import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentStatusBadge } from "@/components/documents/DocumentCard";

// PR-1.1: a document that hit the extraction-length or chunk-count caps must be
// shown as "Partial" (not silently "ready"), so users know Sentinel may only
// have indexed part of it. Partial is derived from ingestion_warnings; the
// document's extraction_status stays 'completed'.

const baseDoc = {
  id: "d1",
  name: "Manual.pdf",
  description: null,
  category: "manual",
  file_url: "tenant/Manual.pdf",
  file_type: "application/pdf",
  file_size: 1234,
  created_at: new Date(0).toISOString(),
};

const EXTRACTION_WARNING = {
  code: "EXTRACTION_TEXT_TRUNCATED" as const,
  message: "Only the first 100,000 characters were extracted from this document.",
  limit: 100000,
};
const CHUNK_WARNING = {
  code: "CHUNK_LIMIT_REACHED" as const,
  message: "Only the first 500 chunks were indexed from this document.",
  limit: 500,
};

describe("DocumentStatusBadge — partial ingestion", () => {
  it("renders a Partial badge when a ready document carries ingestion warnings", () => {
    render(
      <DocumentStatusBadge
        document={{
          ...baseDoc,
          extraction_status: "completed",
          embedding_status: "completed",
          ingestion_warnings: [EXTRACTION_WARNING],
        }}
      />,
    );
    expect(screen.getByTestId("ingestion-partial-badge")).toBeInTheDocument();
    expect(screen.getByText(/Partial/i)).toBeInTheDocument();
  });

  it("surfaces every truncation reason when both caps were hit", () => {
    render(
      <DocumentStatusBadge
        document={{
          ...baseDoc,
          extraction_status: "completed",
          embedding_status: "completed",
          ingestion_warnings: [EXTRACTION_WARNING, CHUNK_WARNING],
        }}
      />,
    );
    const badge = screen.getByTestId("ingestion-partial-badge");
    const accessibleName = badge.getAttribute("aria-label") ?? "";
    expect(accessibleName).toMatch(/100,000 characters/i);
    expect(accessibleName).toMatch(/500 chunks/i);
    // and the user-facing summary about only part being indexed
    expect(accessibleName).toMatch(/only part of this document was indexed/i);
  });

  it("shows Failed (not Partial) for a failed document even if warnings exist", () => {
    render(
      <DocumentStatusBadge
        document={{
          ...baseDoc,
          extraction_status: "failed",
          embedding_status: "pending",
          last_error: "boom",
          ingestion_warnings: [EXTRACTION_WARNING],
        }}
      />,
    );
    expect(screen.getByText(/Failed/i)).toBeInTheDocument();
    expect(screen.queryByTestId("ingestion-partial-badge")).not.toBeInTheDocument();
    expect(screen.queryByText(/Partial/i)).not.toBeInTheDocument();
  });

  it("renders no badge for a clean ready document with no warnings", () => {
    const { container } = render(
      <DocumentStatusBadge
        document={{
          ...baseDoc,
          extraction_status: "completed",
          embedding_status: "completed",
          ingestion_warnings: null,
        }}
      />,
    );
    expect(screen.queryByText(/Partial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed/i)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("still shows Processing while ingestion is in flight", () => {
    render(
      <DocumentStatusBadge
        document={{
          ...baseDoc,
          extraction_status: "processing",
          embedding_status: "pending",
          ingestion_warnings: null,
        }}
      />,
    );
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();
    expect(screen.queryByTestId("ingestion-partial-badge")).not.toBeInTheDocument();
  });
});
