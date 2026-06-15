import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@/test/test-utils";
import { JobChecklist } from "@/components/mobile/JobChecklist";

// Mock the data layer. toggleItem/saveNotes resolve a SaveOutcome:
//   'synced' (online ok) | 'queued' (saved offline) | 'failed'.
// The component collapses on any non-failure and renders inline feedback for
// queued/failed; an online success needs no marker (the green checkbox / saved
// note preview is the feedback).
const { mockToggle, mockSaveNotes } = vi.hoisted(() => ({
  mockToggle: vi.fn(),
  mockSaveNotes: vi.fn(),
}));
vi.mock("@/hooks/useOfflineChecklistUpdate", () => ({
  useOfflineChecklistUpdate: () => ({
    isOnline: true,
    toggleItem: mockToggle,
    saveNotes: mockSaveNotes,
  }),
}));
vi.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlags: () => ({ isEnabled: () => false }),
}));
vi.mock("@/hooks/useStepEvidence", () => ({
  useJobEvidence: () => ({ data: [] }),
  useRequiredEvidence: () => ({ data: {} }),
  getItemEvidence: () => [],
}));

const items = [
  {
    id: "i1",
    job_id: "j1",
    stage_name: "Maintenance",
    checklist_item: "Inspect air filter",
    completed: false,
    notes: null,
    photos: [],
  },
  {
    id: "i2",
    job_id: "j1",
    stage_name: "Maintenance",
    checklist_item: "Check refrigerant",
    completed: false,
    notes: null,
    photos: [],
  },
];

describe("JobChecklist auto-collapse", () => {
  beforeEach(() => {
    mockToggle.mockReset().mockResolvedValue("synced");
    mockSaveNotes.mockReset().mockResolvedValue("synced");
  });

  it("collapses the note editor after a successful save and keeps the text", async () => {
    render(<JobChecklist jobId="j1" items={items} />);

    // Expand the first item, type a note, save
    fireEvent.click(screen.getByText("Inspect air filter"));
    const textarea = await screen.findByLabelText("Notes for Inspect air filter");
    fireEvent.change(textarea, { target: { value: "Filter replaced" } });
    fireEvent.click(screen.getByRole("button", { name: /save notes/i }));

    await waitFor(() =>
      expect(mockSaveNotes).toHaveBeenCalledWith("i1", "Filter replaced")
    );
    // Editor collapsed (textarea gone)…
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Notes for Inspect air filter")
      ).toBeNull()
    );
    // …but the saved note is preserved in the collapsed preview
    expect(screen.getByText("Filter replaced")).toBeInTheDocument();
  });

  it("collapses an item after it is checked off", async () => {
    render(<JobChecklist jobId="j1" items={items} />);

    fireEvent.click(screen.getByText("Inspect air filter"));
    expect(
      await screen.findByLabelText("Notes for Inspect air filter")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle Inspect air filter" })
    );

    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith("i1", true));
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Notes for Inspect air filter")
      ).toBeNull()
    );
  });

  it("does not collapse an unrelated expanded item when another item is toggled", async () => {
    render(<JobChecklist jobId="j1" items={items} />);

    // Expand item 2…
    fireEvent.click(screen.getByText("Check refrigerant"));
    expect(
      await screen.findByLabelText("Notes for Check refrigerant")
    ).toBeInTheDocument();

    // …then check off item 1 (which is collapsed)
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle Inspect air filter" })
    );
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith("i1", true));

    // Item 2's editor stays open
    expect(
      screen.getByLabelText("Notes for Check refrigerant")
    ).toBeInTheDocument();
  });
});

describe("JobChecklist inline save feedback", () => {
  beforeEach(() => {
    mockToggle.mockReset().mockResolvedValue("synced");
    mockSaveNotes.mockReset().mockResolvedValue("synced");
  });

  it("shows an offline 'saved offline' marker when a toggle is queued", async () => {
    mockToggle.mockResolvedValue("queued");
    render(<JobChecklist jobId="j1" items={items} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle Inspect air filter" })
    );

    expect(await screen.findByText(/saved offline/i)).toBeInTheDocument();
  });

  it("shows a failure marker with a working Retry when a toggle fails", async () => {
    mockToggle.mockResolvedValue("failed");
    render(<JobChecklist jobId="j1" items={items} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle Inspect air filter" })
    );

    // Failure surfaced with a Retry control
    expect(await screen.findByText(/couldn't save this item/i)).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /^retry$/i });

    // Next attempt succeeds — Retry re-runs the same toggle and clears the marker
    mockToggle.mockResolvedValue("synced");
    fireEvent.click(retry);

    await waitFor(() => expect(mockToggle).toHaveBeenCalledTimes(2));
    expect(mockToggle).toHaveBeenLastCalledWith("i1", true);
    await waitFor(() =>
      expect(screen.queryByText(/couldn't save this item/i)).toBeNull()
    );
  });

  it("keeps the note editor open and the text intact when a save fails", async () => {
    mockSaveNotes.mockResolvedValue("failed");
    render(<JobChecklist jobId="j1" items={items} />);

    fireEvent.click(screen.getByText("Inspect air filter"));
    const textarea = await screen.findByLabelText("Notes for Inspect air filter");
    fireEvent.change(textarea, { target: { value: "Filter replaced" } });
    fireEvent.click(screen.getByRole("button", { name: /save notes/i }));

    await waitFor(() =>
      expect(mockSaveNotes).toHaveBeenCalledWith("i1", "Filter replaced")
    );
    // Editor stays open with the typed text preserved, plus a failure + Retry
    expect(
      screen.getByLabelText("Notes for Inspect air filter")
    ).toHaveValue("Filter replaced");
    expect(screen.getByText(/couldn't save notes/i)).toBeInTheDocument();

    // Retry re-submits the same note text
    mockSaveNotes.mockResolvedValue("synced");
    fireEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    await waitFor(() => expect(mockSaveNotes).toHaveBeenCalledTimes(2));
    expect(mockSaveNotes).toHaveBeenLastCalledWith("i1", "Filter replaced");
  });
});
