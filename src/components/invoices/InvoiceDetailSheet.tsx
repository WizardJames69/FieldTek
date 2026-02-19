import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { notifyInvoicePaid } from "@/lib/pushNotifications";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  User,
  Briefcase,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Mail,
  Loader2,
  Bell,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface LineItem {
  id: string;
  description: string;
  quantity: number | null;
  unit_price: number;
  total: number;
  item_type: string | null;
}

interface InvoiceDetailSheetProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Draft", variant: "secondary", icon: Clock },
  sent: { label: "Sent", variant: "outline", icon: Send },
  paid: { label: "Paid", variant: "default", icon: CheckCircle },
  overdue: { label: "Overdue", variant: "destructive", icon: AlertTriangle },
  cancelled: { label: "Cancelled", variant: "secondary", icon: Clock },
};

export function InvoiceDetailSheet({
  invoice,
  open,
  onOpenChange,
  onStatusChange,
}: InvoiceDetailSheetProps) {
  const { tenant } = useTenant();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const fetchLineItems = async () => {
      if (!invoice?.id || !open) return;

      setLoading(true);
      try {
        const { data } = await supabase
          .from("invoice_line_items")
          .select("*")
          .eq("invoice_id", invoice.id)
          .order("created_at");

        setLineItems(data || []);
      } catch (error) {
        console.error("Error fetching line items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLineItems();
  }, [invoice?.id, open]);

  const updateStatus = async (newStatus: string) => {
    if (!invoice) return;

    setUpdatingStatus(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "sent") updateData.sent_at = new Date().toISOString();
      if (newStatus === "paid") updateData.paid_at = new Date().toISOString();

      const { error } = await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", invoice.id);

      if (error) throw error;

      // Send push notification when marked as paid
      if (newStatus === "paid" && tenant?.id) {
        notifyInvoicePaid(tenant.id, {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          clientName: invoice.clients?.name || "Unknown Client",
          amount: invoice.total || 0,
        });
      }

      toast.success(`Invoice marked as ${newStatus}`);
      onStatusChange();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const sendInvoiceEmail = async () => {
    if (!invoice) return;

    if (!invoice.clients?.email) {
      toast.error("Client email not found. Please add an email to the client profile.");
      return;
    }

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoiceId: invoice.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Invoice sent to ${invoice.clients.email}`);
        onStatusChange();
      } else {
        throw new Error(data?.error || "Failed to send invoice");
      }
    } catch (error: any) {
      console.error("Error sending invoice:", error);
      toast.error(error.message || "Failed to send invoice email");
    } finally {
      setSendingEmail(false);
    }
  };

  const sendPaymentReminder = async () => {
    if (!invoice) return;

    if (!invoice.clients?.email) {
      toast.error("Client email not found. Please add an email to the client profile.");
      return;
    }

    setSendingReminder(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-reminder", {
        body: { invoice_id: invoice.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Payment reminder sent to ${invoice.clients.email}`);
        onStatusChange();
      } else {
        throw new Error(data?.error || "Failed to send reminder");
      }
    } catch (error: any) {
      console.error("Error sending reminder:", error);
      toast.error(error.message || "Failed to send payment reminder");
    } finally {
    setSendingReminder(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;

    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoiceId: invoice.id },
      });

      if (error) throw error;

      // Open in new window for printing/saving
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(data);
        printWindow.document.close();
        printWindow.document.title = `Invoice ${invoice.invoice_number}`;
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!invoice) return null;

  const status = statusConfig[invoice.status || "draft"];
  const StatusIcon = status.icon;

  const isOverdue = invoice.due_date && 
    new Date(invoice.due_date) < new Date() && 
    invoice.status !== "paid" && 
    invoice.status !== "cancelled";

  const canSendReminder = (invoice.status === "sent" || invoice.status === "overdue" || isOverdue) && 
    invoice.clients?.email;

  const canSendEmail = invoice.status === "draft" || invoice.status === "sent";
  const hasClientEmail = !!invoice.clients?.email;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{invoice.invoice_number}</SheetTitle>
              <SheetDescription>
                Created {format(new Date(invoice.created_at), "PPP")}
              </SheetDescription>
            </div>
            <Badge variant={isOverdue ? "destructive" : status.variant} className="flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {isOverdue ? "Overdue" : status.label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
          <div className="space-y-6 py-4">
            {/* Total Amount */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="font-medium">Total Amount</span>
                </div>
                <span className="text-2xl font-bold text-primary">
                  ${(invoice.total || 0).toFixed(2)}
                </span>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="space-y-2">
              {/* Email Action */}
              {canSendEmail && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <Button
                          className="w-full gap-2"
                          onClick={hasClientEmail ? sendInvoiceEmail : undefined}
                          disabled={sendingEmail || !hasClientEmail}
                        >
                          {sendingEmail ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4" />
                              Send Invoice via Email
                            </>
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!hasClientEmail && (
                      <TooltipContent>
                        Client has no email address on file
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Download PDF Button */}
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download / Print Invoice
                  </>
                )}
              </Button>

              <div className="flex flex-wrap gap-2">
                {invoice.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus("sent")}
                    disabled={updatingStatus}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Mark as Sent
                  </Button>
                )}
                {(invoice.status === "sent" || invoice.status === "overdue" || isOverdue) && (
                  <Button
                    size="sm"
                    onClick={() => updateStatus("paid")}
                    disabled={updatingStatus}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark as Paid
                  </Button>
                )}
                {canSendReminder && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={sendPaymentReminder}
                    disabled={sendingReminder}
                  >
                    {sendingReminder ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4 mr-1" />
                    )}
                    Send Reminder
                  </Button>
                )}
                {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatus("cancelled")}
                    disabled={updatingStatus}
                  >
                    Cancel Invoice
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Invoice Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Details</h3>

              {invoice.clients && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Client</p>
                    <p className="font-medium">{invoice.clients.name}</p>
                    {invoice.clients.email && (
                      <p className="text-xs text-muted-foreground">{invoice.clients.email}</p>
                    )}
                  </div>
                </div>
              )}

              {invoice.scheduled_jobs && (
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Linked Job</p>
                    <p className="font-medium">{invoice.scheduled_jobs.title}</p>
                  </div>
                </div>
              )}

              {invoice.due_date && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className={cn("h-4 w-4", isOverdue ? "text-destructive" : "text-muted-foreground")} />
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className={cn("font-medium", isOverdue && "text-destructive")}>
                      {format(new Date(invoice.due_date), "PPP")}
                    </p>
                  </div>
                </div>
              )}

              {invoice.sent_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="font-medium">{format(new Date(invoice.sent_at), "PPP")}</p>
                  </div>
                </div>
              )}

              {invoice.paid_at && (
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-muted-foreground">Paid</p>
                    <p className="font-medium text-green-600">
                      {format(new Date(invoice.paid_at), "PPP")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="font-semibold">Line Items</h3>

              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items</p>
              ) : (
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × ${item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <span className="font-medium">${item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${(invoice.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Total</span>
                  <span>${(invoice.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold">Notes</h3>
                  <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
