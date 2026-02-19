import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Skeleton } from '@/components/ui/skeleton';

interface PortalAuthGuardProps {
  children: ReactNode;
}

/**
 * Wraps portal pages to handle session expiry gracefully.
 * - Shows loading skeleton while auth is initializing
 * - Redirects to /portal/login if no user session exists
 * - Passes through to children once authenticated
 */
export function PortalAuthGuard({ children }: PortalAuthGuardProps) {
  const { user, loading: authLoading, clientLoading } = usePortalAuth();

  // Still initializing auth — show skeleton
  if (authLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px]" />
        </div>
      </PortalLayout>
    );
  }

  // Auth resolved but no user — session expired or not logged in
  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  // User exists but client record still loading — show skeleton
  if (clientLoading) {
    return (
      <PortalLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px]" />
        </div>
      </PortalLayout>
    );
  }

  return <>{children}</>;
}
