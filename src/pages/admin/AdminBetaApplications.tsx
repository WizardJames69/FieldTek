import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Download, 
  RefreshCw,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Mail,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import { toast } from "sonner";
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
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BetaApplication {
  id: string;
  email: string;
  company_name: string;
  industry: string | null;
  technician_count: string | null;
  interest_reason: string | null;
  status: string;
  promo_code: string | null;
  created_at: string;
  updated_at: string;
  email_sent_at: string | null;
  email_error: string | null;
}

const generatePromoCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BETA-FOUNDING-${code}`;
};

export default function AdminBetaApplications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<BetaApplication | null>(null);
  
  const queryClient = useQueryClient();

  const { data: applications, isLoading, refetch } = useQuery({
    queryKey: ["admin-beta-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beta_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BetaApplication[];
    },
  });

  const sendApprovalEmail = async (application: BetaApplication, promoCode: string) => {
    const { data, error } = await supabase.functions.invoke('send-beta-approval', {
      body: {
        email: application.email,
        companyName: application.company_name,
        promoCode: promoCode,
        applicationId: application.id
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to send approval email');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  };

  const approveMutation = useMutation({
    mutationFn: async (application: BetaApplication) => {
      const promoCode = generatePromoCode();
      
      // First update the database
      const { error } = await supabase
        .from("beta_applications")
        .update({ 
          status: 'approved', 
          promo_code: promoCode,
          updated_at: new Date().toISOString()
        })
        .eq("id", application.id);

      if (error) throw error;

      // Send approval email
      try {
        await sendApprovalEmail({ ...application, id: application.id }, promoCode);
        return { promoCode, emailSent: true };
      } catch (emailError: any) {
        console.error('Failed to send approval email:', emailError);
        // Return success but note email failure
        return { promoCode, emailSent: false, emailError: emailError.message };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-beta-applications"] });
      if (data.emailSent) {
        toast.success(`Application approved and email sent! Promo code: ${data.promoCode}`);
      } else {
        toast.warning(
          `Application approved but email failed: ${data.emailError}. Promo code: ${data.promoCode}`,
          { duration: 8000 }
        );
      }
    },
    onError: (error) => {
      toast.error("Failed to approve application");
      console.error(error);
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: async (application: BetaApplication) => {
      if (!application.promo_code) {
        throw new Error('No promo code found for this application');
      }

      // Clear previous error first
      await supabase
        .from("beta_applications")
        .update({ email_error: null })
        .eq("id", application.id);

      await sendApprovalEmail(application, application.promo_code);
      return { email: application.email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-beta-applications"] });
      toast.success(`Approval email resent to ${data.email}`);
    },
    onError: (error: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-beta-applications"] });
      toast.error(`Failed to resend email: ${error.message}`);
      console.error(error);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase
        .from("beta_applications")
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq("id", applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-beta-applications"] });
      toast.success("Application rejected");
      setRejectDialogOpen(false);
      setSelectedApplication(null);
    },
    onError: (error) => {
      toast.error("Failed to reject application");
      console.error(error);
    },
  });

  const filteredApplications = applications?.filter((app) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      app.email.toLowerCase().includes(query) ||
      app.company_name.toLowerCase().includes(query) ||
      app.industry?.toLowerCase().includes(query);
    
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalApplications = applications?.length || 0;
  const pendingCount = applications?.filter((a) => a.status === "pending").length || 0;
  const approvedCount = applications?.filter((a) => a.status === "approved").length || 0;
  const thisWeekCount = applications?.filter((a) =>
    isAfter(new Date(a.created_at), subDays(new Date(), 7))
  ).length || 0;
  const emailFailedCount = applications?.filter(
    (a) => a.status === "approved" && a.email_error
  ).length || 0;

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Promo code copied to clipboard");
  };

  const handleExportCSV = () => {
    if (!applications || applications.length === 0) {
      toast.error("No applications to export");
      return;
    }

    const headers = ["Email", "Company", "Industry", "Team Size", "Status", "Promo Code", "Applied", "Email Sent", "Email Error", "Interest Reason"];
    const rows = applications.map((a) => [
      a.email,
      a.company_name,
      a.industry || "",
      a.technician_count || "",
      a.status,
      a.promo_code || "",
      format(new Date(a.created_at), "yyyy-MM-dd HH:mm"),
      a.email_sent_at ? format(new Date(a.email_sent_at), "yyyy-MM-dd HH:mm") : "",
      a.email_error || "",
      (a.interest_reason || "").replace(/,/g, ";").replace(/\n/g, " "),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fieldtek-beta-applications-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Applications exported successfully");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getEmailStatusBadge = (app: BetaApplication) => {
    if (app.status !== "approved") return null;
    
    if (app.email_error) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="cursor-help">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Email Failed
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{app.email_error}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    if (app.email_sent_at) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-green-600 cursor-help">
                <Mail className="h-3 w-3 mr-1" />
                Email Sent
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Sent {format(new Date(app.email_sent_at), "MMM d, yyyy 'at' h:mm a")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-amber-600">
        <Clock className="h-3 w-3 mr-1" />
        Email Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Beta Applications</h1>
        <p className="text-muted-foreground">
          Review and manage beta program applications
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalApplications}</div>
            <p className="text-xs text-muted-foreground">
              All time beta applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting your decision
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">
              {approvedCount}/10 founding members
            </p>
          </CardContent>
        </Card>

        <Card className={emailFailedCount > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {emailFailedCount > 0 ? "Email Failures" : "This Week"}
            </CardTitle>
            {emailFailedCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${emailFailedCount > 0 ? "text-destructive" : ""}`}>
              {emailFailedCount > 0 ? emailFailedCount : thisWeekCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {emailFailedCount > 0 ? "Emails need to be resent" : "New applications in 7 days"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All Applications</CardTitle>
              <CardDescription>
                {filteredApplications?.length || 0} application{filteredApplications?.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email, company, or industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredApplications && filteredApplications.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Team Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.map((app) => (
                    <Collapsible key={app.id} asChild open={expandedRows.has(app.id)}>
                      <>
                        <TableRow className="group">
                          <TableCell>
                            {app.interest_reason && (
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => toggleRow(app.id)}
                                >
                                  {expandedRows.has(app.id) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{app.email}</TableCell>
                          <TableCell>{app.company_name}</TableCell>
                          <TableCell>
                            {app.industry ? (
                              <Badge variant="secondary" className="capitalize">{app.industry}</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{app.technician_count || "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {getStatusBadge(app.status)}
                                {app.promo_code && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs font-mono"
                                    onClick={() => copyPromoCode(app.promo_code!)}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    {app.promo_code}
                                  </Button>
                                )}
                              </div>
                              {getEmailStatusBadge(app)}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(app.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {app.status === "pending" && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => approveMutation.mutate(app)}
                                  disabled={approveMutation.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
{app.status === "approved" && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => resendEmailMutation.mutate(app)}
                                  disabled={resendEmailMutation.isPending}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  {resendEmailMutation.isPending ? "Sending..." : "Resend Email"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setSelectedApplication(app);
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Revoke
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={8} className="py-3">
                              <div className="pl-8">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Interest Reason:</p>
                                <p className="text-sm whitespace-pre-wrap">{app.interest_reason}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No applications yet</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "No applications match your criteria"
                  : "Beta applications will appear here"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedApplication?.status === "approved" ? "Revoke Approval" : "Reject Application"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedApplication?.status === "approved" ? (
                <>
                  Are you sure you want to revoke the approval for{" "}
                  <span className="font-medium">{selectedApplication?.company_name}</span> ({selectedApplication?.email})?
                  Their promo code <span className="font-mono text-xs bg-muted px-1 rounded">{selectedApplication?.promo_code}</span> will no longer work.
                </>
              ) : (
                <>
                  Are you sure you want to reject the application from{" "}
                  <span className="font-medium">{selectedApplication?.company_name}</span> ({selectedApplication?.email})?
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedApplication && rejectMutation.mutate(selectedApplication.id)}
            >
              {selectedApplication?.status === "approved" ? "Revoke Approval" : "Reject Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
