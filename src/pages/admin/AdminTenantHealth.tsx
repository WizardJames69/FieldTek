import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Activity, Users, Briefcase, RefreshCw, TrendingDown, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface TenantHealth {
  id: string;
  name: string;
  industry: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  activityScore: number;
  churnRisk: "low" | "medium" | "high" | "critical";
  lastActivityDate: string | null;
  totalJobs: number;
  jobsLast30Days: number;
  activeUsers: number;
  totalUsers: number;
  daysSinceLastJob: number | null;
}

interface Summary {
  totalTenants: number;
  criticalRisk: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  avgActivityScore: number;
  activeLast7Days: number;
}

const RISK_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const RISK_LABELS = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function AdminTenantHealth() {
  const [tenants, setTenants] = useState<TenantHealth[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: result, error } = await supabase.functions.invoke("admin-tenant-health", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      setTenants(result.tenants);
      setSummary(result.summary);
    } catch (err) {
      console.error("Failed to fetch health data:", err);
      toast.error("Failed to load tenant health data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealthData();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getActivityScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 30) return "text-orange-500";
    return "text-red-500";
  };

  const pieData = summary
    ? [
        { name: "Critical", value: summary.criticalRisk, color: RISK_COLORS.critical },
        { name: "High", value: summary.highRisk, color: RISK_COLORS.high },
        { name: "Medium", value: summary.mediumRisk, color: RISK_COLORS.medium },
        { name: "Low", value: summary.lowRisk, color: RISK_COLORS.low },
      ].filter((d) => d.value > 0)
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenant Health Monitoring</h1>
          <p className="text-muted-foreground">Track activity scores and identify churn risks</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              At-Risk Tenants
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {(summary?.criticalRisk || 0) + (summary?.highRisk || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.criticalRisk || 0} critical, {summary?.highRisk || 0} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Activity Score
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getActivityScoreColor(summary?.avgActivityScore || 0)}`}>
              {summary?.avgActivityScore || 0}/100
            </div>
            <Progress value={summary?.avgActivityScore || 0} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Last 7 Days
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeLast7Days || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.totalTenants ? Math.round((summary.activeLast7Days / summary.totalTenants) * 100) : 0}% of total tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tenants
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalTenants || 0}</div>
            <p className="text-xs text-muted-foreground">Across all subscription tiers</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Churn Risk Distribution</CardTitle>
            <CardDescription>Breakdown of tenants by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No tenant data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Risk Level Breakdown</CardTitle>
            <CardDescription>Tenants grouped by churn risk level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium">Critical Risk</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">{summary?.criticalRisk || 0}</span>
                <span className="text-sm text-muted-foreground">tenants</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="font-medium">High Risk</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">{summary?.highRisk || 0}</span>
                <span className="text-sm text-muted-foreground">tenants</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="font-medium">Medium Risk</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">{summary?.mediumRisk || 0}</span>
                <span className="text-sm text-muted-foreground">tenants</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="font-medium">Low Risk</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">{summary?.lowRisk || 0}</span>
                <span className="text-sm text-muted-foreground">tenants</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Health Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Health Details</CardTitle>
          <CardDescription>Sorted by risk level (highest risk first)</CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Activity Score</TableHead>
                  <TableHead>Churn Risk</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Jobs (30d)</TableHead>
                  <TableHead>Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {tenant.industry || "General"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit capitalize">
                          {tenant.subscriptionTier || "trial"}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {tenant.subscriptionStatus || "trial"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={tenant.activityScore} className="w-16 h-2" />
                        <span className={`font-medium ${getActivityScoreColor(tenant.activityScore)}`}>
                          {tenant.activityScore}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{ backgroundColor: RISK_COLORS[tenant.churnRisk] }}
                        className="text-white"
                      >
                        {RISK_LABELS[tenant.churnRisk]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {tenant.daysSinceLastJob !== null
                            ? tenant.daysSinceLastJob === 0
                              ? "Today"
                              : `${tenant.daysSinceLastJob}d ago`
                            : "Never"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span>{tenant.jobsLast30Days}</span>
                        <span className="text-xs text-muted-foreground">/ {tenant.totalJobs}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span>{tenant.activeUsers}</span>
                        <span className="text-xs text-muted-foreground">/ {tenant.totalUsers}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No tenant data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
