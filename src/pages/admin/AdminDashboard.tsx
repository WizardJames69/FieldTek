import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Building2, Users, Briefcase, ArrowRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { BackendHealthStatus } from "@/components/admin/BackendHealthStatus";
import { cn } from "@/lib/utils";

interface Stats {
  totalDemoRequests: number;
  pendingDemoRequests: number;
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalJobs: number;
}

interface RecentDemoRequest {
  id: string;
  name: string;
  company_name: string | null;
  email: string;
  status: string | null;
  created_at: string | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalDemoRequests: 0,
    pendingDemoRequests: 0,
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    totalJobs: 0,
  });
  const [recentRequests, setRecentRequests] = useState<RecentDemoRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [demoRes, tenantsRes, usersRes, jobsRes, recentRes] = await Promise.all([
          supabase.from("demo_requests").select("status", { count: "exact" }),
          supabase.from("tenants").select("subscription_status", { count: "exact" }),
          supabase.from("tenant_users").select("id", { count: "exact" }),
          supabase.from("scheduled_jobs").select("id", { count: "exact" }),
          supabase.from("demo_requests")
            .select("id, name, company_name, email, status, created_at")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        const pendingCount = demoRes.data?.filter(d => d.status === "pending").length || 0;
        const activeTenantsCount = tenantsRes.data?.filter(t => 
          t.subscription_status === "active" || t.subscription_status === "trial"
        ).length || 0;

        setStats({
          totalDemoRequests: demoRes.count || 0,
          pendingDemoRequests: pendingCount,
          totalTenants: tenantsRes.count || 0,
          activeTenants: activeTenantsCount,
          totalUsers: usersRes.count || 0,
          totalJobs: jobsRes.count || 0,
        });

        setRecentRequests(recentRes.data || []);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Demo Requests",
      value: stats.totalDemoRequests,
      subtitle: `${stats.pendingDemoRequests} pending`,
      icon: Calendar,
      color: "text-info",
      bgColor: "bg-info/10",
      ringColor: "ring-info/20",
      glowColor: "shadow-[0_0_20px_-5px_hsl(var(--info)/0.4)]",
      onClick: () => navigate("/admin/demo-requests"),
    },
    {
      title: "Tenants",
      value: stats.totalTenants,
      subtitle: `${stats.activeTenants} active`,
      icon: Building2,
      color: "text-success",
      bgColor: "bg-success/10",
      ringColor: "ring-success/20",
      glowColor: "shadow-[0_0_20px_-5px_hsl(var(--success)/0.4)]",
      onClick: () => navigate("/admin/tenants"),
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      subtitle: "Across all tenants",
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      ringColor: "ring-primary/20",
      glowColor: "shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)]",
      onClick: () => navigate("/admin/analytics"),
    },
    {
      title: "Total Jobs",
      value: stats.totalJobs,
      subtitle: "All time",
      icon: Briefcase,
      color: "text-warning",
      bgColor: "bg-warning/10",
      ringColor: "ring-warning/20",
      glowColor: "shadow-[0_0_20px_-5px_hsl(var(--warning)/0.4)]",
      onClick: () => navigate("/admin/analytics"),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Platform Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome to the FieldTek admin dashboard
          </p>
        </div>
        <div className="w-full md:w-80 md:shrink-0">
          <BackendHealthStatus />
        </div>
      </div>

      {/* Premium Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            variant="interactive"
            className={cn(
              "cursor-pointer group",
              stat.glowColor
            )}
            onClick={stat.onClick}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1 group-hover:text-primary transition-colors">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
                </div>
                <div className={cn(
                  "p-3.5 rounded-xl ring-1 transition-all duration-300 group-hover:scale-110",
                  stat.bgColor,
                  stat.ringColor
                )}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Demo Requests - Premium Glass Card */}
      <Card variant="glass" className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/20 pb-4">
          <div>
            <CardTitle className="text-lg">Recent Demo Requests</CardTitle>
            <CardDescription>Latest demo requests from potential customers</CardDescription>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin/demo-requests")} className="btn-shimmer">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {recentRequests.length === 0 ? (
            <div className="empty-state-native py-12">
              <p className="text-muted-foreground">No demo requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="list-item-native flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-muted/50 hover:border-primary/30 cursor-pointer transition-all duration-200"
                  onClick={() => navigate("/admin/demo-requests")}
                >
                  <div className="flex-1">
                    <p className="font-medium">{request.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.company_name || request.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium ring-1",
                      request.status === "pending" 
                        ? "bg-warning/10 text-warning ring-warning/20" 
                        : request.status === "scheduled"
                        ? "bg-info/10 text-info ring-info/20"
                        : "bg-success/10 text-success ring-success/20"
                    )}>
                      {request.status || "pending"}
                    </span>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {request.created_at 
                        ? format(new Date(request.created_at), "MMM d") 
                        : "Unknown"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
