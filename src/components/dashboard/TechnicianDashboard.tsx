import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clipboard,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  ArrowRight,
  MessageSquare,
  Calendar,
  Loader2,
  Inbox,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, parseISO, isToday } from 'date-fns';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useIsMobile } from '@/hooks/use-mobile';

export function TechnicianDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['tech-dashboard'] });
  }, [queryClient]);

  const { isRefreshing, pullProgress, handlers, containerStyle } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isMobile,
  });

  // Fetch today's jobs for this technician
  const { data: todaysJobs, isLoading } = useQuery({
    queryKey: ['tech-dashboard', 'today', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user?.id || !tenant?.id) return [];
      const today = new Date();
      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select(`
          id, title, scheduled_time, scheduled_date, status, priority, address, description,
          clients(name, phone, address)
        `)
        .eq('tenant_id', tenant.id)
        .eq('assigned_to', user.id)
        .gte('scheduled_date', format(startOfDay(today), 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endOfDay(today), 'yyyy-MM-dd'))
        .neq('status', 'completed')
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!tenant?.id,
  });

  // Fetch completed today count
  const { data: completedToday } = useQuery({
    queryKey: ['tech-dashboard', 'completed', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user?.id || !tenant?.id) return 0;
      const today = new Date();
      const { count, error } = await supabase
        .from('scheduled_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('assigned_to', user.id)
        .eq('status', 'completed')
        .gte('scheduled_date', format(startOfDay(today), 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endOfDay(today), 'yyyy-MM-dd'));

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id && !!tenant?.id,
  });

  // Fetch upcoming jobs count (future days)
  const { data: upcomingCount } = useQuery({
    queryKey: ['tech-dashboard', 'upcoming', user?.id, tenant?.id],
    queryFn: async () => {
      if (!user?.id || !tenant?.id) return 0;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { count, error } = await supabase
        .from('scheduled_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('assigned_to', user.id)
        .neq('status', 'completed')
        .gte('scheduled_date', format(startOfDay(tomorrow), 'yyyy-MM-dd'));

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id && !!tenant?.id,
  });

  const nextJob = todaysJobs?.[0];
  const remainingJobs = todaysJobs?.slice(1) || [];
  const todayCount = (todaysJobs?.length || 0) + (completedToday || 0);

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-muted text-muted-foreground',
      scheduled: 'bg-info/10 text-info',
      in_progress: 'bg-warning/10 text-warning',
    };
    return map[status] || map.pending;
  };

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      low: 'text-muted-foreground',
      medium: 'text-info',
      high: 'text-warning',
      urgent: 'text-destructive',
    };
    return map[priority] || '';
  };

  return (
    <div
      className="space-y-5 animate-fade-up"
      {...handlers}
      style={containerStyle}
    >
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullProgress={pullProgress} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Today', value: isLoading ? null : todayCount, icon: Clipboard, accent: 'text-primary' },
          { label: 'Completed', value: isLoading ? null : (completedToday ?? 0), icon: CheckCircle2, accent: 'text-success' },
          { label: 'Upcoming', value: isLoading ? null : (upcomingCount ?? 0), icon: Calendar, accent: 'text-info' },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border/50">
            <CardContent className="p-4 text-center">
              <s.icon className={cn('h-5 w-5 mx-auto mb-1', s.accent)} />
              {s.value === null ? (
                <Skeleton className="h-8 w-10 mx-auto" />
              ) : (
                <p className="text-2xl font-bold">{s.value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Next Job Card */}
      {isLoading ? (
        <Card className="border-primary/30">
          <CardContent className="p-6">
            <Skeleton className="h-6 w-32 mb-3" />
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-36" />
          </CardContent>
        </Card>
      ) : nextJob ? (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Next Job
              </CardTitle>
              <div className="flex items-center gap-2">
                {nextJob.priority && (
                  <Badge variant="outline" className={getPriorityColor(nextJob.priority)}>
                    {nextJob.priority}
                  </Badge>
                )}
                <Badge className={getStatusColor(nextJob.status || 'pending')}>
                  {(nextJob.status || 'pending').replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-bold">{nextJob.title}</h3>
              {nextJob.scheduled_time && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  {nextJob.scheduled_time}
                </p>
              )}
              {(nextJob.clients as any)?.name && (
                <p className="text-sm text-muted-foreground mt-1">
                  {(nextJob.clients as any).name}
                </p>
              )}
            </div>

            {(nextJob.address || (nextJob.clients as any)?.address) && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/30">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{nextJob.address || (nextJob.clients as any)?.address}</span>
              </div>
            )}

            {nextJob.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{nextJob.description}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1"
                onClick={() => navigate('/my-jobs')}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Open Job
              </Button>
              {(nextJob.clients as any)?.phone && (
                <Button variant="outline" size="icon" asChild>
                  <a href={`tel:${(nextJob.clients as any).phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {(nextJob.address || (nextJob.clients as any)?.address) && (
                <Button variant="outline" size="icon" asChild>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      nextJob.address || (nextJob.clients as any)?.address || ''
                    )}`}
                    target="_blank"
                  >
                    <MapPin className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg">All clear!</h3>
            <p className="text-sm text-muted-foreground mt-1">No remaining jobs for today.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/my-calendar')}>
              <Calendar className="h-4 w-4 mr-2" />
              View Calendar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Remaining jobs list */}
      {remainingJobs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Later Today ({remainingJobs.length})
          </h3>
          <div className="space-y-2">
            {remainingJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors cursor-pointer"
                onClick={() => navigate('/my-jobs')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">
                    {job.scheduled_time || '--:--'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(job.clients as any)?.name || 'No client'}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(job.status || 'pending')} variant="outline">
                  {(job.status || 'pending').replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-14 flex-col gap-1"
          onClick={() => navigate('/my-jobs')}
        >
          <Clipboard className="h-5 w-5" />
          <span className="text-xs">All Jobs</span>
        </Button>
        <Button
          variant="outline"
          className="h-14 flex-col gap-1"
          onClick={() => navigate('/assistant')}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs">AI Assistant</span>
        </Button>
      </div>
    </div>
  );
}
