import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppRole } from '@/types/database';

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: ReactNode;
  fallbackPath?: string;
}

export function RoleGuard({ allowedRoles, children, fallbackPath = '/dashboard' }: RoleGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (!loading && role && !allowedRoles.includes(role)) {
      toast({
        variant: 'destructive',
        title: 'Access denied',
        description: "You don't have permission to view this page.",
      });
      navigate(fallbackPath, { replace: true });
    }
  }, [authLoading, user, loading, role, allowedRoles, fallbackPath, navigate, toast]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user || !role || !allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
