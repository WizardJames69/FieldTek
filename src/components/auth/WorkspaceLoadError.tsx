import { AlertTriangle, RefreshCw, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

/**
 * WorkspaceLoadError — recovery card shown when a user is authenticated but the
 * app can't resolve their workspace role (RLS denial, missing tenant
 * membership, a tenant-context load failure, or an invite/account mismatch).
 *
 * It replaces RoleGuard's former `return null` for the unresolved-role case,
 * which left a permanent blank screen with no way out. It is purely
 * presentational — RoleGuard owns the retry (TenantContext refetch) and the
 * sign-out (cleanup-wrapped AuthContext helper) — and deliberately shows no raw
 * technical error. Styled to match ErrorBoundary's fallback card.
 */
interface WorkspaceLoadErrorProps {
  onRetry: () => void;
  onSignOut: () => void;
  /** Retry in flight — disables both actions and spins the Try again icon. */
  retrying?: boolean;
  /** Sign-out in flight — disables both actions and spins the Sign out icon. */
  signingOut?: boolean;
}

export function WorkspaceLoadError({
  onRetry,
  onSignOut,
  retrying = false,
  signingOut = false,
}: WorkspaceLoadErrorProps) {
  const busy = retrying || signingOut;

  return (
    <div role="alert" className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full dialog-glass">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle>Couldn't load your workspace</CardTitle>
          <CardDescription>
            Your account is signed in, but FieldTek couldn't confirm your
            workspace access. Try again, or sign out and use a different account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onSignOut}
              disabled={busy}
            >
              {signingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Sign out
            </Button>
            <Button className="flex-1" onClick={onRetry} disabled={busy}>
              {retrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
