import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  RefreshCw, 
  Database,
  CreditCard, 
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
  BellOff,
  Check,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  useHealthMetrics,
  useSystemAlerts,
  useHealthSummary,
  useAcknowledgeAlert,
  useResolveAlert,
  useTriggerHealthCheck,
  type HealthMetric,
  type SystemAlert,
} from "@/hooks/useSystemHealth";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function AdminSystemHealth() {
  const [selectedHours, setSelectedHours] = useState(24);
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useHealthMetrics(selectedHours);
  const { data: alerts, isLoading: alertsLoading } = useSystemAlerts(false);
  const summary = useHealthSummary();
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();
  const triggerHealthCheck = useTriggerHealthCheck();

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "healthy": return "text-emerald-500";
      case "degraded": return "text-amber-500";
      case "unhealthy": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "degraded": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "unhealthy": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return (
      <Badge className={cn("font-medium", styles[severity as keyof typeof styles] || styles.low)}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  // Prepare chart data
  const chartData = metrics
    ? (() => {
        const grouped: Record<string, { time: string; database?: number | null; stripe?: number | null; auth?: number | null }> = {};
        
        metrics.forEach(m => {
          const time = format(new Date(m.recorded_at), "HH:mm");
          if (!grouped[time]) {
            grouped[time] = { time };
          }
          if (m.metric_type === "database_latency") {
            grouped[time].database = m.metric_value;
          }
          if (m.metric_type === "stripe_latency") {
            grouped[time].stripe = m.metric_value;
          }
          if (m.metric_type === "auth_latency") {
            grouped[time].auth = m.metric_value;
          }
        });

        return Object.values(grouped).reverse().slice(-50);
      })()
    : [];

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">System Health</h1>
            <p className="text-muted-foreground">
              Monitor platform health and service status
            </p>
          </div>
          <Button 
            onClick={() => triggerHealthCheck.mutate()}
            disabled={triggerHealthCheck.isPending}
            className="whitespace-nowrap shrink-0"
          >
            {triggerHealthCheck.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Health Check
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={cn(
            summary.overall_status === "unhealthy" && "border-red-500/50",
            summary.overall_status === "degraded" && "border-amber-500/50"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getStatusIcon(summary.overall_status)}
                <span className={cn("text-2xl font-bold capitalize", getStatusColor(summary.overall_status))}>
                  {summary.overall_status}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summary.active_alerts > 0 ? (
                  <Bell className="h-5 w-5 text-amber-500" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-2xl font-bold">{summary.active_alerts}</span>
                {summary.critical_alerts > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {summary.critical_alerts} critical
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Database
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Database className={cn("h-5 w-5", getStatusColor(summary.services.database.status))} />
                <span className="text-2xl font-bold">
                  {summary.services.database.latency !== null 
                    ? `${summary.services.database.latency}ms` 
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Check
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-medium">
                  {summary.last_check 
                    ? formatDistanceToNow(new Date(summary.last_check), { addSuffix: true })
                    : "Never"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts
              {(alerts?.length || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {alerts?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="metrics">Metrics History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Services Status */}
            <Card>
              <CardHeader>
                <CardTitle>Service Status</CardTitle>
                <CardDescription>Current health of platform services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Database</p>
                        <p className="text-sm text-muted-foreground">
                          {summary.services.database.latency !== null 
                            ? `${summary.services.database.latency}ms latency` 
                            : "Not measured"}
                        </p>
                      </div>
                    </div>
                    {getStatusIcon(summary.services.database.status)}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Stripe</p>
                        <p className="text-sm text-muted-foreground">
                          {summary.services.stripe.latency !== null 
                            ? `${summary.services.stripe.latency}ms latency` 
                            : "Not configured"}
                        </p>
                      </div>
                    </div>
                    {getStatusIcon(summary.services.stripe.status)}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Authentication</p>
                        <p className="text-sm text-muted-foreground">
                          {summary.services.auth.latency !== null 
                            ? `${summary.services.auth.latency}ms latency` 
                            : "Not measured"}
                        </p>
                      </div>
                    </div>
                    {getStatusIcon(summary.services.auth.status)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Latency Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Latency Trends</CardTitle>
                    <CardDescription>Service response times over time</CardDescription>
                  </div>
                  <select 
                    value={selectedHours}
                    onChange={(e) => setSelectedHours(Number(e.target.value))}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value={1}>Last hour</option>
                    <option value={6}>Last 6 hours</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={168}>Last 7 days</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="time" className="text-xs" />
                      <YAxis unit="ms" className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="database" 
                        stroke="hsl(var(--primary))" 
                        name="Database"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="stripe" 
                        stroke="hsl(var(--secondary))" 
                        name="Stripe"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="auth" 
                        stroke="hsl(var(--accent))" 
                        name="Auth"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Activity className="h-12 w-12 mb-4" />
                    <p>No metrics data available</p>
                    <Button variant="outline" className="mt-4" onClick={() => triggerHealthCheck.mutate()}>
                      Run First Health Check
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>Unresolved system alerts requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : alerts && alerts.length > 0 ? (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className={cn(
                          "flex items-start justify-between p-4 rounded-lg border",
                          alert.severity === "critical" && "border-red-500/50 bg-red-50/50 dark:bg-red-900/10",
                          alert.severity === "high" && "border-orange-500/50 bg-orange-50/50 dark:bg-orange-900/10"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(alert.severity)}
                            <span className="font-medium">{alert.alert_type.replace(/_/g, " ")}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Created {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                            </span>
                            {alert.acknowledged_at && (
                              <span className="text-amber-600">
                                Acknowledged {formatDistanceToNow(new Date(alert.acknowledged_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!alert.acknowledged_at && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => acknowledgeAlert.mutate(alert.id)}
                              disabled={acknowledgeAlert.isPending}
                            >
                              <Bell className="h-3 w-3 mr-1" />
                              Acknowledge
                            </Button>
                          )}
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => resolveAlert.mutate(alert.id)}
                            disabled={resolveAlert.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 text-emerald-500" />
                    <p className="font-medium">All Clear</p>
                    <p className="text-sm">No active alerts at this time</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Metrics History</CardTitle>
                    <CardDescription>Raw health check data</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchMetrics()}>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : metrics && metrics.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Time</th>
                          <th className="text-left py-2 px-3">Metric</th>
                          <th className="text-right py-2 px-3">Value</th>
                          <th className="text-center py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.slice(0, 50).map((m) => (
                          <tr key={m.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3 text-muted-foreground">
                              {format(new Date(m.recorded_at), "MMM d, HH:mm:ss")}
                            </td>
                            <td className="py-2 px-3 font-medium">
                              {m.metric_type.replace(/_/g, " ")}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {m.metric_value !== null ? `${m.metric_value}ms` : "—"}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Badge className={cn(
                                "text-xs",
                                m.status === "healthy" && "bg-emerald-100 text-emerald-700",
                                m.status === "degraded" && "bg-amber-100 text-amber-700",
                                m.status === "unhealthy" && "bg-red-100 text-red-700"
                              )}>
                                {m.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mb-4" />
                    <p>No metrics recorded yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
