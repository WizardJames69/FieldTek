import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Database, 
  CreditCard, 
  Shield, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy" | "unconfigured";
  message: string;
  latency_ms?: number;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    database: ServiceStatus;
    stripe: ServiceStatus;
    auth: ServiceStatus;
  };
  latency: {
    database_ms: number | null;
    stripe_ms: number | null;
  };
}

export function BackendHealthStatus() {
  const { data: health, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["backend-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<HealthStatus>("health-check");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Check every minute
    retry: 1,
  });

  const getStatusIcon = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "unconfigured":
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: HealthStatus["status"] | undefined) => {
    if (!status) return null;
    const styles = {
      healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      degraded: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      unhealthy: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return (
      <Badge className={cn("font-medium", styles[status])}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case "database":
        return <Database className="h-4 w-4" />;
      case "stripe":
        return <CreditCard className="h-4 w-4" />;
      case "auth":
        return <Shield className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const serviceLabels: Record<string, string> = {
    database: "Database",
    stripe: "Payments (Stripe)",
    auth: "Authentication",
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Backend Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Backend Health
            </CardTitle>
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Unreachable
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Unable to reach health check endpoint
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={cn("h-3 w-3 mr-2", isFetching && "animate-spin")} />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      health?.status === "unhealthy" && "border-red-200 dark:border-red-900/50",
      health?.status === "degraded" && "border-amber-200 dark:border-amber-900/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Backend Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusBadge(health?.status)}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {health?.services && Object.entries(health.services).map(([key, service]) => (
          <div 
            key={key} 
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-2">
              {getServiceIcon(key)}
              <span className="text-sm font-medium">{serviceLabels[key] || key}</span>
            </div>
            <div className="flex items-center gap-3">
              {service.latency_ms !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {service.latency_ms}ms
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {getStatusIcon(service.status)}
                <span className={cn(
                  "text-xs",
                  service.status === "healthy" && "text-emerald-600 dark:text-emerald-400",
                  service.status === "degraded" && "text-amber-600 dark:text-amber-400",
                  service.status === "unhealthy" && "text-red-600 dark:text-red-400",
                  service.status === "unconfigured" && "text-muted-foreground"
                )}>
                  {service.message}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {health?.timestamp && (
          <p className="text-xs text-muted-foreground text-right pt-1">
            Last checked: {new Date(health.timestamp).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
