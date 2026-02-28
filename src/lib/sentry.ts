import * as Sentry from "@sentry/react";
import { onError, type CapturedError } from "@/lib/errorTracking";
import { APP_VERSION } from "@/lib/version";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // Skip in local dev

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `fieldtek@${APP_VERSION}`,
    sampleRate: 1.0,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.message) {
        event.message = sanitize(event.message);
      }
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = sanitize(ex.value);
        }
      }
      return event;
    },
    allowUrls: [/fieldtek\.ai/, /localhost/],
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection captured",
      "Load failed",
      "Failed to fetch",
    ],
  });
}

export function bridgeSentryToErrorTracking(): () => void {
  return onError((captured: CapturedError) => {
    Sentry.withScope((scope) => {
      if (captured.context.userId) scope.setUser({ id: captured.context.userId });
      if (captured.context.tenantId) scope.setTag("tenant_id", captured.context.tenantId);
      for (const [k, v] of Object.entries(captured.context.tags)) scope.setTag(k, v);
      for (const crumb of captured.context.breadcrumbs.slice(-20)) {
        scope.addBreadcrumb({
          timestamp: new Date(crumb.timestamp).getTime() / 1000,
          category: crumb.category,
          message: crumb.message,
          level: crumb.level === "error" ? "error" : crumb.level === "warning" ? "warning" : "info",
        });
      }
      scope.setFingerprint([captured.fingerprint]);
      scope.setExtras({ errorId: captured.id, sessionId: captured.context.sessionId });
      const err = new Error(captured.message);
      err.name = captured.name;
      err.stack = captured.stack;
      Sentry.captureException(err);
    });
  });
}

function sanitize(s: string): string {
  return s
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CC]");
}
