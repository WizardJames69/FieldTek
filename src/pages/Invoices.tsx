import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useUserRole } from "@/contexts/TenantContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { InvoiceFormDialog } from "@/components/invoices/InvoiceFormDialog";
import { InvoiceDetailSheet } from "@/components/invoices/InvoiceDetailSheet";
import { InvoiceAgingReport } from "@/components/invoices/InvoiceAgingReport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Search,
  Loader2,
  Receipt,
  Clock,
  Send,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  ChevronDown,
  TrendingUp,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSelection } from "@/hooks/useSelection";
import { SelectCheckbox, SelectAllCheckbox } from "@/components/bulk/SelectCheckbox";
import { BulkActionToolbar } from "@/components/bulk/BulkActionToolbar";
import { BulkConfirmDialog } from "@/components/bulk/BulkConfirmDialog";
import { exportInvoicesToCsv } from "@/lib/exportCsv";

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  job_id: string | null;
  due_date: string | null;
  notes: string | null;
  status: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total: number | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
  clients?: { id: string; name: string; email: string | null } | null;
  scheduled_jobs?: { id: string; title: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-700", icon: Send },
  paid: { label: "Paid", color: "bg-green-500/20 text-green-700", icon: CheckCircle },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground", icon: Clock },
};

export default function Invoices() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { isAdmin } = useUserRole();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [agingReportOpen, setAgingReportOpen] = useState(true);

  // Bulk selection
  const selection = useSelection();
  const [bulkPaidLoading, setBulkPaidLoading] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Stats
  const stats = {
    total: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
    paid: invoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + (inv.total || 0), 0),
    outstanding: invoices.filter(inv => ["sent", "overdue"].includes(inv.status || "")).reduce((sum, inv) => sum + (inv.total || 0), 0),
    overdue: invoices.filter(inv => inv.status === "overdue" || (inv.due_date && new Date(inv.due_date) < new Date() && inv.status === "sent")).length,
  };

  const fetchInvoices = useCallback(async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          client_id,
          job_id,
          due_date,
          notes,
          status,
          subtotal,
          tax_amount,
          total,
          created_at,
          sent_at,
          paid_at,
          clients (id, name, email),
          scheduled_jobs (id, title)
        `)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Check for overdue invoices
      const processedInvoices = (data || []).map(inv => {
        if (inv.due_date && new Date(inv.due_date) < new Date() && inv.status === "sent") {
          return { ...inv, status: "overdue" };
        }
        return inv;
      });

      setInvoices(processedInvoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!tenantLoading && !tenant) {
      navigate("/onboarding");
      return;
    }
  }, [user, tenant, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    if (tenant?.id) {
      fetchInvoices();
    }
  }, [tenant?.id, fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        searchQuery === "" ||
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.clients?.name.toLowerCase().includes(searchQuery.toLowerCase());

      const effectiveStatus = inv.due_date && new Date(inv.due_date) < new Date() && inv.status === "sent" ? "overdue" : inv.status;
      const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  const filteredInvoiceIds = useMemo(() => filteredInvoices.map(i => i.id), [filteredInvoices]);

  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailOpen(true);
  };

  // Bulk operations
  const handleBulkMarkPaid = async () => {
    setBulkPaidLoading(true);
    try {
      const ids = selection.selectedArray;
      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;

      setInvoices(invoices.map(inv => 
        ids.includes(inv.id) ? { ...inv, status: "paid", paid_at: new Date().toISOString() } : inv
      ));
      toast.success(`${ids.length} invoices marked as paid`);
      selection.clearAll();
    } catch (error: any) {
      toast.error("Error updating invoices");
    } finally {
      setBulkPaidLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const ids = selection.selectedArray;
      const { error } = await supabase
        .from("invoices")
        .delete()
        .in("id", ids);

      if (error) throw error;

      setInvoices(invoices.filter(inv => !ids.includes(inv.id)));
      toast.success(`${ids.length} invoices deleted`);
      selection.clearAll();
      setBulkDeleteOpen(false);
    } catch (error: any) {
      toast.error("Error deleting invoices");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExportSelected = () => {
    const selectedInvoices = invoices.filter(inv => selection.selectedIds.has(inv.id));
    exportInvoicesToCsv(selectedInvoices);
    toast.success(`Exported ${selectedInvoices.length} invoices to CSV`);
  };

  if (authLoading || tenantLoading) {
    return (
      <MainLayout title="Invoices">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout title="Invoices">
        <Card className="p-12 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            Only administrators can access invoicing features.
          </p>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Invoices">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Invoices</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Create, send, and track invoices
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" data-testid="invoices-create-button">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Create Invoice</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* Stats - Phase 5: Enhanced stat cards with glass effect */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="stat-card-glass overflow-hidden">
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Total Invoiced</span>
              </div>
              <p className="text-2xl font-bold">${stats.total.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="stat-card-glass overflow-hidden border-green-500/20">
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-2 text-green-600 mb-1 relative">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Collected</span>
              </div>
              <p className="text-2xl font-bold text-green-600 relative">${stats.paid.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="stat-card-glass overflow-hidden border-orange-500/20">
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-2 text-orange-600 mb-1 relative">
                <Send className="h-4 w-4" />
                <span className="text-sm">Outstanding</span>
              </div>
              <p className="text-2xl font-bold text-orange-600 relative">${stats.outstanding.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="stat-card-glass overflow-hidden border-destructive/20">
            <CardContent className="p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none" />
              <div className="flex items-center gap-2 text-destructive mb-1 relative">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Overdue</span>
              </div>
              <p className="text-2xl font-bold text-destructive relative">{stats.overdue}</p>
            </CardContent>
          </Card>
        </div>

        {/* Aging Report Collapsible */}
        {invoices.length > 0 && (
          <Collapsible open={agingReportOpen} onOpenChange={setAgingReportOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  Invoice Aging & Overdue Report
                </div>
                <ChevronDown className={cn("h-4 w-4 transition-transform", agingReportOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <InvoiceAgingReport invoices={invoices} onInvoiceClick={handleInvoiceClick} />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Filters - Phase 5: Glass filter card */}
        <Card className="backdrop-blur-sm bg-card/80">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {filteredInvoices.length > 0 && (
                <SelectAllCheckbox
                  checked={selection.isAllSelected(filteredInvoiceIds)}
                  indeterminate={selection.isPartiallySelected(filteredInvoiceIds)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selection.selectAll(filteredInvoiceIds);
                    } else {
                      selection.clearAll();
                    }
                  }}
                  className="flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices or clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        {loading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <Card className="p-12 text-center border-dashed" data-testid="invoices-empty-state">
            {/* Phase 5: Enhanced empty state with radial glow */}
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-xl" />
              <div className="relative flex items-center justify-center empty-state-glow">
                <Receipt className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
            <p className="text-muted-foreground mb-4">
              {invoices.length === 0
                ? "Create your first invoice to get started"
                : "Try adjusting your filters"}
            </p>
            {invoices.length === 0 && (
              <Button onClick={() => setDialogOpen(true)} className="touch-native">
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            )}
          </Card>
        ) : (
          <Card data-testid="invoices-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => {
                  const effectiveStatus = inv.due_date && new Date(inv.due_date) < new Date() && inv.status === "sent" ? "overdue" : (inv.status || "draft");
                  const status = statusConfig[effectiveStatus];
                  const StatusIcon = status.icon;

                  return (
                    <TableRow
                      key={inv.id}
                      className={cn(
                        "cursor-pointer",
                        selection.isSelected(inv.id) && "bg-primary/5"
                      )}
                      onClick={() => handleInvoiceClick(inv)}
                      data-testid="invoice-row"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <SelectCheckbox
                          checked={selection.isSelected(inv.id)}
                          onCheckedChange={() => selection.toggle(inv.id)}
                          aria-label={`Select ${inv.invoice_number}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>
                        {inv.clients?.name || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(inv.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className={cn(effectiveStatus === "overdue" && "text-destructive")}>
                        {inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${(inv.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("flex items-center gap-1 w-fit", status.color)}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selection.count}
        onClearSelection={selection.clearAll}
      >
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleBulkMarkPaid}
          disabled={bulkPaidLoading}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark Paid
        </Button>

        <Button size="sm" variant="outline" onClick={handleExportSelected}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>

        <Button 
          size="sm" 
          variant="outline" 
          className="text-destructive hover:text-destructive"
          onClick={() => setBulkDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </BulkActionToolbar>

      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete Selected Invoices"
        description={`Are you sure you want to delete ${selection.count} invoices? This action cannot be undone.`}
        actionLabel="Delete Invoices"
        onConfirm={handleBulkDelete}
        isLoading={bulkDeleteLoading}
        variant="destructive"
      />

      <InvoiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchInvoices}
      />

      <InvoiceDetailSheet
        invoice={selectedInvoice}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={() => {
          fetchInvoices();
          setDetailOpen(false);
        }}
      />
    </MainLayout>
  );
}
