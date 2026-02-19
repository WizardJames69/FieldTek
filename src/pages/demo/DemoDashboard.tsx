import { useMemo } from 'react';
import { useDemoNav } from '@/hooks/useDemoNav';
import { format } from 'date-fns';
import {
  Briefcase,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';

export default function DemoDashboard() {
  const { navigateDemo } = useDemoNav();
  const { getDemoJobs, getDemoInvoices, getDemoClients, demoTeam, demoTenant, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);

  const jobs = getDemoJobs();
  const invoices = getDemoInvoices();
  const clients = getDemoClients();
  const technicians = demoTeam.filter(m => m.role === 'technician');

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayJobs = jobs.filter(j => j.scheduled_date === today);
    const activeJobs = jobs.filter(j => ['in_progress', 'scheduled'].includes(j.status));
    const completedThisMonth = jobs.filter(j => j.status === 'completed');
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const pendingRevenue = invoices
      .filter(i => ['sent', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + (i.total || 0), 0);

    return {
      todayJobs: todayJobs.length,
      activeJobs: activeJobs.length,
      completedJobs: completedThisMonth.length,
      totalRevenue,
      pendingRevenue,
      clientCount: clients.length,
    };
  }, [jobs, invoices, clients]);

  // Today's jobs
  const todayJobs = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return jobs
      .filter(j => j.scheduled_date === today)
      .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
  }, [jobs]);

  // Urgent/overdue items
  const alerts = useMemo(() => {
    const items = [];
    
    const urgentJobs = jobs.filter(j => j.priority === 'urgent' && (j.status as string) !== 'completed');
    if (urgentJobs.length > 0) {
      items.push({ type: 'urgent', count: urgentJobs.length, label: 'Urgent jobs' });
    }

    const overdueInvoices = invoices.filter(i => i.status === 'overdue');
    if (overdueInvoices.length > 0) {
      items.push({ type: 'overdue', count: overdueInvoices.length, label: 'Overdue invoices' });
    }

    const unassignedJobs = jobs.filter(j => !j.assigned_to && j.status === 'pending');
    if (unassignedJobs.length > 0) {
      items.push({ type: 'unassigned', count: unassignedJobs.length, label: 'Unassigned jobs' });
    }

    return items;
  }, [jobs, invoices]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'warning';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'scheduled': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome */}
      <div data-tour="dashboard-header">
        <h1 className="text-xl md:text-2xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground">
          Here's what's happening at {demoTenant.name} today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4" data-tour="dashboard-stats">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's {t('jobs')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayJobs}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeJobs} active total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed {t('jobs')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedJobs}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              ${stats.pendingRevenue.toLocaleString()} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active {t('clients')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientCount}</div>
            <p className="text-xs text-muted-foreground">
              {technicians.length} {t('technicians').toLowerCase()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {alerts.map((alert, i) => (
                <Badge key={i} variant="outline" className="bg-white">
                  {alert.count} {alert.label.replace('jobs', t('jobs').toLowerCase()).replace('invoices', 'invoices')}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      <div data-tour="jobs-today">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg">Today's Schedule</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigateDemo('/demo/schedule')}>
                View Full Schedule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {todayJobs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No jobs scheduled for today
              </p>
            ) : (
              <div className="space-y-3">
                {todayJobs.map(job => {
                  const client = clients.find(c => c.id === job.client_id);
                  const tech = demoTeam.find(t => t.user_id === job.assigned_to);

                  return (
                    <div
                      key={job.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigateDemo('/demo/jobs')}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-2 h-8 sm:h-10 rounded-full ${getStatusColor(job.status)}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                            <span className="font-medium text-sm sm:text-base truncate">{job.title}</span>
                            <Badge variant={getPriorityColor(job.priority) as any} className="text-[10px] sm:text-xs">
                              {job.priority}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {job.scheduled_time}
                            </span>
                            <span className="truncate">{client?.name || 'Unknown client'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:block sm:text-right pl-4 sm:pl-0 border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                        <p className="text-xs sm:text-sm font-medium">
                          {tech?.name || 'Unassigned'}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground capitalize">
                          {job.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 md:gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigateDemo('/demo/jobs')}>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Create {t('job')}</h3>
                <p className="text-sm text-muted-foreground">Schedule a new service</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigateDemo('/demo/invoices')}>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-medium">Create Invoice</h3>
                <p className="text-sm text-muted-foreground">Bill a customer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigateDemo('/demo/clients')}>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">Add {t('client')}</h3>
                <p className="text-sm text-muted-foreground">New customer profile</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
