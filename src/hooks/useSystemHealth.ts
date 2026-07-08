import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HealthMetric {
  id: string;
  metric_type: string;
  metric_value: number | null;
  status: "healthy" | "degraded" | "unhealthy";
  metadata: Record<string, unknown>;
  recorded_at: string;
}

export interface SystemAlert {
  id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  source: string | null;
  metadata: Record<string, unknown>;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface HealthSummary {
  overall_status: "healthy" | "degraded" | "unhealthy";
  active_alerts: number;
  critical_alerts: number;
  /** Critical alerts created within the last 60 minutes — the ones that indicate a live problem. */
  recent_critical_alerts: number;
  last_check: string | null;
  services: {
    database: { status: string; latency: number | null };
    stripe: { status: string; latency: number | null };
    auth: { status: string; latency: number | null };
  };
}

// Fetch recent health metrics
export function useHealthMetrics(hours = 24) {
  return useQuery({
    queryKey: ["system-health-metrics", hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("system_health_metrics")
        .select("*")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      return data as HealthMetric[];
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Fetch active alerts
export function useSystemAlerts(includeResolved = false) {
  return useQuery({
    queryKey: ["system-alerts", includeResolved],
    queryFn: async () => {
      let query = supabase
        .from("system_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!includeResolved) {
        query = query.is("resolved_at", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SystemAlert[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Alert creators dedup on a 1-hour window, so a critical older than this
// reflects a condition that has not re-fired — backlog to review, not a live outage.
const RECENT_CRITICAL_WINDOW_MS = 60 * 60 * 1000;

// Get health summary
export function useHealthSummary() {
  const { data: metrics } = useHealthMetrics(1); // Last hour
  const { data: alerts } = useSystemAlerts(false);

  const criticalAlerts = alerts?.filter(a => a.severity === "critical") || [];
  const recentCriticalAlerts = criticalAlerts.filter(
    a => Date.now() - new Date(a.created_at).getTime() < RECENT_CRITICAL_WINDOW_MS,
  );

  const summary: HealthSummary = {
    overall_status: "healthy",
    active_alerts: alerts?.length || 0,
    critical_alerts: criticalAlerts.length,
    recent_critical_alerts: recentCriticalAlerts.length,
    last_check: metrics?.[0]?.recorded_at || null,
    services: {
      database: { status: "unknown", latency: null },
      stripe: { status: "unknown", latency: null },
      auth: { status: "unknown", latency: null },
    },
  };

  if (metrics && metrics.length > 0) {
    // Get latest metric for each type
    const latestByType: Record<string, HealthMetric> = {};
    metrics.forEach(m => {
      if (!latestByType[m.metric_type] || m.recorded_at > latestByType[m.metric_type].recorded_at) {
        latestByType[m.metric_type] = m;
      }
    });

    if (latestByType["database_latency"]) {
      summary.services.database = {
        status: latestByType["database_latency"].status,
        latency: latestByType["database_latency"].metric_value,
      };
    }
    if (latestByType["stripe_latency"]) {
      summary.services.stripe = {
        status: latestByType["stripe_latency"].status,
        latency: latestByType["stripe_latency"].metric_value,
      };
    }
    if (latestByType["auth_latency"]) {
      summary.services.auth = {
        status: latestByType["auth_latency"].status,
        latency: latestByType["auth_latency"].metric_value,
      };
    }

    // Determine overall status. Only criticals from the last hour force
    // unhealthy — stale unresolved criticals are backlog needing review, so
    // they hold the status at degraded instead of masquerading as a live outage.
    const statuses = Object.values(summary.services).map(s => s.status);
    if (statuses.includes("unhealthy") || summary.recent_critical_alerts > 0) {
      summary.overall_status = "unhealthy";
    } else if (statuses.includes("degraded") || summary.critical_alerts > 0) {
      summary.overall_status = "degraded";
    }
  }

  return summary;
}

// Acknowledge an alert
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("system_alerts")
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.id,
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-alerts"] });
    },
  });
}

// Resolve an alert
export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("system_alerts")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-alerts"] });
    },
  });
}

// Trigger manual health check
export function useTriggerHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("monitor-health");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-health-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["system-alerts"] });
    },
  });
}
