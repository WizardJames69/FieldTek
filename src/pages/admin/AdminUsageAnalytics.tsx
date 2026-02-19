import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  Users,
  Briefcase,
  Building2,
  Search,
  Download,
  RefreshCw
} from "lucide-react";
import { TIER_CONFIG, SubscriptionTier } from "@/config/pricing";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth } from "date-fns";

interface TenantUsage {
  id: string;
  name: string;
  subscription_tier: SubscriptionTier;
  subscription_status: string;
  techCount: number;
  jobsThisMonth: number;
  clientCount: number;
  jobsPercent: number;
  techsPercent: number;
  upgradeOpportunity: "high" | "medium" | "low" | "none";
  lastJobDate: string | null;
  created_at: string;
}

interface AnalyticsSummary {
  totalTenants: number;
  tenantsNearLimit: number;
  upgradeOpportunities: number;
  avgJobUsage: number;
  trialConversions: number;
  tierBreakdown: { tier: string; count: number }[];
}

export default function AdminUsageAnalytics() {
  const [tenants, setTenants] = useState<TenantUsage[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterOpportunity, setFilterOpportunity] = useState<string>("all");

  useEffect(() => {
    fetchUsageData();
  }, []);

  async function fetchUsageData() {
    setLoading(true);

    const startOfCurrentMonth = startOfMonth(new Date());

    // Fetch all tenants with their data
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select("id, name, subscription_tier, subscription_status, created_at")
      .order("created_at", { ascending: false });

    if (!tenantsData) {
      setLoading(false);
      return;
    }

    // Fetch usage stats for each tenant
    const tenantUsages: TenantUsage[] = await Promise.all(
      tenantsData.map(async (tenant) => {
        const [techRes, jobsRes, clientsRes, lastJobRes] = await Promise.all([
          supabase
            .from("tenant_users")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("role", "technician")
            .eq("is_active", true),
          supabase
            .from("scheduled_jobs")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .gte("created_at", startOfCurrentMonth.toISOString()),
          supabase
            .from("clients")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenant.id),
          supabase
            .from("scheduled_jobs")
            .select("created_at")
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        const tier = (tenant.subscription_tier || "trial") as SubscriptionTier;
        const tierConfig = TIER_CONFIG[tier];
        
        const techCount = techRes.count || 0;
        const jobsThisMonth = jobsRes.count || 0;
        const clientCount = clientsRes.count || 0;

        const jobsLimit = typeof tierConfig.jobsPerMonth === "number" ? tierConfig.jobsPerMonth : null;
        const techsLimit = typeof tierConfig.includedTechs === "number" ? tierConfig.includedTechs : null;

        const jobsPercent = jobsLimit ? Math.min((jobsThisMonth / jobsLimit) * 100, 100) : 0;
        const techsPercent = techsLimit ? Math.min((techCount / techsLimit) * 100, 100) : 0;

        // Determine upgrade opportunity
        let upgradeOpportunity: "high" | "medium" | "low" | "none" = "none";
        if (tier !== "professional" && tier !== "enterprise") {
          if (jobsPercent >= 80 || techsPercent >= 80) {
            upgradeOpportunity = "high";
          } else if (jobsPercent >= 50 || techsPercent >= 50 || jobsThisMonth > 30) {
            upgradeOpportunity = "medium";
          } else if (jobsThisMonth > 10 || clientCount > 10) {
            upgradeOpportunity = "low";
          }
        }

        return {
          id: tenant.id,
          name: tenant.name,
          subscription_tier: tier,
          subscription_status: tenant.subscription_status || "trial",
          techCount,
          jobsThisMonth,
          clientCount,
          jobsPercent,
          techsPercent,
          upgradeOpportunity,
          lastJobDate: lastJobRes.data?.[0]?.created_at || null,
          created_at: tenant.created_at,
        };
      })
    );

    // Calculate summary
    const tenantsNearLimit = tenantUsages.filter(
      t => t.jobsPercent >= 80 || t.techsPercent >= 80
    ).length;
    const upgradeOpportunities = tenantUsages.filter(
      t => t.upgradeOpportunity === "high" || t.upgradeOpportunity === "medium"
    ).length;
    const avgJobUsage = tenantUsages.length > 0
      ? tenantUsages.reduce((acc, t) => acc + t.jobsPercent, 0) / tenantUsages.length
      : 0;

    // Tier breakdown
    const tierCounts: Record<string, number> = {};
    tenantUsages.forEach(t => {
      const tier = t.subscription_tier;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });
    const tierBreakdown = Object.entries(tierCounts).map(([tier, count]) => ({ tier, count }));

    // Count trial conversions (tenants with active subscriptions)
    const trialConversions = tenantUsages.filter(
      t => t.subscription_status === "active" && t.subscription_tier !== "trial"
    ).length;

    setSummary({
      totalTenants: tenantUsages.length,
      tenantsNearLimit,
      upgradeOpportunities,
      avgJobUsage,
      trialConversions,
      tierBreakdown,
    });

    setTenants(tenantUsages);
    setLoading(false);
  }

  // Filter tenants
  const filteredTenants = tenants.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === "all" || t.subscription_tier === filterTier;
    const matchesOpportunity = filterOpportunity === "all" || t.upgradeOpportunity === filterOpportunity;
    return matchesSearch && matchesTier && matchesOpportunity;
  });

  // Export to CSV
  const exportToCsv = () => {
    const headers = ["Name", "Tier", "Status", "Technicians", "Jobs This Month", "Clients", "Jobs %", "Upgrade Opportunity"];
    const rows = filteredTenants.map(t => [
      t.name,
      t.subscription_tier,
      t.subscription_status,
      t.techCount,
      t.jobsThisMonth,
      t.clientCount,
      `${Math.round(t.jobsPercent)}%`,
      t.upgradeOpportunity,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenant-usage-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Monitor tenant usage patterns and identify upgrade opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsageData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalTenants}</p>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.tenantsNearLimit}</p>
                  <p className="text-sm text-muted-foreground">Near Limits</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.upgradeOpportunities}</p>
                  <p className="text-sm text-muted-foreground">Upgrade Opportunities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Zap className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(summary.avgJobUsage)}%</p>
                  <p className="text-sm text-muted-foreground">Avg Job Usage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tier Breakdown */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Tier Distribution</CardTitle>
            <CardDescription>Current breakdown of tenants by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {summary.tierBreakdown.map(({ tier, count }) => {
                const tierConfig = TIER_CONFIG[tier as SubscriptionTier];
                return (
                  <div key={tier} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                    <Badge className={cn(tierConfig?.color || "bg-muted")}>
                      {tierConfig?.name || tier}
                    </Badge>
                    <span className="text-lg font-semibold">{count}</span>
                    <span className="text-sm text-muted-foreground">tenants</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant Usage Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Tenant Usage Details</CardTitle>
              <CardDescription>Detailed view of each tenant's usage and upgrade potential</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={filterTier} onValueChange={setFilterTier}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterOpportunity} onValueChange={setFilterOpportunity}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Opportunities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Technicians</TableHead>
                  <TableHead>Jobs (Month)</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Opportunity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No tenants found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((tenant) => {
                    const tierConfig = TIER_CONFIG[tenant.subscription_tier];
                    return (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tenant.lastJobDate 
                                ? `Last job: ${format(new Date(tenant.lastJobDate), "MMM d")}`
                                : "No jobs yet"
                              }
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(tierConfig.color, "text-xs")}>
                            {tierConfig.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {tenant.techCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            {tenant.jobsThisMonth}
                          </div>
                        </TableCell>
                        <TableCell>{tenant.clientCount}</TableCell>
                        <TableCell>
                          <div className="w-24">
                            <Progress 
                              value={tenant.jobsPercent} 
                              className={cn(
                                "h-2",
                                tenant.jobsPercent >= 80 && "[&>div]:bg-warning",
                                tenant.jobsPercent >= 95 && "[&>div]:bg-destructive"
                              )}
                            />
                            <span className="text-xs text-muted-foreground">
                              {Math.round(tenant.jobsPercent)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <OpportunityBadge level={tenant.upgradeOpportunity} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OpportunityBadge({ level }: { level: "high" | "medium" | "low" | "none" }) {
  const styles = {
    high: "bg-destructive/10 text-destructive border-destructive/30",
    medium: "bg-warning/10 text-warning border-warning/30",
    low: "bg-primary/10 text-primary border-primary/30",
    none: "bg-muted text-muted-foreground",
  };

  const labels = {
    high: "High Priority",
    medium: "Medium",
    low: "Low",
    none: "None",
  };

  const icons = {
    high: <ArrowUpRight className="h-3 w-3" />,
    medium: <TrendingUp className="h-3 w-3" />,
    low: <TrendingUp className="h-3 w-3" />,
    none: null,
  };

  return (
    <Badge variant="outline" className={cn("gap-1", styles[level])}>
      {icons[level]}
      {labels[level]}
    </Badge>
  );
}
