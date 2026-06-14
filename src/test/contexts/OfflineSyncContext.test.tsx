import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock the underlying engine so we can prove the provider instantiates it
// exactly once and passes its value through unchanged.
const { useOfflineSyncMock } = vi.hoisted(() => ({ useOfflineSyncMock: vi.fn() }));
vi.mock("@/hooks/useOfflineSync", () => ({ useOfflineSync: useOfflineSyncMock }));

import {
  OfflineSyncProvider,
  useOfflineSyncContext,
} from "@/contexts/OfflineSyncContext";

const SYNC_VALUE = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 3,
  lastSyncAt: null,
  syncErrors: [] as string[],
  syncQueue: vi.fn(),
  refreshPendingCount: vi.fn(),
};

describe("OfflineSyncContext", () => {
  beforeEach(() => {
    useOfflineSyncMock.mockReset().mockReturnValue(SYNC_VALUE);
  });

  it("runs the sync engine once and exposes its value to consumers", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <OfflineSyncProvider>{children}</OfflineSyncProvider>
    );
    const { result } = renderHook(() => useOfflineSyncContext(), { wrapper });

    // Same object the engine returned — no second instance, no copy.
    expect(result.current).toBe(SYNC_VALUE);
    // The engine (with its IndexedDB init + 30s interval + reconnect toast) is
    // instantiated a single time, regardless of how many consumers read it.
    expect(useOfflineSyncMock).toHaveBeenCalledTimes(1);
  });

  it("throws when used outside the provider (no silent second engine)", () => {
    // React logs the thrown render error; silence it for a clean test run.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useOfflineSyncContext())).toThrow(
      /OfflineSyncProvider/
    );
    spy.mockRestore();
  });
});
