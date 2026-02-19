import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  CalendarCheck,
  Rocket,
  CreditCard
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface DemoRequest {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  industry: string | null;
  status: string;
  pipeline_stage: string;
  created_at: string;
  scheduled_at: string | null;
  demo_completed_at: string | null;
  trial_started_at: string | null;
  converted_at: string | null;
  converted_tenant_id: string | null;
}

interface TenantWithProgress {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  created_at: string;
  trial_ends_at: string | null;
  onboarding: {
    company_info_completed: boolean;
    branding_completed: boolean;
    first_team_member_invited: boolean;
    first_client_added: boolean;
    first_job_created: boolean;
    first_invoice_created: boolean;
    payment_method_added: boolean;
    onboarding_completed: boolean;
  } | null;
}

const pipelineStages = [
  { key: "new", label: "New Leads", icon: Users, color: "bg-slate-500" },
  { key: "scheduled", label: "Demo Scheduled", icon: CalendarCheck, color: "bg-blue-500" },
  { key: "demo_completed", label: "Demo Done", icon: CheckCircle2, color: "bg-purple-500" },
  { key: "trial", label: "In Trial", icon: Rocket, color: "bg-amber-500" },
  { key: "converted", label: "Converted", icon: CreditCard, color: "bg-green-500" },
];

const stageColors: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  scheduled: "bg-blue-100 text-blue-700",
  demo_completed: "bg-purple-100 text-purple-700",
  trial: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
};

export default function AdminOnboardingPipeline() {
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [tenants, setTenants] = useState<TenantWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pipeline");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    // Fetch demo requests
    const { data: demoData, error: demoError } = await supabase
      .from("demo_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (demoError) {
      console.error("Error fetching demo requests:", demoError);
    } else {
      setDemoRequests(demoData || []);
    }

    // Fetch tenants with onboarding progress
    const { data: tenantsData, error: tenantsError } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (tenantsError) {
      console.error("Error fetching tenants:", tenantsError);
    } else {
      // Fetch onboarding progress for all tenants
      const { data: progressData } = await supabase
        .from("onboarding_progress")
        .select("*");

      const progressMap = new Map(
        progressData?.map((p) => [p.tenant_id, p]) || []
      );

      const enrichedTenants = tenantsData?.map((tenant) => ({
        ...tenant,
        onboarding: progressMap.get(tenant.id) || null,
      })) || [];

      setTenants(enrichedTenants);
    }

    setLoading(false);
  }

  async function updatePipelineStage(requestId: string, newStage: string) {
    const updates: Record<string, any> = { pipeline_stage: newStage };
    
    if (newStage === "demo_completed") {
      updates.demo_completed_at = new Date().toISOString();
    } else if (newStage === "trial") {
      updates.trial_started_at = new Date().toISOString();
    } else if (newStage === "converted") {
      updates.converted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("demo_requests")
      .update(updates)
      .eq("id", requestId);

    if (error) {
      toast.error("Failed to update stage");
    } else {
      toast.success("Pipeline stage updated");
      fetchData();
    }
  }

  const getOnboardingProgress = (onboarding: TenantWithProgress["onboarding"]) => {
    if (!onboarding) return 0;
    const steps = [
      onboarding.company_info_completed,
      onboarding.branding_completed,
      onboarding.first_team_member_invited,
      onboarding.first_client_added,
      onboarding.first_job_created,
      onboarding.first_invoice_created,
      onboarding.payment_method_added,
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  };

  const pipelineCounts = pipelineStages.map((stage) => ({
    ...stage,
    count: demoRequests.filter((d) => (d.pipeline_stage || "new") === stage.key).length,
  }));

  const onboardingStats = {
    total: tenants.length,
    completed: tenants.filter((t) => t.onboarding?.onboarding_completed).length,
    inProgress: tenants.filter((t) => t.onboarding && !t.onboarding.onboarding_completed && getOnboardingProgress(t.onboarding) > 0).length,
    notStarted: tenants.filter((t) => !t.onboarding || getOnboardingProgress(t.onboarding) === 0).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
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
        <h1 className="text-3xl font-bold">Onboarding Pipeline</h1>
        <p className="text-muted-foreground mt-1">
          Track leads from demo to fully onboarded customers
        </p>
      </div>

      {/* Pipeline Funnel */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {pipelineCounts.map((stage, index) => (
          <Card key={stage.key} className="relative overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stage.color} text-white`}>
                  <stage.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stage.count}</p>
                  <p className="text-xs text-muted-foreground">{stage.label}</p>
                </div>
                {index < pipelineCounts.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block absolute right-2" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Demo Pipeline</TabsTrigger>
          <TabsTrigger value="onboarding">Tenant Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Demo Request Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {demoRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">
                  No demo requests yet
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead className="w-48">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demoRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.name}</p>
                              <p className="text-sm text-muted-foreground">{request.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{request.company_name || "-"}</p>
                              {request.industry && (
                                <Badge variant="outline" className="capitalize text-xs">
                                  {request.industry}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              stageColors[request.pipeline_stage || "new"]
                            }`}>
                              {pipelineStages.find((s) => s.key === (request.pipeline_stage || "new"))?.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(request.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {request.converted_at
                              ? `Converted ${formatDistanceToNow(new Date(request.converted_at))} ago`
                              : request.trial_started_at
                              ? `Trial started ${formatDistanceToNow(new Date(request.trial_started_at))} ago`
                              : request.demo_completed_at
                              ? `Demo ${formatDistanceToNow(new Date(request.demo_completed_at))} ago`
                              : request.scheduled_at
                              ? `Scheduled ${format(new Date(request.scheduled_at), "MMM d")}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={request.pipeline_stage || "new"}
                              onValueChange={(value) => updatePipelineStage(request.id, value)}
                            >
                              <SelectTrigger className="w-40 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {pipelineStages.map((stage) => (
                                  <SelectItem key={stage.key} value={stage.key}>
                                    {stage.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6 space-y-6">
          {/* Onboarding Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{onboardingStats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Tenants</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{onboardingStats.completed}</p>
                    <p className="text-sm text-muted-foreground">Fully Onboarded</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{onboardingStats.inProgress}</p>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Users className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{onboardingStats.notStarted}</p>
                    <p className="text-sm text-muted-foreground">Not Started</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tenant Onboarding Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tenant Setup Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {tenants.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">
                  No tenants yet
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-64">Setup Progress</TableHead>
                        <TableHead>Steps Completed</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map((tenant) => {
                        const progress = getOnboardingProgress(tenant.onboarding);
                        const completedSteps = tenant.onboarding
                          ? [
                              tenant.onboarding.company_info_completed,
                              tenant.onboarding.branding_completed,
                              tenant.onboarding.first_team_member_invited,
                              tenant.onboarding.first_client_added,
                              tenant.onboarding.first_job_created,
                              tenant.onboarding.first_invoice_created,
                              tenant.onboarding.payment_method_added,
                            ].filter(Boolean).length
                          : 0;

                        return (
                          <TableRow key={tenant.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{tenant.name}</p>
                                <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  tenant.subscription_status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {tenant.subscription_status || "trial"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Progress value={progress} className="flex-1" />
                                <span className="text-sm font-medium w-10">{progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {tenant.onboarding?.company_info_completed && (
                                  <Badge variant="outline" className="text-xs">Company</Badge>
                                )}
                                {tenant.onboarding?.branding_completed && (
                                  <Badge variant="outline" className="text-xs">Branding</Badge>
                                )}
                                {tenant.onboarding?.first_team_member_invited && (
                                  <Badge variant="outline" className="text-xs">Team</Badge>
                                )}
                                {tenant.onboarding?.first_client_added && (
                                  <Badge variant="outline" className="text-xs">Client</Badge>
                                )}
                                {tenant.onboarding?.first_job_created && (
                                  <Badge variant="outline" className="text-xs">Job</Badge>
                                )}
                                {tenant.onboarding?.first_invoice_created && (
                                  <Badge variant="outline" className="text-xs">Invoice</Badge>
                                )}
                                {tenant.onboarding?.payment_method_added && (
                                  <Badge variant="outline" className="text-xs">Payment</Badge>
                                )}
                                {completedSteps === 0 && (
                                  <span className="text-muted-foreground text-sm">None yet</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(tenant.created_at), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
