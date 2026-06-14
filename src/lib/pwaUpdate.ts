/**
 * PWA update prompt.
 *
 * The service worker is registered in "prompt" mode (see vite.config.ts), so a
 * new deploy does NOT silently auto-reload the tab. Instead we surface a small
 * toast and let the user choose when to reload — this avoids the "fix is live
 * but my browser still shows the old bundle" confusion seen in field testing.
 *
 * This module owns the toast/decision logic only. The actual service-worker
 * registration (which imports the `virtual:pwa-register` build-time module) lives
 * in main.tsx and hands us the `updateSW` callback, keeping this file free of the
 * virtual import so it stays unit-testable.
 */
import { toast } from "sonner";
import { getSyncQueue } from "@/lib/offlineDb";

/** The reload callback returned by vite-plugin-pwa's `registerSW`. */
export type UpdateSWFn = (reloadPage?: boolean) => Promise<void>;

const UPDATE_TOAST_ID = "pwa-update-available";

export type ReloadDecision =
  | { kind: "offline" }
  | { kind: "pending"; count: number }
  | { kind: "safe" };

/**
 * Pure gating logic for whether reloading-to-update is appropriate right now.
 *
 * - `offline`: a reload can't fetch the new build's assets, so block it and tell
 *   the user to reconnect first.
 * - `pending`: queued offline writes exist. They live in IndexedDB and survive a
 *   reload (they replay once back online), so reloading is data-safe — but we warn
 *   and require an explicit confirm so an in-flight sync isn't interrupted by
 *   surprise.
 * - `safe`: nothing pending — reload freely.
 */
export function decideReload(opts: {
  online: boolean;
  pendingCount: number;
}): ReloadDecision {
  if (!opts.online) return { kind: "offline" };
  if (opts.pendingCount > 0) return { kind: "pending", count: opts.pendingCount };
  return { kind: "safe" };
}

/** Read the offline sync-queue length without ever throwing (read-only). */
async function getPendingCount(): Promise<number> {
  try {
    const queue = await getSyncQueue();
    return queue.length;
  } catch {
    // Never block an update on a queue-read failure.
    return 0;
  }
}

/** Apply the waiting service worker and reload, or fall back to a plain reload. */
function applyUpdate(updateSW?: UpdateSWFn): void {
  if (updateSW) {
    // updateSW(true) tells the waiting SW to skip waiting and reloads the page
    // once it takes control.
    void updateSW(true);
  } else {
    window.location.reload();
  }
}

async function onReloadClicked(updateSW?: UpdateSWFn): Promise<void> {
  const decision = decideReload({
    online: navigator.onLine,
    pendingCount: await getPendingCount(),
  });

  if (decision.kind === "offline") {
    toast.error("You're offline", {
      description: "Reconnect to the internet, then reload to update.",
    });
    return;
  }

  if (decision.kind === "pending") {
    const n = decision.count;
    toast("Unsynced changes pending", {
      id: UPDATE_TOAST_ID,
      duration: Infinity,
      description: `You have ${n} change${n === 1 ? "" : "s"} waiting to sync. They're saved and will sync after reloading — reload anyway?`,
      action: { label: "Reload anyway", onClick: () => applyUpdate(updateSW) },
      cancel: { label: "Not yet" },
    });
    return;
  }

  applyUpdate(updateSW);
}

/**
 * Show the "new version available" toast. Persists until the user acts; clicking
 * Reload runs the offline / pending-sync safety checks before reloading.
 */
export function showUpdatePrompt(updateSW?: UpdateSWFn): void {
  console.info("[FieldTek] update available — prompting to reload");
  toast("New version available", {
    id: UPDATE_TOAST_ID,
    duration: Infinity,
    description: "Reload to update FieldTek. Sync any offline changes first.",
    action: { label: "Reload", onClick: () => void onReloadClicked(updateSW) },
  });
}

/**
 * Tiny build marker to help confirm which bundle is live during debugging.
 * Exposes only the public app version + Vite mode — no secrets.
 */
export function logBuildInfo(): void {
  const version = import.meta.env.VITE_APP_VERSION || "dev";
  try {
    document.documentElement.setAttribute("data-app-version", version);
  } catch {
    // No-DOM guard — harmless if unavailable.
  }
  console.info(`[FieldTek] build ${version} (${import.meta.env.MODE})`);
}
