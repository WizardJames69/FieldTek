import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The indicator reads the SHARED context, not its own hook. Mocking the context
// hook both drives the render states and proves it doesn't spin up a second
// sync engine (it would import useOfflineSync directly if it did).
const { useOfflineSyncContextMock } = vi.hoisted(() => ({
  useOfflineSyncContextMock: vi.fn(),
}));
vi.mock("@/contexts/OfflineSyncContext", () => ({
  useOfflineSyncContext: useOfflineSyncContextMock,
}));

import { OfflineIndicator } from "@/components/offline/OfflineIndicator";

const base = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  syncErrors: [] as string[],
  syncQueue: vi.fn(),
  refreshPendingCount: vi.fn(),
};

describe("OfflineIndicator", () => {
  beforeEach(() => {
    useOfflineSyncContextMock.mockReset();
  });

  it("renders nothing when online, synced, idle and error-free", () => {
    useOfflineSyncContextMock.mockReturnValue(base);
    const { container } = render(<OfflineIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the pending count when changes are queued", () => {
    useOfflineSyncContextMock.mockReturnValue({ ...base, pendingCount: 4 });
    render(<OfflineIndicator />);
    expect(screen.getByText("4 pending")).toBeInTheDocument();
  });

  it("shows a syncing state while syncing", () => {
    useOfflineSyncContextMock.mockReturnValue({ ...base, isSyncing: true });
    render(<OfflineIndicator />);
    expect(screen.getByText("Syncing...")).toBeInTheDocument();
  });

  it("shows an offline state when offline", () => {
    useOfflineSyncContextMock.mockReturnValue({ ...base, isOnline: false });
    render(<OfflineIndicator />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("shows an error state when sync errors exist (even with nothing pending)", () => {
    useOfflineSyncContextMock.mockReturnValue({ ...base, syncErrors: ["a", "b"] });
    render(<OfflineIndicator />);
    expect(screen.getByText("Sync error")).toBeInTheDocument();
  });
});
