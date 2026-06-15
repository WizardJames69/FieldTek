import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Reads the SHARED context (PR-H1) — mocking it both drives render states and
// proves the status panel doesn't spin up its own sync engine.
const { useOfflineSyncContextMock } = vi.hoisted(() => ({
  useOfflineSyncContextMock: vi.fn(),
}));
vi.mock("@/contexts/OfflineSyncContext", () => ({
  useOfflineSyncContext: useOfflineSyncContextMock,
}));
vi.mock("@/lib/offlineDb", () => ({
  getOfflineStats: vi.fn().mockResolvedValue({
    cachedJobsCount: 2,
    cachedClientsCount: 1,
    pendingOpsCount: 0,
    lastCacheTime: null,
  }),
}));

import { OfflineSyncStatus } from "@/components/offline/OfflineSyncStatus";

const base = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  syncErrors: [] as string[],
  syncQueue: vi.fn(),
  refreshPendingCount: vi.fn(),
};

describe("OfflineSyncStatus (full)", () => {
  beforeEach(() => {
    useOfflineSyncContextMock.mockReset();
  });

  it("shows the all-synced state when online and error-free", () => {
    useOfflineSyncContextMock.mockReturnValue(base);
    render(<OfflineSyncStatus />);
    expect(screen.getByText("All synced")).toBeInTheDocument();
  });

  it("surfaces an error state in the header when sync errors exist", () => {
    useOfflineSyncContextMock.mockReturnValue({
      ...base,
      syncErrors: ['Couldn\'t sync checklist update for "Job A"'],
    });
    render(<OfflineSyncStatus />);
    expect(screen.getByText("1 change didn't sync")).toBeInTheDocument();
    expect(screen.queryByText("All synced")).not.toBeInTheDocument();
  });

  it("lists human-readable errors and discloses a count beyond 3", () => {
    const syncErrors = [
      'Couldn\'t sync checklist update for "Job A"',
      'Couldn\'t sync job status update for "Job B"',
      'Couldn\'t sync job note for "Job C"',
      'Couldn\'t sync photo evidence for "Job D"',
      "Couldn't sync an offline change",
    ];
    useOfflineSyncContextMock.mockReturnValue({ ...base, syncErrors });
    render(<OfflineSyncStatus />);

    // Expand the collapsible panel to reveal the error list.
    fireEvent.click(screen.getByRole("button", { name: /didn't sync/i }));

    expect(
      screen.getByText(/Couldn't sync checklist update for "Job A"/)
    ).toBeInTheDocument();
    expect(screen.getByText("…and 2 more")).toBeInTheDocument();
  });
});
