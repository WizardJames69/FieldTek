import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Building2, Users, Briefcase, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useNavigate } from "react-router-dom";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
  user_count?: number;
  job_count?: number;
}

const subscriptionColors: Record<string, { bg: string; text: string; ring: string }> = {
  trial: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
  active: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/20" },
  past_due: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
};

const tierColors: Record<string, { bg: string; text: string; ring: string }> = {
  trial: { bg: "bg-muted/50", text: "text-muted-foreground", ring: "ring-border/30" },
  starter: { bg: "bg-info/10", text: "text-info", ring: "ring-info/20" },
  growth: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
  professional: { bg: "bg-primary/15", text: "text-primary", ring: "ring-primary/30" },
  enterprise: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
};

export default function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { startImpersonation, loading: impersonationLoading } = useImpersonation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTenants();
  }, []);

  async function handleDeleteTenant(tenantId: string, tenantName: string) {
    setDeletingId(tenantId);
    const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
    
    if (error) {
      console.error("Error deleting tenant:", error);
      toast.error("Failed to delete tenant");
    } else {
      toast.success(`Tenant "${tenantName}" deleted successfully`);
      setTenants(prev => prev.filter(t => t.id !== tenantId));
    }
    setDeletingId(null);
  }

  async function handleImpersonate(tenantId: string, tenantName: string) {
    await startImpersonation(tenantId);
    toast.success(`Now viewing as "${tenantName}"`);
    navigate('/dashboard');
  }

  async function fetchTenants() {
    setLoading(true);
    
    // Fetch tenants
    const { data: tenantsData, error: tenantsError } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (tenantsError) {
      console.error("Error fetching tenants:", tenantsError);
      setLoading(false);
      return;
    }

    // Fetch user counts per tenant
    const { data: usersData } = await supabase
      .from("tenant_users")
      .select("tenant_id");

    // Fetch job counts per tenant
    const { data: jobsData } = await supabase
      .from("scheduled_jobs")
      .select("tenant_id");

    // Aggregate counts
    const userCounts = usersData?.reduce((acc, u) => {
      acc[u.tenant_id] = (acc[u.tenant_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const jobCounts = jobsData?.reduce((acc, j) => {
      acc[j.tenant_id] = (acc[j.tenant_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const enrichedTenants = tenantsData?.map(tenant => ({
      ...tenant,
      user_count: userCounts[tenant.id] || 0,
      job_count: jobCounts[tenant.id] || 0,
    })) || [];

    setTenants(enrichedTenants);
    setLoading(false);
  }

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tenant.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === "all" || tenant.subscription_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.subscription_status === "active").length,
    trial: tenants.filter(t => t.subscription_status === "trial").length,
    churned: tenants.filter(t => t.subscription_status === "cancelled").length,
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
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Tenants</h1>
        <p className="text-muted-foreground mt-1">
          View and manage all tenants on the platform
        </p>
      </div>

      {/* Premium Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="elevated" className="metric-card-glow">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-muted/50 rounded-xl ring-1 ring-border/30">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated" className="metric-card-glow shadow-[0_0_20px_-5px_hsl(var(--success)/0.3)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-success/10 rounded-xl ring-1 ring-success/20">
                <Building2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated" className="metric-card-glow shadow-[0_0_20px_-5px_hsl(var(--warning)/0.3)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-warning/10 rounded-xl ring-1 ring-warning/20">
                <Building2 className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.trial}</p>
                <p className="text-sm text-muted-foreground">On Trial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card variant="elevated" className="metric-card-glow shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.3)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-destructive/10 rounded-xl ring-1 ring-destructive/20">
                <Building2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.churned}</p>
                <p className="text-sm text-muted-foreground">Churned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Table */}
      <Card variant="glass" className="shadow-lg">
        <CardHeader className="border-b border-border/20">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/60 backdrop-blur-sm border-border/50 focus:ring-primary/20"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-background/60 backdrop-blur-sm border-border/50">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent className="backdrop-blur-xl bg-popover/95">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {filteredTenants.length === 0 ? (
            <div className="empty-state-native py-16">
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" 
                  ? "No tenants match your filters" 
                  : "No tenants yet"}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Tenant</TableHead>
                    <TableHead className="font-semibold">Industry</TableHead>
                    <TableHead className="font-semibold">Subscription</TableHead>
                    <TableHead className="font-semibold">Users</TableHead>
                    <TableHead className="font-semibold">Jobs</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="w-24 text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => {
                    const subColor = subscriptionColors[tenant.subscription_status || "trial"];
                    const tColor = tierColors[tenant.subscription_tier || "trial"];
                    return (
                    <TableRow key={tenant.id} className="group hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tenant.industry ? (
                          <Badge variant="outline" className="capitalize bg-background/60">
                            {tenant.industry}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <span className={cn(
                            "text-xs px-2.5 py-0.5 rounded-full font-medium w-fit ring-1",
                            subColor.bg, subColor.text, subColor.ring
                          )}>
                            {tenant.subscription_status || "trial"}
                          </span>
                          <span className={cn(
                            "text-xs px-2.5 py-0.5 rounded-full font-medium w-fit ring-1",
                            tColor.bg, tColor.text, tColor.ring
                          )}>
                            {tenant.subscription_tier || "trial"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{tenant.user_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
                          <Briefcase className="h-4 w-4" />
                          <span className="font-medium">{tenant.job_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(tenant.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => handleImpersonate(tenant.id, tenant.name)}
                            disabled={impersonationLoading}
                            title="View as this tenant"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === tenant.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass-morphism">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{tenant.name}"? This will permanently remove the tenant and all associated data including users, jobs, clients, equipment, and invoices.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
