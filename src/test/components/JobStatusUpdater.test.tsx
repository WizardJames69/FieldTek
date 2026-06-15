import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@/test/test-utils";
import { JobStatusUpdater } from "@/components/mobile/JobStatusUpdater";

// updateJobStatus owns the success/offline/error toast and returns a
// SaveOutcome. The component reads that only to drive the loading label and an
// inline Retry on failure — it must NOT fire its own (duplicate) toast.
const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));
vi.mock("@/hooks/useOfflineJobUpdate", () => ({
  useOfflineJobUpdate: () => ({ updateJobStatus: mockUpdate }),
}));
const { mockIsOnline } = vi.hoisted(() => ({ mockIsOnline: { value: true } }));
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => ({ isOnline: mockIsOnline.value }),
}));
// Stand-in completion dialog: renders a confirm trigger when open.
vi.mock("@/components/jobs/JobCompletionDialog", () => ({
  JobCompletionDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (notes: string) => void;
  }) => (open ? <button onClick={() => onConfirm("done notes")}>confirm-complete</button> : null),
}));

describe("JobStatusUpdater feedback", () => {
  beforeEach(() => {
    mockUpdate.mockReset().mockResolvedValue("synced");
    mockIsOnline.value = true;
  });

  it("starts a job and reports no error on success", async () => {
    render(<JobStatusUpdater jobId="j1" currentStatus="pending" jobTitle="AC Repair" />);

    fireEvent.click(screen.getByRole("button", { name: /start job/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "j1",
        "in_progress",
        undefined,
        expect.objectContaining({ title: "AC Repair" })
      )
    );
    expect(screen.queryByText(/couldn't update status/i)).toBeNull();
  });

  it("shows an accessible loading label while the update is in flight", async () => {
    let resolve: (v: string) => void = () => {};
    mockUpdate.mockImplementation(() => new Promise<string>((r) => { resolve = r; }));

    render(<JobStatusUpdater jobId="j1" currentStatus="pending" jobTitle="AC Repair" />);
    fireEvent.click(screen.getByRole("button", { name: /start job/i }));

    const button = await screen.findByRole("button", { name: /starting/i });
    expect(button).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      resolve("synced");
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /start job/i })).toBeInTheDocument()
    );
  });

  it("shows an inline failure + Retry that re-runs the update", async () => {
    mockUpdate.mockResolvedValue("failed");
    render(<JobStatusUpdater jobId="j1" currentStatus="pending" jobTitle="AC Repair" />);

    fireEvent.click(screen.getByRole("button", { name: /start job/i }));
    expect(await screen.findByText(/couldn't update status/i)).toBeInTheDocument();

    mockUpdate.mockResolvedValue("synced");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText(/couldn't update status/i)).toBeNull()
    );
  });

  it("opens the completion dialog and passes resolution notes through", async () => {
    render(<JobStatusUpdater jobId="j1" currentStatus="in_progress" jobTitle="AC Repair" />);

    // Completing intercepts to the notes dialog rather than updating immediately
    fireEvent.click(screen.getByRole("button", { name: /complete job/i }));
    expect(mockUpdate).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "confirm-complete" }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "j1",
        "completed",
        undefined,
        expect.objectContaining({ resolutionNotes: "done notes" })
      )
    );
  });

  it("retries a failed completion with the SAME notes without reopening the dialog", async () => {
    mockUpdate.mockResolvedValue("failed");
    render(<JobStatusUpdater jobId="j1" currentStatus="in_progress" jobTitle="AC Repair" />);

    fireEvent.click(screen.getByRole("button", { name: /complete job/i }));
    fireEvent.click(await screen.findByRole("button", { name: "confirm-complete" }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        "j1",
        "completed",
        undefined,
        expect.objectContaining({ resolutionNotes: "done notes" })
      )
    );
    expect(await screen.findByText(/couldn't update status/i)).toBeInTheDocument();

    // Retry replays the captured notes directly — the dialog stays closed
    // (no second "confirm-complete"), so the technician never re-types them.
    mockUpdate.mockResolvedValue("synced");
    expect(screen.queryByRole("button", { name: "confirm-complete" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
    expect(mockUpdate).toHaveBeenLastCalledWith(
      "j1",
      "completed",
      undefined,
      expect.objectContaining({ resolutionNotes: "done notes" })
    );
  });
});
