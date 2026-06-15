/**
 * Diagnostics — non-sensitive, read-only triage facts for pilot support.
 *
 * Everything produced here is safe to show any signed-in user and safe to
 * copy/paste into a support ticket. It deliberately NEVER touches secrets:
 *   - no anon / publishable key, no service-role key
 *   - no access token, refresh token, or full auth session
 *   - no raw offline-queue payloads, no raw error stacks
 *   - not even the full Supabase URL — only the public project ref (which is
 *     already present in the shipped client bundle).
 *
 * It is strictly read-only: it observes browser/env/app state and never mutates
 * the offline queue, caches, or the service worker.
 *
 * The data-gathering (`collectSources`) is split from the report builder so the
 * builder/formatter are pure and fully unit-testable without a real DOM/env.
 */
import { APP_VERSION } from "@/lib/version";

export type DisplayMode = "standalone" | "browser" | "unknown";

const UNKNOWN = "Unknown";
const NOT_AVAILABLE = "Not available";

/** Browser/env-derived values. Injectable so the builder stays test-pure. */
export interface DiagnosticsSources {
  appVersion: string;
  mode: string;
  /** Raw Supabase project URL — only the ref is ever surfaced from it. */
  supabaseUrl: string | undefined;
  serviceWorkerSupported: boolean;
  serviceWorkerControlling: boolean;
  displayMode: DisplayMode;
}

/** App-state values supplied by React (route, sync, tenant, account). */
export interface DiagnosticsInput {
  route: string;
  online: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncErrorCount: number;
  lastSyncAt: Date | string | null;
  /** Tenant's own company name — non-sensitive (shown throughout the app). */
  tenantName?: string | null;
  /** Tenant UUID — non-sensitive identifier, useful for support correlation. */
  tenantId?: string | null;
  /** The signed-in user's own email — voluntarily shared with their support. */
  userEmail?: string | null;
  role?: string | null;
  /** Non-PII random support session id (errorTracking.getSessionId()). */
  supportSessionId?: string | null;
}

export interface DiagnosticsReport {
  appVersion: string;
  mode: string;
  route: string;
  backendRef: string;
  connection: "Online" | "Offline";
  serviceWorker: string;
  displayMode: DisplayMode;
  pendingCount: number;
  syncing: boolean;
  syncErrorCount: number;
  lastSync: string;
  tenant: string;
  tenantId: string;
  account: string;
  role: string;
  supportSessionId: string;
}

/**
 * Extract ONLY the Supabase project ref (e.g. "fgemfxhwushaiiguqxfe") from a
 * project URL like "https://fgemfxhwushaiiguqxfe.supabase.co". Returns null for
 * anything we can't confidently parse as a Supabase project host. Never returns
 * the full URL, query string, path, or any credential — just the public ref
 * subdomain label.
 */
export function parseSupabaseProjectRef(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    if (!hostname.includes("supabase")) return null;
    const label = hostname.split(".")[0];
    // A real ref is a short alphanumeric token. Reject anything else so we never
    // accidentally echo a host that isn't actually a project ref.
    if (label && /^[a-z0-9]{8,}$/i.test(label)) {
      return label;
    }
    return null;
  } catch {
    // Not a parseable URL.
    return null;
  }
}

/** App version: prefer the live runtime build marker, then env, then constant. */
export function readAppVersion(): string {
  try {
    const fromDom =
      typeof document !== "undefined"
        ? document.documentElement?.dataset?.appVersion
        : undefined;
    if (fromDom) return fromDom;
  } catch {
    // No DOM — fall through.
  }
  const fromEnv = import.meta.env?.VITE_APP_VERSION as string | undefined;
  return fromEnv || APP_VERSION || UNKNOWN;
}

/** PWA display mode: standalone (installed) vs browser tab vs unknown. */
export function readDisplayMode(): DisplayMode {
  try {
    if (typeof window !== "undefined") {
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches
      ) {
        return "standalone";
      }
      // iOS Safari exposes installed PWAs via the legacy navigator.standalone.
      if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) {
        return "standalone";
      }
      return "browser";
    }
  } catch {
    // Ignore and fall through.
  }
  return "unknown";
}

/** Whether a service worker is supported and currently controlling the page. */
export function readServiceWorker(): { supported: boolean; controlling: boolean } {
  try {
    const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
    const controlling = supported && !!navigator.serviceWorker?.controller;
    return { supported, controlling };
  } catch {
    return { supported: false, controlling: false };
  }
}

/** Gather the live, non-sensitive browser/env values. */
export function collectSources(): DiagnosticsSources {
  const sw = readServiceWorker();
  return {
    appVersion: readAppVersion(),
    mode: (import.meta.env?.MODE as string) || UNKNOWN,
    supabaseUrl: import.meta.env?.VITE_SUPABASE_URL as string | undefined,
    serviceWorkerSupported: sw.supported,
    serviceWorkerControlling: sw.controlling,
    displayMode: readDisplayMode(),
  };
}

/** Format a last-sync timestamp for display. */
export function formatLastSync(value: Date | string | null | undefined): string {
  if (!value) return "Never";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return UNKNOWN;
  return d.toLocaleString();
}

function describeServiceWorker(sources: DiagnosticsSources): string {
  if (!sources.serviceWorkerSupported) return "Not supported";
  return sources.serviceWorkerControlling
    ? "Active (controlling this page)"
    : "Registered, not controlling yet";
}

/**
 * Build the displayable report from app state + gathered sources. Pure: any
 * missing value collapses to "Unknown" / "Not available" rather than leaking an
 * empty or raw value.
 */
export function buildDiagnosticsReport(
  input: DiagnosticsInput,
  sources: DiagnosticsSources
): DiagnosticsReport {
  return {
    appVersion: sources.appVersion || UNKNOWN,
    mode: sources.mode || UNKNOWN,
    route: input.route || UNKNOWN,
    backendRef: parseSupabaseProjectRef(sources.supabaseUrl) ?? UNKNOWN,
    connection: input.online ? "Online" : "Offline",
    serviceWorker: describeServiceWorker(sources),
    displayMode: sources.displayMode,
    pendingCount: input.pendingCount,
    syncing: input.isSyncing,
    syncErrorCount: input.syncErrorCount,
    lastSync: formatLastSync(input.lastSyncAt),
    tenant: input.tenantName?.trim() || NOT_AVAILABLE,
    tenantId: input.tenantId?.trim() || NOT_AVAILABLE,
    account: input.userEmail?.trim() || NOT_AVAILABLE,
    role: input.role?.trim() || NOT_AVAILABLE,
    supportSessionId: input.supportSessionId?.trim() || NOT_AVAILABLE,
  };
}

/** Plain-text summary suitable for pasting into a support ticket. */
export function formatDiagnosticsText(
  report: DiagnosticsReport,
  generatedAt?: string
): string {
  const lines = [
    "FieldTek diagnostics",
    generatedAt ? `Generated: ${generatedAt}` : null,
    `App version: ${report.appVersion}`,
    `Build mode: ${report.mode}`,
    `Route: ${report.route}`,
    `Backend ref: ${report.backendRef}`,
    `Connection: ${report.connection}`,
    `Service worker: ${report.serviceWorker}`,
    `Display mode: ${report.displayMode}`,
    `Pending sync: ${report.pendingCount}`,
    `Syncing: ${report.syncing ? "Yes" : "No"}`,
    `Sync errors: ${report.syncErrorCount}`,
    `Last sync: ${report.lastSync}`,
    `Company: ${report.tenant}`,
    `Tenant ID: ${report.tenantId}`,
    `Account: ${report.account}`,
    `Role: ${report.role}`,
    `Support session: ${report.supportSessionId}`,
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}
