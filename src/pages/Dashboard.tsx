import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Clipboard, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Users,
  Calendar,
  ArrowUpRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useBranding } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { PostCheckoutNudge } from '@/components/dashboard/PostCheckoutNudge';
import { UsageInsightsWidget } from '@/components/dashboard/UsageInsightsWidget';
import { StripeConnectIndicator } from '@/components/dashboard/StripeConnectIndicator';
import { WhatsNewDialog } from '@/components/dashboard/WhatsNewDialog';
import { useOnboardingProgressSync } from '@/hooks/useOnboardingProgressSync';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTerminology } from '@/hooks/useTerminology';
import { useIsPlatformAdmin } from '@/hooks/useIsPlatformAdmin';
import { Card3D } from '@/components/landing/Card3D';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { TechnicianTutorialGate } from '@/components/onboarding/TechnicianTutorialGate';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading, refreshTenant, refreshSession, role } = useTenant();
  const branding = useBranding();
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [tenantVerifyAttempts, setTenantVerifyAttempts] = useState(0);
  const maxTenantVerifyAttempts = 3;
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { t } = useTerminology();
  const { isPlatformAdmin } = useIsPlatformAdmin(!!user);
  const isTechnician = role === 'technician';
  
  // Track if we're coming from checkout - be more patient with tenant loading
  const fromCheckout = searchParams.get('from') === 'checkout';
  
  // Sync onboarding progress based on actual data
  useOnboardingProgressSync();

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats', tenant?.id] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-todays-jobs', tenant?.id] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-service-requests', tenant?.id] });
  }, [queryClient, tenant?.id]);

  const { isRefreshing, pullProgress, handlers, containerStyle } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isMobile || authLoading || tenantLoading,
  });

  // Fetch job stats using single RPC call for better performance
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_tenant_id: tenant.id,
      });

      if (error) {
        console.error('[Dashboard] Stats RPC error:', error);
        throw error;
      }

      // RPC returns a single row, extract it
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total: Number(row?.total) || 0,
        inProgress: Number(row?.in_progress) || 0,
        completed: Number(row?.completed) || 0,
        urgent: Number(row?.urgent) || 0,
      };
    },
    enabled: !!tenant?.id,
  });

  // Fetch today's jobs
  const { data: todaysJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['dashboard-todays-jobs', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const today = new Date();
      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select(`
          id,
          title,
          scheduled_time,
          status,
          priority,
          assigned_to,
          clients(name)
        `)
        .eq('tenant_id', tenant.id)
        .gte('scheduled_date', format(startOfDay(today), 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endOfDay(today), 'yyyy-MM-dd'))
        .order('scheduled_time', { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch recent service requests
  const { data: serviceRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['dashboard-service-requests', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          id,
          title,
          priority,
          created_at,
          clients(name)
        `)
        .eq('tenant_id', tenant.id)
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch technician names for job assignments - scoped to current tenant
  const { data: profiles } = useQuery({
    queryKey: ['dashboard-profiles', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return {};
      
      // Join through tenant_users to only get profiles for this tenant
      const { data, error } = await supabase
        .from('tenant_users')
        .select('user_id, profiles!inner(user_id, full_name)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      if (error) throw error;
      
      const profileMap: Record<string, string> = {};
      data?.forEach((tu: any) => {
        const profile = tu.profiles;
        if (profile?.user_id && profile?.full_name) {
          profileMap[profile.user_id] = profile.full_name;
        }
      });
      return profileMap;
    },
    enabled: !!tenant?.id,
  });

  // Redirect to auth if not logged in, or to admin if platform admin
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    // Platform admins should always use the platform dashboard (no tenant required)
    if (!authLoading && user) {
      const check = async () => {
        const { data, error } = await supabase.rpc('is_platform_admin');
        if (!error && data) {
          navigate('/admin', { replace: true });
        }
      };
      void check();
    }
  }, [user, authLoading, navigate]);

  // If tenant loading hangs, surface it and offer a retry
  // Use longer timeout for post-checkout users
  useEffect(() => {
    if (!authLoading && user && tenantLoading) {
      setLoadingTooLong(false);
      const timeout = fromCheckout ? 15000 : 8000;
      const t = setTimeout(() => setLoadingTooLong(true), timeout);
      return () => clearTimeout(t);
    } else {
      setLoadingTooLong(false);
    }
  }, [authLoading, user, tenantLoading, fromCheckout]);

  // Handle retry with session refresh
  const handleRetryWithSessionRefresh = async () => {
    setTenantVerifyAttempts((a) => a + 1);
    await refreshSession();
    await refreshTenant();
  };

  // Tenant gate: if user exists but tenant is null after loading, show loading state
  // instead of rendering dashboard with missing data
  if (!authLoading && !tenantLoading && user && !tenant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <RefreshCw className="absolute inset-0 h-16 w-16 p-4 text-primary" />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-foreground">Loading Workspace</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {fromCheckout 
                ? "Finalizing your subscription setup..."
                : "We're having trouble loading your workspace data."
              }
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {tenantVerifyAttempts < maxTenantVerifyAttempts 
                ? "Try refreshing your session to resolve this."
                : "If the issue persists, you may need to complete setup."
              }
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleRetryWithSessionRefresh}
                disabled={tenantVerifyAttempts >= maxTenantVerifyAttempts}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Refresh & Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/onboarding', { replace: true })}
              >
                Start Setup
              </Button>
              {isPlatformAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/admin', { replace: true })}
                >
                  Admin Dashboard
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await supabase.auth.signOut();
                  } finally {
                    navigate('/auth', { replace: true });
                  }
                }}
              >
                Sign out
              </Button>
            </div>
            {tenantVerifyAttempts > 0 && (
              <p className="text-xs text-muted-foreground/60 font-mono">
                Attempts: {tenantVerifyAttempts}/{maxTenantVerifyAttempts}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || tenantLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-4">
          {/* Spinner */}
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-primary" />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-foreground">Loading your workspace</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Setting up your dashboard...
            </p>
          </div>

          {loadingTooLong && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                This is taking longer than expected. Your session may need to be refreshed.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button variant="default" size="sm" onClick={() => refreshTenant()}>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Retry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/onboarding', { replace: true })}
                >
                  Continue setup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await supabase.auth.signOut();
                    } finally {
                      navigate('/auth', { replace: true });
                    }
                  }}
                >
                  Sign out
                </Button>
              </div>
              <p className="text-xs text-muted-foreground/60 font-mono">
                auth: {authLoading ? 'loading' : 'ready'} • tenant: {tenantLoading ? 'loading' : (tenant?.id ? 'ready' : 'missing')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-muted text-muted-foreground',
      scheduled: 'bg-info/10 text-info',
      in_progress: 'bg-warning/10 text-warning',
      completed: 'bg-success/10 text-success',
    };
    return styles[status] || styles.pending;
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-muted text-muted-foreground',
      medium: 'bg-info/10 text-info',
      high: 'bg-warning/10 text-warning',
      urgent: 'bg-destructive/10 text-destructive',
    };
    return styles[priority] || styles.medium;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const statItems = [
    { label: `Total ${t('jobs')}`, value: stats?.total ?? 0, icon: Clipboard, color: 'text-info' },
    { label: 'In Progress', value: stats?.inProgress ?? 0, icon: Clock, color: 'text-warning' },
    { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle2, color: 'text-success' },
    { label: 'Urgent', value: stats?.urgent ?? 0, icon: AlertTriangle, color: 'text-destructive' },
  ];

  // Technician-specific dashboard
  if (isTechnician) {
    return (
      <MainLayout title="Dashboard" subtitle="Your day at a glance">
        <TechnicianTutorialGate />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard" subtitle={`Welcome back! Here's what's happening at ${branding.companyName}`}>
      <div className="relative" data-testid="dashboard-page">
        {/* Subtle floating orbs background */}
        <FloatingOrbs variant="primary" count={1} intensity="subtle" />
        
        <div 
          className="space-y-4 md:space-y-6 animate-fade-up relative z-10"
          {...handlers}
          style={containerStyle}
      >
        <PullToRefreshIndicator isRefreshing={isRefreshing} pullProgress={pullProgress} />
        {/* Post-checkout celebration nudge */}
        <PostCheckoutNudge />
        
        {/* Onboarding Checklist */}
        <OnboardingChecklist />
        
        {/* Usage Insights Widget */}
        <UsageInsightsWidget />
        
        {/* Stripe Connect Status Indicator */}
        <StripeConnectIndicator />
        
        {/* Stats Grid with 3D Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4" data-testid="dashboard-stats-grid">
          {statItems.map((stat, index) => {
            const Icon = stat.icon;
            // Create gradient backgrounds based on stat type
            const gradientStyles: Record<string, string> = {
              'text-info': 'from-info/5 to-transparent',
              'text-warning': 'from-warning/5 to-transparent',
              'text-success': 'from-success/5 to-transparent',
              'text-destructive': 'from-destructive/5 to-transparent',
            };
            const glowStyles: Record<string, string> = {
              'text-info': 'shadow-info/10',
              'text-warning': 'shadow-warning/10',
              'text-success': 'shadow-success/10',
              'text-destructive': 'shadow-destructive/10',
            };
            return (
              <Card3D key={stat.label} intensity={0.3} glowOnHover>
                <Card 
                  className={cn(
                    "card-interactive overflow-hidden relative stat-card-3d",
                    "bg-gradient-to-br",
                    gradientStyles[stat.color],
                    "hover:shadow-lg",
                    glowStyles[stat.color]
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Subtle inner glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
                  <CardContent className="p-4 md:p-6 relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-muted-foreground truncate">{stat.label}</p>
                        {statsLoading ? (
                          <Skeleton className="h-7 md:h-9 w-12 md:w-16 mt-1" />
                        ) : (
                          <p className="text-2xl md:text-3xl font-bold mt-1">{stat.value}</p>
                        )}
                      </div>
                      <div className={cn(
                        'p-2 md:p-3 rounded-xl shrink-0 transition-all duration-200',
                        'bg-background/80 backdrop-blur-sm shadow-sm',
                        'ring-1 ring-border/50',
                        stat.color
                      )}>
                        <Icon className="h-4 w-4 md:h-5 md:w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Card3D>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Today's Jobs */}
          <Card className="lg:col-span-2 app-glass-container" data-testid="dashboard-todays-jobs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Today's {t('jobs')}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-accent gap-1" onClick={() => navigate('/jobs')}>
                View all <ArrowUpRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : todaysJobs && todaysJobs.length > 0 ? (
                <div className="space-y-3">
                  {todaysJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/jobs')}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-medium text-muted-foreground w-16">
                          {job.scheduled_time || '--:--'}
                        </div>
                        <div>
                          <p className="font-medium">{job.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {(job.clients as any)?.name || 'No client'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.priority && (
                          <Badge className={getPriorityBadge(job.priority)}>{job.priority}</Badge>
                        )}
                        {job.status && (
                          <Badge className={getStatusBadge(job.status)}>{job.status.replace('_', ' ')}</Badge>
                        )}
                        <span className="text-sm text-muted-foreground hidden sm:inline">
                          {job.assigned_to && profiles?.[job.assigned_to] 
                            ? profiles[job.assigned_to] 
                            : 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No jobs scheduled for today</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/jobs')}>
                    Schedule a job
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Requests */}
          <Card className="app-glass-container" data-testid="dashboard-service-requests">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                New Requests
              </CardTitle>
              {serviceRequests && serviceRequests.length > 0 && (
                <Badge variant="secondary">{serviceRequests.length} new</Badge>
              )}
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : serviceRequests && serviceRequests.length > 0 ? (
                <div className="space-y-3">
                  {serviceRequests.map((req) => (
                    <div 
                      key={req.id} 
                      className="p-3 rounded-lg border border-border hover:border-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/service-requests')}
                    >
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm">{req.title}</p>
                        {req.priority && (
                          <Badge className={getPriorityBadge(req.priority)} variant="outline">{req.priority}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(req.clients as any)?.name || 'Unknown client'} • {formatTimeAgo(req.created_at)}
                      </p>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full mt-2" onClick={() => navigate('/service-requests')}>
                    View all requests
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No new service requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* What's New Dialog */}
        <WhatsNewDialog />
        </div>
      </div>
    </MainLayout>
  );
}