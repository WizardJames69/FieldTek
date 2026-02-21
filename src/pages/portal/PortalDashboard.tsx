import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  FileText, 
  Wrench, 
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Inbox
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { GlowDivider } from '@/components/landing/GlowDivider';
import { cn } from '@/lib/utils';
import { PortalAuthGuard } from '@/components/portal/PortalAuthGuard';

export default function PortalDashboard() {
  const { client, loading: authLoading, clientLoading, isWrongUserType, user } = usePortalAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['portal-stats', client?.id, client?.tenant_id],
    queryFn: async () => {
      if (!client?.id || !client?.tenant_id) return null;

      const [jobsRes, invoicesRes, equipmentRes, requestsRes] = await Promise.all([
        supabase
          .from('scheduled_jobs')
          .select('id, status')
          .eq('client_id', client.id)
          .eq('tenant_id', client.tenant_id),
        supabase
          .from('invoices')
          .select('id, status, total')
          .eq('client_id', client.id)
          .eq('tenant_id', client.tenant_id),
        supabase
          .from('equipment_registry')
          .select('id')
          .eq('client_id', client.id)
          .eq('tenant_id', client.tenant_id),
        supabase
          .from('service_requests')
          .select('id, status')
          .eq('client_id', client.id)
          .eq('tenant_id', client.tenant_id),
      ]);

      const jobs = jobsRes.data || [];
      const invoices = invoicesRes.data || [];
      const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
      const unpaidTotal = pendingInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

      return {
        activeJobs: jobs.filter(j => j.status === 'in_progress' || j.status === 'pending').length,
        completedJobs: jobs.filter(j => j.status === 'completed').length,
        pendingInvoices: pendingInvoices.length,
        unpaidTotal,
        equipmentCount: equipmentRes.data?.length || 0,
        pendingRequests: (requestsRes.data || []).filter(r => r.status === 'new' || r.status === 'reviewed').length,
      };
    },
    enabled: !!client?.id,
  });

  const { data: recentJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['portal-recent-jobs', client?.id, client?.tenant_id],
    queryFn: async () => {
      if (!client?.id || !client?.tenant_id) return [];

      const { data } = await supabase
        .from('scheduled_jobs')
        .select('id, title, status, scheduled_date, job_type, priority')
        .eq('client_id', client.id)
        .eq('tenant_id', client.tenant_id)
        .order('scheduled_date', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!client?.id && !!client?.tenant_id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'; label: string; glow?: boolean }> = {
      pending: { variant: 'warning', label: 'Scheduled', glow: true },
      in_progress: { variant: 'info', label: 'In Progress', glow: true },
      completed: { variant: 'success', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant} glow={config.glow}>{config.label}</Badge>;
  };

  const getPriorityClass = (priority?: string | null) => {
    if (priority === 'urgent') return 'list-item-native--urgent';
    if (priority === 'high') return 'list-item-native--high';
    return '';
  };

  return (
    <PortalAuthGuard>
    <PortalLayout>
      <div className="space-y-8">
        {/* Welcome Header with gradient text */}
        <div className="page-header-glass p-6 md:p-8">
          {isWrongUserType ? (
            <>
              <h1 className="text-3xl md:text-4xl font-bold">Wrong Portal</h1>
              <p className="text-muted-foreground mt-2">
                This account is not a customer account. Please use the <a href="/auth" className="text-primary underline">main login</a> instead.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-bold">
                Welcome back, <span className="text-gradient-animate">{client?.name?.split(' ')[0] || 'there'}</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                Here's an overview of your account
              </p>
            </>
          )}
        </div>

        {/* Stats Grid - 3D Cards with status glows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="interactive" glow="primary" className="metric-card-glow metric-card-glow--primary">
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Jobs</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{stats?.activeJobs || 0}</p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 backdrop-blur-sm shadow-inner ring-1 ring-primary/20 flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" glow="warning" className="metric-card-glow metric-card-glow--warning">
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Pending Invoices</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <>
                      <p className="text-3xl font-bold">{stats?.pendingInvoices || 0}</p>
                      {stats?.unpaidTotal ? (
                        <p className="text-xs text-warning font-medium">
                          ${stats.unpaidTotal.toFixed(2)} due
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="h-12 w-12 rounded-xl bg-warning/10 backdrop-blur-sm shadow-inner ring-1 ring-warning/20 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="metric-card-glow metric-card-glow--info">
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Equipment</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{stats?.equipmentCount || 0}</p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-xl bg-info/10 backdrop-blur-sm shadow-inner ring-1 ring-info/20 flex items-center justify-center">
                  <Wrench className="h-6 w-6 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" glow="success" className="metric-card-glow metric-card-glow--success">
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Completed Jobs</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-12 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold">{stats?.completedJobs || 0}</p>
                  )}
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 backdrop-blur-sm shadow-inner ring-1 ring-success/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <GlowDivider />

        {/* Quick Actions & Recent Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-start btn-3d btn-shimmer touch-native" variant="default">
                <Link to="/portal/request">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Submit Service Request
                </Link>
              </Button>
              <Button asChild className="w-full justify-start touch-native bg-background/80 backdrop-blur-sm hover:bg-background" variant="outline">
                <Link to="/portal/invoices">
                  <FileText className="h-4 w-4 mr-2" />
                  View Invoices
                </Link>
              </Button>
              <Button asChild className="w-full justify-start touch-native bg-background/80 backdrop-blur-sm hover:bg-background" variant="outline">
                <Link to="/portal/equipment">
                  <Wrench className="h-4 w-4 mr-2" />
                  View Equipment
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card variant="glass" className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Jobs</CardTitle>
              <Button asChild variant="ghost" size="sm" className="touch-native">
                <Link to="/portal/jobs">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : recentJobs?.length === 0 ? (
                <div className="empty-state-native">
                  <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No jobs found</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Your job history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentJobs?.map(job => (
                    <Link
                      key={job.id}
                      to="/portal/jobs"
                      className={cn(
                        "list-item-native flex items-center justify-between p-4 group",
                        getPriorityClass(job.priority)
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted/50 backdrop-blur-sm ring-1 ring-border/50 flex items-center justify-center group-hover:ring-primary/30 transition-all">
                          <Briefcase className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{job.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {job.scheduled_date
                              ? format(new Date(job.scheduled_date), 'MMM d, yyyy')
                              : 'Not scheduled'}
                            {job.job_type && (
                              <>
                                <span>•</span>
                                <span>{job.job_type}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(job.status || 'pending')}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
    </PortalAuthGuard>
  );
}
