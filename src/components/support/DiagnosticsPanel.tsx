/**
 * DiagnosticsPanel — a small, read-only support panel.
 *
 * It surfaces non-sensitive triage facts (app version, route, backend project
 * ref, online/offline, service-worker + PWA state, pending sync, last sync,
 * company/account) and a "Copy diagnostics" button so a pilot user can hand
 * support exactly what's needed without digging through DevTools.
 *
 * Read-only by construction: it reads existing context/env/browser state and
 * never mutates the offline queue, caches, or service worker. It surfaces NO
 * secrets — see src/lib/diagnostics.ts for the safety contract (only the public
 * Supabase project ref is shown, never keys/tokens/sessions/raw payloads).
 *
 * `DiagnosticsContent` is the presentational panel (easy to unit-test directly).
 * `DiagnosticsDialog` wraps it in a dialog and renders a caller-supplied trigger
 * so each layout (sidebar / mobile menu) can style its own entry point.
 */
import { ReactNode, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Copy, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOfflineSyncContext } from "@/contexts/OfflineSyncContext";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { getSessionId } from "@/lib/errorTracking";
import {
  buildDiagnosticsReport,
  collectSources,
  formatDiagnosticsText,
} from "@/lib/diagnostics";

function DiagnosticRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium break-all">{value}</span>
    </div>
  );
}

export function DiagnosticsContent() {
  const location = useLocation();
  const { isOnline, isSyncing, pendingCount, lastSyncAt, syncErrors } =
    useOfflineSyncContext();
  const { tenant, role } = useTenant();
  const { user } = useAuth();

  const report = useMemo(
    () =>
      buildDiagnosticsReport(
        {
          route: location.pathname,
          online: isOnline,
          pendingCount,
          isSyncing,
          syncErrorCount: syncErrors.length,
          lastSyncAt,
          tenantName: tenant?.name ?? null,
          tenantId: tenant?.id ?? null,
          userEmail: user?.email ?? null,
          role: role ?? null,
          supportSessionId: getSessionId(),
        },
        collectSources()
      ),
    [
      location.pathname,
      isOnline,
      pendingCount,
      isSyncing,
      syncErrors.length,
      lastSyncAt,
      tenant?.name,
      tenant?.id,
      user?.email,
      role,
    ]
  );

  const handleCopy = async () => {
    const text = formatDiagnosticsText(report, new Date().toLocaleString());
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      toast.success("Diagnostics copied");
    } catch {
      toast.error("Couldn't copy diagnostics", {
        description: "Select the details and copy them manually.",
      });
    }
  };

  return (
    <div data-testid="diagnostics-panel" className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-muted/20 px-4 py-1 divide-y divide-border/40">
        <DiagnosticRow label="App version" value={report.appVersion} />
        <DiagnosticRow label="Build mode" value={report.mode} />
        <DiagnosticRow label="Route" value={report.route} />
        <DiagnosticRow label="Backend ref" value={report.backendRef} />
        <DiagnosticRow label="Display mode" value={report.displayMode} />
        <DiagnosticRow label="Service worker" value={report.serviceWorker} />
      </section>

      <section className="rounded-lg border border-border/60 bg-muted/20 px-4 py-1 divide-y divide-border/40">
        <DiagnosticRow
          label="Connection"
          value={
            <Badge
              variant={report.connection === "Online" ? "success" : "destructive"}
              className="text-xs"
            >
              {report.connection}
            </Badge>
          }
        />
        <DiagnosticRow label="Pending sync" value={report.pendingCount} />
        <DiagnosticRow label="Syncing" value={report.syncing ? "Yes" : "No"} />
        <DiagnosticRow label="Sync errors" value={report.syncErrorCount} />
        <DiagnosticRow label="Last sync" value={report.lastSync} />
      </section>

      <section className="rounded-lg border border-border/60 bg-muted/20 px-4 py-1 divide-y divide-border/40">
        <DiagnosticRow label="Company" value={report.tenant} />
        <DiagnosticRow label="Tenant ID" value={report.tenantId} />
        <DiagnosticRow label="Account" value={report.account} />
        <DiagnosticRow label="Role" value={<span className="capitalize">{report.role}</span>} />
        <DiagnosticRow label="Support session" value={report.supportSessionId} />
      </section>

      <Button onClick={handleCopy} className="w-full gap-2">
        <Copy className="h-4 w-4" aria-hidden="true" />
        Copy diagnostics
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Read-only. No passwords, keys, or private data are shown or copied.
      </p>
    </div>
  );
}

/**
 * Diagnostics in a dialog. Pass the trigger element (a button styled to match
 * its surroundings); it is rendered via `asChild` so the dialog opens on click.
 */
export function DiagnosticsDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
            Diagnostics
          </DialogTitle>
          <DialogDescription>
            Read-only info to help support troubleshoot. Copy it into your support message.
          </DialogDescription>
        </DialogHeader>
        <DiagnosticsContent />
      </DialogContent>
    </Dialog>
  );
}
