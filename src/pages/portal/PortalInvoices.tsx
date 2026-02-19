import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, DollarSign, AlertCircle, CheckCircle, CreditCard, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';
import { PortalAuthGuard } from '@/components/portal/PortalAuthGuard';

export default function PortalInvoices() {
  const { client, loading: authLoading, clientLoading, user } = usePortalAuth();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['portal-invoices', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];

      const { data } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          status,
          subtotal,
          tax_amount,
          total,
          due_date,
          paid_at,
          sent_at,
          created_at,
          notes
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!client?.id,
  });

  const getStatusBadge = (status: string, dueDate: string | null) => {
    if (status === 'paid') {
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    }
    if (status === 'overdue' || (dueDate && isPast(new Date(dueDate)) && status !== 'paid')) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    if (status === 'sent') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const totalOutstanding = invoices
    ?.filter(i => i.status !== 'paid' && i.status !== 'draft')
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0) || 0;

  const totalPaid = invoices
    ?.filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0) || 0;

  const handlePayInvoice = async (invoiceId: string) => {
    setPayingInvoiceId(invoiceId);

    try {
      const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
        body: { invoiceId },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe Checkout (avoids pop-up blockers)
        window.location.href = data.url;
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start payment');
    } finally {
    setPayingInvoiceId(null);
    }
  };

  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { invoiceId },
      });

      if (error) throw error;

      // Create blob and download directly (avoids popup blockers on mobile)
      const blob = new Blob([data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoiceNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Invoice downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download invoice');
    }
  };

  const canPayInvoice = (status: string | null) => {
    return status === 'sent' || status === 'overdue';
  };

  return (
    <PortalAuthGuard>
    <PortalLayout>
      <div className="space-y-6">
        <div className="page-header-glass rounded-xl p-4 md:p-6 bg-background/60 backdrop-blur-xl border border-border/30">
          <h1 className="text-2xl font-bold font-display">Invoices</h1>
          <p className="text-muted-foreground">View and manage your invoices</p>
        </div>

        {/* Summary Cards with 3D effect */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="elevated" glow="primary" className="metric-card-glow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold font-display">{invoices?.length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" glow="warning" className="metric-card-glow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold font-display text-warning">${totalOutstanding.toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--warning)/0.2)]">
                  <DollarSign className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" glow="success" className="metric-card-glow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold font-display text-success">${totalPaid.toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--success)/0.2)]">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="font-display">Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : invoices?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 empty-state-native">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No invoices found</p>
              </div>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="space-y-3 sm:hidden">
                  {invoices?.map(invoice => (
                    <div key={invoice.id} className="p-4 rounded-lg border border-border/30 bg-background/40 backdrop-blur-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{invoice.invoice_number}</span>
                        {getStatusBadge(invoice.status || 'draft', invoice.due_date)}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                        </span>
                        <span className="font-semibold font-display text-lg">
                          ${Number(invoice.total || 0).toFixed(2)}
                        </span>
                      </div>
                      {invoice.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="touch-native flex-1"
                          onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        {canPayInvoice(invoice.status) && (
                          <Button
                            size="sm"
                            className="btn-shimmer touch-native flex-1"
                            onClick={() => handlePayInvoice(invoice.id)}
                            disabled={payingInvoiceId === invoice.id}
                          >
                            {payingInvoiceId === invoice.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pay Now
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table layout */}
                <div className="overflow-x-auto -mx-6 px-6 hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Invoice #</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Date</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Due Date</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Amount</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices?.map(invoice => (
                        <TableRow key={invoice.id} className="list-item-native border-border/30 group">
                          <TableCell className="font-medium font-mono text-sm">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {invoice.due_date
                              ? format(new Date(invoice.due_date), 'MMM d, yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invoice.status || 'draft', invoice.due_date)}
                          </TableCell>
                          <TableCell className="text-right font-semibold font-display">
                            ${Number(invoice.total || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="touch-native opacity-70 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}
                              >
                                <Download className="h-4 w-4" />
                                <span className="sr-only">Download</span>
                              </Button>
                              {canPayInvoice(invoice.status) && (
                                <Button
                                  size="sm"
                                  className="btn-shimmer touch-native"
                                  onClick={() => handlePayInvoice(invoice.id)}
                                  disabled={payingInvoiceId === invoice.id}
                                >
                                  {payingInvoiceId === invoice.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CreditCard className="h-4 w-4 mr-1" />
                                      Pay Now
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
    </PortalAuthGuard>
  );
}
