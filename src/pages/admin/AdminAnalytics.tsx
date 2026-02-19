import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { TrendingUp, Users, Building2, Briefcase, Calendar } from "lucide-react";
import { format, subDays, startOfMonth, eachDayOfInterval } from "date-fns";

interface AnalyticsData {
  totalTenants: number;
  totalUsers: number;
  totalJobs: number;
  totalDemoRequests: number;
  industryBreakdown: { name: string; value: number }[];
  subscriptionBreakdown: { name: string; value: number }[];
  jobsByStatus: { name: string; value: number }[];
  dailySignups: { date: string; count: number }[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);

    const [tenantsRes, usersRes, jobsRes, demoRes] = await Promise.all([
      supabase.from("tenants").select("industry, subscription_status, subscription_tier, created_at"),
      supabase.from("tenant_users").select("created_at"),
      supabase.from("scheduled_jobs").select("status, created_at"),
      supabase.from("demo_requests").select("status, created_at"),
    ]);

    const tenants = tenantsRes.data || [];
    const users = usersRes.data || [];
    const jobs = jobsRes.data || [];
    const demos = demoRes.data || [];

    // Industry breakdown
    const industryMap: Record<string, number> = {};
    tenants.forEach(t => {
      const industry = t.industry || "general";
      industryMap[industry] = (industryMap[industry] || 0) + 1;
    });
    const industryBreakdown = Object.entries(industryMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));

    // Subscription breakdown
    const subMap: Record<string, number> = {};
    tenants.forEach(t => {
      const status = t.subscription_status || "trial";
      subMap[status] = (subMap[status] || 0) + 1;
    });
    const subscriptionBreakdown = Object.entries(subMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
      value
    }));

    // Jobs by status
    const jobStatusMap: Record<string, number> = {};
    jobs.forEach(j => {
      const status = j.status || "pending";
      jobStatusMap[status] = (jobStatusMap[status] || 0) + 1;
    });
    const jobsByStatus = Object.entries(jobStatusMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
      value
    }));

    // Daily signups (last 30 days)
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date()
    });
    
    const signupsByDate: Record<string, number> = {};
    tenants.forEach(t => {
      if (t.created_at) {
        const date = format(new Date(t.created_at), "yyyy-MM-dd");
        signupsByDate[date] = (signupsByDate[date] || 0) + 1;
      }
    });

    const dailySignups = last30Days.map(date => ({
      date: format(date, "MMM d"),
      count: signupsByDate[format(date, "yyyy-MM-dd")] || 0
    }));

    setData({
      totalTenants: tenants.length,
      totalUsers: users.length,
      totalJobs: jobs.length,
      totalDemoRequests: demos.length,
      industryBreakdown,
      subscriptionBreakdown,
      jobsByStatus,
      dailySignups,
    });

    setLoading(false);
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-80 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Overview of platform performance and usage metrics
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalTenants}</p>
                <p className="text-sm text-muted-foreground">Total Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Briefcase className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalJobs}</p>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalDemoRequests}</p>
                <p className="text-sm text-muted-foreground">Demo Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Signups Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Signups</CardTitle>
            <CardDescription>New tenants over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailySignups}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: "#2563eb", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Industry Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Industry Distribution</CardTitle>
            <CardDescription>Tenants by industry type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.industryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.industryBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Status */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Status</CardTitle>
            <CardDescription>Breakdown of tenant subscription status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.subscriptionBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Jobs by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Status</CardTitle>
            <CardDescription>Distribution of jobs across all tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.jobsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
