import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock the offline DB so we can hand syncQueue a queued op that has already
// exhausted its retries — exercising the permanent-drop branch in isolation.
const offlineDb = vi.hoisted(() => ({
  initOfflineDb: vi.fn().mockResolvedValue({}),
  getSyncQueue: vi.fn(),
  removeFromSyncQueue: vi.fn().mockResolvedValue(undefined),
  updateQueueItemRetry: vi.fn().mockResolvedValue(undefined),
  clearOldCachedJobs: vi.fn().mockResolvedValue(undefined),
  setOfflineMetadata: vi.fn().mockResolvedValue(undefined),
  getEvidenceBlob: vi.fn().mockResolvedValue(null),
  removeEvidenceBlob: vi.fn().mockResolvedValue(undefined),
  getCachedJob: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/offlineDb", () => offlineDb);

// Always online, never just-reconnected — so syncQueue only runs when we call it.
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => ({
    isOnline: true,
    wasOffline: false,
    clearWasOffline: vi.fn(),
  }),
}));

const toastMock = vi.hoisted(() => ({
  error: vi.fn().mockReturnValue("toast-id"),
  success: vi.fn(),
  info: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { useOfflineSync } from "@/hooks/useOfflineSync";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const maxedOutOp = {
  id: "op-123",
  type: "checklist_completion_update" as const,
  payload: { itemId: "i1", jobId: "j1" },
  createdAt: "2026-06-14T00:00:00.000Z",
  retryCount: 10, // == MAX_RETRIES
};

describe("useOfflineSync — permanent drop warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineDb.initOfflineDb.mockResolvedValue({});
    offlineDb.getCachedJob.mockResolvedValue(null);
  });

  it("drops a maxed-out op and fires a persistent, human-readable warning", async () => {
    offlineDb.getSyncQueue.mockResolvedValue([maxedOutOp]);

    const { result } = renderHook(() => useOfflineSync(), { wrapper });

    await act(async () => {
      await result.current.syncQueue();
    });

    // Removed from the queue exactly as before — drop semantics unchanged.
    expect(offlineDb.removeFromSyncQueue).toHaveBeenCalledWith("op-123");
    // The drop path must NOT bump the retry counter (it's being deleted).
    expect(offlineDb.updateQueueItemRetry).not.toHaveBeenCalled();

    // Loud, persistent toast with a friendly message and a Dismiss action.
    expect(toastMock.error).toHaveBeenCalledWith(
      "Offline change could not sync",
      expect.objectContaining({
        duration: Infinity,
        description: expect.stringContaining(
          "failed after 10 attempts and was removed"
        ),
        action: expect.objectContaining({ label: "Dismiss" }),
      })
    );
  });

  it("includes resolved job context in the drop message when cached", async () => {
    offlineDb.getSyncQueue.mockResolvedValue([maxedOutOp]);
    offlineDb.getCachedJob.mockResolvedValue({
      id: "j1",
      data: { title: "AC Repair - 12 Main St" },
      cachedAt: "2026-06-14T00:00:00.000Z",
    });

    const { result } = renderHook(() => useOfflineSync(), { wrapper });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(toastMock.error).toHaveBeenCalledWith(
      "Offline change could not sync",
      expect.objectContaining({
        description: expect.stringContaining(
          'A checklist update for "AC Repair - 12 Main St"'
        ),
      })
    );
  });
});
