import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceLoadError } from '@/components/auth/WorkspaceLoadError';
import type { AppRole } from '@/types/database';

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: ReactNode;
  fallbackPath?: string;
  /**
   * Skip the "Access denied" toast and just redirect. For routes the app
   * itself sends users to by default (e.g. /dashboard is the PWA start_url
   * and generic post-login target), landing there with a non-allowed role is
   * the designed fallback flow, not a denied user action — a destructive
   * toast on every app launch reads as an error. The redirect still happens
   * and nothing is rendered; only the toast is suppressed.
   */
  silent?: boolean;
}

export function RoleGuard({ allowedRoles, children, fallbackPath = '/dashboard', silent = false }: RoleGuardProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading, refreshTenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Recovery actions for the unresolved-role fallback. Retry re-runs the
  // existing TenantContext fetch (resets its retry counters; no backend
  // mutation, no security bypass). Sign out uses the cleanup-wrapped AuthContext
  // helper so shared-device offline data is still wiped; once `user` clears, the
  // effect below redirects to /auth.
  const handleRetry = async () => {
    if (retrying || signingOut) return;
    setRetrying(true);
    try {
      await refreshTenant();
    } finally {
      setRetrying(false);
    }
  };

  const handleSignOut = async () => {
    if (retrying || signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      // On success `user` becomes null and the effect redirects; keep the
      // buttons disabled until the unmount so a double-tap can't fire twice.
    } catch (error) {
      console.error('[RoleGuard] Sign out failed:', error);
      setSigningOut(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (!loading && role && !allowedRoles.includes(role)) {
      if (!silent) {
        toast({
          variant: 'destructive',
          title: 'Access denied',
          description: "You don't have permission to view this page.",
        });
      }
      navigate(fallbackPath, { replace: true });
    }
  }, [authLoading, user, loading, role, allowedRoles, fallbackPath, navigate, toast, silent]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Not authenticated — the effect redirects to /auth; render nothing meanwhile.
  if (!user) {
    return null;
  }

  // Authenticated and done loading, but the role couldn't be resolved (RLS
  // denial, no tenant membership, tenant-context load failure, invite/account
  // mismatch). This used to fall through to `return null` — a permanent blank
  // page with no recovery. Show an actionable fallback instead. This does NOT
  // let the user through: children still render only for an allowed role.
  if (!role) {
    return (
      <WorkspaceLoadError
        onRetry={handleRetry}
        onSignOut={handleSignOut}
        retrying={retrying}
        signingOut={signingOut}
      />
    );
  }

  // Truthy-but-disallowed role — the effect redirects (and toasts unless
  // silent); render nothing while that navigation happens. Unchanged behavior.
  if (!allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
