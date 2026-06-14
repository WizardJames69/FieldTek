import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@/test/test-utils";

// Capture sonner toasts and stub the offline queue so we can drive the prompt's
// reload-decision logic deterministically (no real service worker needed).
const { toastMock, toastErrorMock, getSyncQueueMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  toastErrorMock: vi.fn(),
  getSyncQueueMock: vi.fn(),
}));
vi.mock("sonner", () => {
  const toast = toastMock as unknown as { (...a: unknown[]): void; error: unknown };
  toast.error = toastErrorMock;
  return { toast };
});
vi.mock("@/lib/offlineDb", () => ({ getSyncQueue: getSyncQueueMock }));

import { decideReload, showUpdatePrompt } from "@/lib/pwaUpdate";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}
function onClickFor(title: string): () => void {
  const call = toastMock.mock.calls.find((c) => c[0] === title);
  if (!call) throw new Error(`no toast titled "${title}"`);
  return (call[1] as { action: { onClick: () => void } }).action.onClick;
}

describe("decideReload (PWA update reload gating)", () => {
  it("blocks the reload when offline (can't fetch the new build)", () => {
    expect(decideReload({ online: false, pendingCount: 0 })).toEqual({ kind: "offline" });
    // offline takes precedence even if there are pending changes
    expect(decideReload({ online: false, pendingCount: 5 })).toEqual({ kind: "offline" });
  });

  it("warns (does not silently reload) when offline changes are pending", () => {
    expect(decideReload({ online: true, pendingCount: 1 })).toEqual({ kind: "pending", count: 1 });
    expect(decideReload({ online: true, pendingCount: 3 })).toEqual({ kind: "pending", count: 3 });
  });

  it("reloads freely when online with nothing pending", () => {
    expect(decideReload({ online: true, pendingCount: 0 })).toEqual({ kind: "safe" });
  });
});

describe("showUpdatePrompt (toast + reload wiring)", () => {
  beforeEach(() => {
    toastMock.mockReset();
    toastErrorMock.mockReset();
    getSyncQueueMock.mockReset().mockResolvedValue([]);
    setOnline(true);
  });

  it("shows a 'New version available' toast with a Reload action", () => {
    showUpdatePrompt(vi.fn());
    expect(toastMock).toHaveBeenCalledWith(
      "New version available",
      expect.objectContaining({ action: expect.objectContaining({ label: "Reload" }) })
    );
  });

  it("applies the update (updateSW(true)) when online with nothing pending", async () => {
    const updateSW = vi.fn().mockResolvedValue(undefined);
    showUpdatePrompt(updateSW);
    onClickFor("New version available")();
    await waitFor(() => expect(updateSW).toHaveBeenCalledWith(true));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("does NOT reload when offline — shows an error to reconnect first", async () => {
    setOnline(false);
    const updateSW = vi.fn().mockResolvedValue(undefined);
    showUpdatePrompt(updateSW);
    onClickFor("New version available")();
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(updateSW).not.toHaveBeenCalled();
  });

  it("warns before reloading when offline changes are pending, then reloads on confirm", async () => {
    getSyncQueueMock.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    const updateSW = vi.fn().mockResolvedValue(undefined);
    showUpdatePrompt(updateSW);
    onClickFor("New version available")();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        "Unsynced changes pending",
        expect.objectContaining({ action: expect.objectContaining({ label: "Reload anyway" }) })
      )
    );
    // not reloaded yet — the user must confirm
    expect(updateSW).not.toHaveBeenCalled();
    onClickFor("Unsynced changes pending")();
    await waitFor(() => expect(updateSW).toHaveBeenCalledWith(true));
  });
});
