import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DegradedAnswerBanner } from "@/components/assistant/DegradedAnswerBanner";

// The banner is shown whenever an assistant answer came from the full-document
// fallback instead of targeted retrieval (field-assistant/degradation.ts).
// It must clearly explain WHY the answer is degraded and tell the user to
// verify against the source — so a degraded answer is never mistaken for a
// retrieval-grounded one.

describe("DegradedAnswerBanner", () => {
  it("renders a labelled banner explaining the answer skipped targeted search", () => {
    render(<DegradedAnswerBanner reason="retrieval_unavailable" />);
    expect(screen.getByTestId("degraded-answer-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Answered without targeted document search/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/drawn from your full documents rather than a targeted search/i),
    ).toBeInTheDocument();
  });

  it("explains that indexing is still in progress for the indexing_incomplete reason", () => {
    render(<DegradedAnswerBanner reason="indexing_incomplete" />);
    expect(screen.getByText(/still being indexed/i)).toBeInTheDocument();
  });

  it("always tells the user to verify the answer against the source", () => {
    render(<DegradedAnswerBanner reason="retrieval_unavailable" />);
    expect(screen.getByText(/verify it against the source/i)).toBeInTheDocument();
  });
});
