import { ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceLoadError } from '@/components/auth/WorkspaceLoadError';
import { getPostLoginDestination } from '@/lib/authRouting';
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
  const { role, loading, workspaceStatus, refreshTenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Guards the async no-membership redirect so it fires once (not on every render
  // while getPostLoginDestination resolves), avoiding a redirect loop.
  const redirectingRef = useRef(false);

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
    // Signed in but with a CONFIRMED no-membership state (no tenant_users row):
    // the user simply hasn't onboarded, or is a portal client. Route them to
    // their real destination (onboarding for tenant users, /portal for clients)
    // instead of showing a workspace error. getPostLoginDestination re-derives
    // the target with the portal/admin checks, so this never misroutes a client.
    if (!authLoading && user && !loading && workspaceStatus === 'no-membership') {
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        getPostLoginDestination()
          .then(({ destination }) => navigate(destination, { replace: true }))
          .catch(() => navigate('/onboarding', { replace: true }));
      }
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
  }, [authLoading, user, loading, role, workspaceStatus, allowedRoles, fallbackPath, navigate, toast, silent]);

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

  // Signed in with no membership — the effect is routing them to onboarding /
  // portal. Show the loading skeleton (not the error card) while that navigation
  // resolves, so a valid new user never flashes "couldn't load your workspace".
  if (workspaceStatus === 'no-membership') {
    return (
      <div className="min-h-screen p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Genuine tenant load failure (query/RLS/network error after retries), OR an
  // unexpected unresolved role while otherwise "ready". Show the actionable
  // recovery card (retry / sign out) — NOT for the no-membership case above.
  // This does NOT let the user through: children still render only for an
  // allowed role.
  if (workspaceStatus === 'load-error' || !role) {
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
