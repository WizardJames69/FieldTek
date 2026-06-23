import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentCard } from "@/components/documents/DocumentCard";

// PR-3b: lesson-sourced documents have file_url = null (no uploaded file).
// The card must not crash and must not offer View/Download (PDF/signed-URL)
// actions for them. Uploaded documents (file_url set) keep View + Download.

vi.mock("@/contexts/TenantContext", () => ({
  useUserRole: () => ({ isAdmin: false }),
}));

const baseDoc = {
  id: "d1",
  name: "Sample",
  description: null,
  category: "Manual",
  file_type: "application/pdf",
  file_size: 1234,
  created_at: new Date(0).toISOString(),
  extraction_status: "completed",
  embedding_status: "completed",
};

describe("DocumentCard — null file_url guard", () => {
  it("hides View/Download and shows a lesson hint when file_url is null", () => {
    render(
      <DocumentCard
        document={{ ...baseDoc, name: "Approved Lesson: why short-cycling?", category: "Approved Lesson", file_url: null }}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /view/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no file \(lesson\)/i)).toBeInTheDocument();
  });

  it("keeps View and Download for an uploaded document with a file_url", () => {
    render(
      <DocumentCard
        document={{ ...baseDoc, file_url: "tenant/Sample.pdf" }}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    expect(screen.queryByText(/no file \(lesson\)/i)).not.toBeInTheDocument();
  });
});
