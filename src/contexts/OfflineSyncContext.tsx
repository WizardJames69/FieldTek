/**
 * OfflineSyncContext — a single, shared instance of the offline sync engine.
 *
 * `useOfflineSync()` owns side effects: it opens IndexedDB, runs a 30s periodic
 * sync interval, auto-syncs (with a toast) on reconnect, and listens for service
 * worker background-sync messages. Calling it from multiple components mounts
 * multiple engines — duplicate intervals, duplicate "Back online…" toasts, and
 * racing sync passes (the in-flight guard is per-instance).
 *
 * This provider calls `useOfflineSync()` exactly ONCE and shares the result via
 * context, so every consumer (the header indicator, the My Jobs status panel,
 * etc.) reads the same state and only one engine runs for the authenticated app.
 *
 * It deliberately does NOT change the offline queue/replay/retry semantics — it
 * only centralizes where the hook is instantiated.
 */
import { createContext, useContext, ReactNode } from "react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

/** The full shape returned by `useOfflineSync` (state + actions). */
export type OfflineSyncContextValue = ReturnType<typeof useOfflineSync>;

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  // The single source of truth for offline sync across the authenticated app.
  const sync = useOfflineSync();
  return (
    <OfflineSyncContext.Provider value={sync}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

/**
 * Read the shared offline sync state/actions. Throws if used outside the
 * provider so a missing mount is a loud, immediate error rather than a silent
 * second engine.
 */
export function useOfflineSyncContext(): OfflineSyncContextValue {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error(
      "useOfflineSyncContext must be used within an <OfflineSyncProvider>"
    );
  }
  return ctx;
}
