import { useState, useMemo, memo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, differenceInMinutes, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { 
  DollarSign, 
  Briefcase, 
  Users, 
  TrendingUp, 
  Loader2, 
  CheckCircle, 
  Clock, 
  Target,
  Award,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  in_progress: '#8b5cf6',
  scheduled: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#ef4444',
};

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}

const StatCard = memo(function StatCard({ title, value, change, changeLabel, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-xl md:text-2xl font-bold mt-1 truncate">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-green-600" />}
                {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-600" />}
                <span className={`text-xs ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {change > 0 ? '+' : ''}{change}% {changeLabel || 'vs last period'}
                </span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// Completion Rate Gauge
const CompletionGauge = memo(function CompletionGauge({ rate, target = 85 }: { rate: number; target?: number }) {
  const isOnTarget = rate >= target;
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            className="text-muted/20"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke={isOnTarget ? '#10b981' : '#f59e0b'}
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${(rate / 100) * 352} 352`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{rate}%</span>
          <span className="text-xs text-muted-foreground">Complete</span>
        </div>
      </div>
      <div className="mt-4 text-center">
        <Badge variant={isOnTarget ? 'default' : 'secondary'} className={isOnTarget ? 'bg-green-600' : ''}>
          {isOnTarget ? 'On Target' : `Target: ${target}%`}
        </Badge>
      </div>
    </div>
  );
});

// Revenue Trend Chart
const RevenueTrendChart = memo(function RevenueTrendChart({ data }: { data: { date: string; revenue: number; paid: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No revenue data available
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="paidGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" />
        <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip 
          formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Total Revenue"
          stroke="hsl(var(--primary))"
          fill="url(#revenueGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="paid"
          name="Paid Revenue"
          stroke="#10b981"
          fill="url(#paidGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

// Jobs by Status Pie Chart
const JobsStatusPieChart = memo(function JobsStatusPieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [value, 'Jobs']} />
        <Legend 
          layout="vertical" 
          align="right" 
          verticalAlign="middle"
          formatter={(value) => <span className="text-xs">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
});

// Technician Performance Card
interface TechnicianPerformance {
  id: string;
  name: string;
  jobsCompleted: number;
  avgCompletionTime: number;
  completionRate: number;
  revenue: number;
}

const TechnicianPerformanceCard = memo(function TechnicianPerformanceCard({ 
  technician, 
  rank 
}: { 
  technician: TechnicianPerformance; 
  rank: number;
}) {
  const initials = technician.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          {rank <= 3 && (
            <div className={`absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : 'bg-amber-700'
            }`}>
              {rank}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{technician.name}</p>
          <p className="text-xs text-muted-foreground">
            {technician.jobsCompleted} jobs • {technician.avgCompletionTime}h avg
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-green-600">${technician.revenue.toLocaleString()}</p>
        <div className="flex items-center gap-1 justify-end">
          <Progress value={technician.completionRate} className="w-16 h-1.5" />
          <span className="text-xs text-muted-foreground">{technician.completionRate}%</span>
        </div>
      </div>
    </div>
  );
});

// Jobs Over Time Line Chart
const JobsLineChart = memo(function JobsLineChart({ data }: { data: { date: string; completed: number; created: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="created"
          name="Jobs Created"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="completed"
          name="Jobs Completed"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

// Revenue by Job Type Bar Chart
const RevenueByTypeChart = memo(function RevenueByTypeChart({ data }: { data: { type: string; revenue: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No revenue data available
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="type" className="text-xs" width={100} />
        <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

export default function Reports() {
  const { tenant } = useTenant();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'revenue' | 'team'>('overview');

  // Memoize date range calculation
  const { start, end, previousStart, previousEnd } = useMemo(() => {
    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    return { 
      start: subDays(now, days), 
      end: now,
      previousStart: subDays(now, days * 2),
      previousEnd: subDays(now, days),
    };
  }, [dateRange]);

  // Fetch jobs data
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['reports-jobs', tenant?.id, dateRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch previous period jobs for comparison
  const { data: previousJobs } = useQuery({
    queryKey: ['reports-jobs-previous', tenant?.id, dateRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch invoices data with job type
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['reports-invoices', tenant?.id, dateRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          scheduled_jobs (
            job_type,
            assigned_to
          )
        `)
        .eq('tenant_id', tenant.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch previous period invoices
  const { data: previousInvoices } = useQuery({
    queryKey: ['reports-invoices-previous', tenant?.id, dateRange],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('total, status')
        .eq('tenant_id', tenant.id)
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch team members
  const { data: teamMembers } = useQuery({
    queryKey: ['reports-team', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          user_id,
          role,
          profiles (
            full_name,
            email
          )
        `)
        .eq('tenant_id', tenant.id)
        .in('role', ['technician', 'admin', 'dispatcher']);

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Calculate stats with comparisons
  const stats = useMemo(() => {
    const totalRevenue = invoices?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
    const paidRevenue = invoices?.filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
    const completedJobs = jobs?.filter((job) => job.status === 'completed') || [];
    const completionRate = jobs?.length ? Math.round((completedJobs.length / jobs.length) * 100) : 0;
    
    // Previous period
    const prevTotalRevenue = previousInvoices?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0;
    const prevCompletedJobs = previousJobs?.filter((job) => job.status === 'completed') || [];
    const prevCompletionRate = previousJobs?.length ? Math.round((prevCompletedJobs.length / previousJobs.length) * 100) : 0;
    
    // Calculate changes
    const revenueChange = prevTotalRevenue > 0 ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100) : 0;
    const jobsChange = previousJobs?.length ? Math.round(((jobs?.length || 0) - previousJobs.length) / previousJobs.length * 100) : 0;
    const completionChange = prevCompletionRate > 0 ? completionRate - prevCompletionRate : 0;

    // Average job completion time (in hours)
    const completionTimes = completedJobs
      .filter((job) => job.actual_start && job.actual_end)
      .map((job) => differenceInMinutes(parseISO(job.actual_end!), parseISO(job.actual_start!)));
    const avgCompletionTime = completionTimes.length 
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length / 60 * 10) / 10 
      : 0;
    
    return {
      totalRevenue,
      paidRevenue,
      completionRate,
      jobCount: jobs?.length || 0,
      completedCount: completedJobs.length,
      revenueChange,
      jobsChange,
      completionChange,
      avgCompletionTime,
    };
  }, [invoices, previousInvoices, jobs, previousJobs]);

  // Jobs by status pie chart data
  const statusPieData = useMemo(() => {
    const jobsByStatus = jobs?.reduce((acc, job) => {
      const status = job.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return Object.entries(jobsByStatus).map(([status, value]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      value,
      color: STATUS_COLORS[status] || '#94a3b8',
    }));
  }, [jobs]);

  // Jobs over time line chart data
  const jobsTimelineData = useMemo(() => {
    const days: Record<string, { created: number; completed: number }> = {};
    
    jobs?.forEach((job) => {
      const day = format(new Date(job.created_at), 'MMM d');
      if (!days[day]) days[day] = { created: 0, completed: 0 };
      days[day].created++;
      if (job.status === 'completed') days[day].completed++;
    });

    return Object.entries(days).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }, [jobs]);

  // Revenue trend data
  const revenueTrendData = useMemo(() => {
    const days: Record<string, { revenue: number; paid: number }> = {};
    
    invoices?.forEach((inv) => {
      const day = format(new Date(inv.created_at), 'MMM d');
      if (!days[day]) days[day] = { revenue: 0, paid: 0 };
      days[day].revenue += Number(inv.total) || 0;
      if (inv.status === 'paid') days[day].paid += Number(inv.total) || 0;
    });

    return Object.entries(days).map(([date, amounts]) => ({
      date,
      ...amounts,
    }));
  }, [invoices]);

  // Revenue by job type
  const revenueByTypeData = useMemo(() => {
    const revenueByType = invoices?.reduce((acc, inv) => {
      const jobType = (inv as any).scheduled_jobs?.job_type || 'Other';
      acc[jobType] = (acc[jobType] || 0) + (Number(inv.total) || 0);
      return acc;
    }, {} as Record<string, number>) || {};

    return Object.entries(revenueByType)
      .map(([type, revenue]) => ({ type, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [invoices]);

  // Technician performance data
  const technicianPerformance = useMemo((): TechnicianPerformance[] => {
    if (!teamMembers || !jobs || !invoices) return [];

    const techStats: Record<string, TechnicianPerformance> = {};

    // Initialize technicians
    teamMembers
      .filter((tm) => tm.role === 'technician')
      .forEach((tm) => {
        const profile = tm.profiles as any;
        techStats[tm.user_id] = {
          id: tm.user_id,
          name: profile?.full_name || profile?.email || 'Unknown',
          jobsCompleted: 0,
          avgCompletionTime: 0,
          completionRate: 0,
          revenue: 0,
        };
      });

    // Calculate job stats per technician
    const techJobs: Record<string, { total: number; completed: number; times: number[] }> = {};
    
    jobs.forEach((job) => {
      if (!job.assigned_to || !techStats[job.assigned_to]) return;
      
      if (!techJobs[job.assigned_to]) {
        techJobs[job.assigned_to] = { total: 0, completed: 0, times: [] };
      }
      
      techJobs[job.assigned_to].total++;
      
      if (job.status === 'completed') {
        techJobs[job.assigned_to].completed++;
        if (job.actual_start && job.actual_end) {
          const time = differenceInMinutes(parseISO(job.actual_end), parseISO(job.actual_start));
          techJobs[job.assigned_to].times.push(time);
        }
      }
    });

    // Calculate revenue per technician
    invoices.forEach((inv) => {
      const assignedTo = (inv as any).scheduled_jobs?.assigned_to;
      if (assignedTo && techStats[assignedTo]) {
        techStats[assignedTo].revenue += Number(inv.total) || 0;
      }
    });

    // Finalize stats
    Object.entries(techJobs).forEach(([userId, data]) => {
      if (techStats[userId]) {
        techStats[userId].jobsCompleted = data.completed;
        techStats[userId].completionRate = data.total > 0 
          ? Math.round((data.completed / data.total) * 100) 
          : 0;
        techStats[userId].avgCompletionTime = data.times.length > 0
          ? Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length / 60 * 10) / 10
          : 0;
      }
    });

    return Object.values(techStats)
      .filter((t) => t.jobsCompleted > 0 || t.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [teamMembers, jobs, invoices]);

  const handleDateRangeChange = useCallback((v: string) => {
    setDateRange(v as '7d' | '30d' | '90d');
  }, []);

  const isLoading = jobsLoading || invoicesLoading;

  return (
    <MainLayout title="Reports & Analytics" subtitle="Performance metrics and insights">
      <div className="space-y-4 md:space-y-6">
        {/* Header with Date Range */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Tabs value={dateRange} onValueChange={handleDateRangeChange}>
            <TabsList>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
              <TabsTrigger value="90d">90 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <StatCard
                    title="Total Revenue"
                    value={`$${stats.totalRevenue.toLocaleString()}`}
                    change={stats.revenueChange}
                    trend={stats.revenueChange > 0 ? 'up' : stats.revenueChange < 0 ? 'down' : 'neutral'}
                    icon={DollarSign}
                  />
                  <StatCard
                    title="Total Jobs"
                    value={stats.jobCount.toString()}
                    change={stats.jobsChange}
                    trend={stats.jobsChange > 0 ? 'up' : stats.jobsChange < 0 ? 'down' : 'neutral'}
                    icon={Briefcase}
                  />
                  <StatCard
                    title="Completion Rate"
                    value={`${stats.completionRate}%`}
                    change={stats.completionChange}
                    changeLabel="pts vs last period"
                    trend={stats.completionChange > 0 ? 'up' : stats.completionChange < 0 ? 'down' : 'neutral'}
                    icon={CheckCircle}
                  />
                  <StatCard
                    title="Avg Completion Time"
                    value={`${stats.avgCompletionTime}h`}
                    icon={Clock}
                  />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                  {/* Completion Rate Gauge */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Completion Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <CompletionGauge rate={stats.completionRate} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Jobs by Status */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Jobs by Status</CardTitle>
                      <CardDescription>Distribution of jobs across different stages</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <JobsStatusPieChart data={statusPieData} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Revenue Trend
                    </CardTitle>
                    <CardDescription>Total and paid revenue over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <RevenueTrendChart data={revenueTrendData} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Jobs Tab */}
            {activeTab === 'jobs' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <StatCard
                    title="Total Jobs"
                    value={stats.jobCount.toString()}
                    icon={Briefcase}
                  />
                  <StatCard
                    title="Completed"
                    value={stats.completedCount.toString()}
                    icon={CheckCircle}
                  />
                  <StatCard
                    title="Completion Rate"
                    value={`${stats.completionRate}%`}
                    icon={Target}
                  />
                  <StatCard
                    title="Avg Time"
                    value={`${stats.avgCompletionTime}h`}
                    icon={Clock}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Jobs Over Time</CardTitle>
                      <CardDescription>Created vs completed jobs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <JobsLineChart data={jobsTimelineData} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Job Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <JobsStatusPieChart data={statusPieData} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <StatCard
                    title="Total Revenue"
                    value={`$${stats.totalRevenue.toLocaleString()}`}
                    change={stats.revenueChange}
                    trend={stats.revenueChange > 0 ? 'up' : stats.revenueChange < 0 ? 'down' : 'neutral'}
                    icon={DollarSign}
                  />
                  <StatCard
                    title="Paid Revenue"
                    value={`$${stats.paidRevenue.toLocaleString()}`}
                    icon={TrendingUp}
                  />
                  <StatCard
                    title="Outstanding"
                    value={`$${(stats.totalRevenue - stats.paidRevenue).toLocaleString()}`}
                    icon={Clock}
                  />
                  <StatCard
                    title="Collection Rate"
                    value={`${stats.totalRevenue > 0 ? Math.round((stats.paidRevenue / stats.totalRevenue) * 100) : 0}%`}
                    icon={Target}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Revenue Trend</CardTitle>
                      <CardDescription>Total and paid revenue over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <RevenueTrendChart data={revenueTrendData} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Revenue by Job Type</CardTitle>
                      <CardDescription>Top performing service categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <RevenueByTypeChart data={revenueByTypeData} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <StatCard
                    title="Active Technicians"
                    value={technicianPerformance.length.toString()}
                    icon={Users}
                  />
                  <StatCard
                    title="Jobs Completed"
                    value={stats.completedCount.toString()}
                    icon={CheckCircle}
                  />
                  <StatCard
                    title="Team Completion Rate"
                    value={`${stats.completionRate}%`}
                    icon={Target}
                  />
                  <StatCard
                    title="Avg Job Time"
                    value={`${stats.avgCompletionTime}h`}
                    icon={Clock}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Technician Leaderboard
                    </CardTitle>
                    <CardDescription>Performance ranked by revenue generated</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {technicianPerformance.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No technician data available for this period</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {technicianPerformance.map((tech, index) => (
                          <TechnicianPerformanceCard 
                            key={tech.id} 
                            technician={tech} 
                            rank={index + 1} 
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
