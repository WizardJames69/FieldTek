import { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number | null;
  created_at: string;
  due_date: string | null;
  status: string | null;
  clients?: { name: string } | null;
}

interface InvoiceAgingReportProps {
  invoices: Invoice[];
  onInvoiceClick?: (invoice: Invoice) => void;
}

interface AgingBucket {
  label: string;
  range: string;
  count: number;
  total: number;
  color: string;
  bgColor: string;
  invoices: Invoice[];
}

export function InvoiceAgingReport({ invoices, onInvoiceClick }: InvoiceAgingReportProps) {
  const agingData = useMemo(() => {
    const now = new Date();
    const outstanding = invoices.filter(
      (inv) => inv.status === 'sent' || inv.status === 'overdue'
    );

    const buckets: AgingBucket[] = [
      { label: 'Current', range: '0-30 days', count: 0, total: 0, color: 'text-green-600', bgColor: 'bg-green-500', invoices: [] },
      { label: '31-60 Days', range: '31-60 days', count: 0, total: 0, color: 'text-yellow-600', bgColor: 'bg-yellow-500', invoices: [] },
      { label: '61-90 Days', range: '61-90 days', count: 0, total: 0, color: 'text-orange-600', bgColor: 'bg-orange-500', invoices: [] },
      { label: '90+ Days', range: 'Over 90 days', count: 0, total: 0, color: 'text-destructive', bgColor: 'bg-destructive', invoices: [] },
    ];

    outstanding.forEach((invoice) => {
      const createdDate = parseISO(invoice.created_at);
      const daysOld = differenceInDays(now, createdDate);
      const amount = invoice.total || 0;

      if (daysOld <= 30) {
        buckets[0].count++;
        buckets[0].total += amount;
        buckets[0].invoices.push(invoice);
      } else if (daysOld <= 60) {
        buckets[1].count++;
        buckets[1].total += amount;
        buckets[1].invoices.push(invoice);
      } else if (daysOld <= 90) {
        buckets[2].count++;
        buckets[2].total += amount;
        buckets[2].invoices.push(invoice);
      } else {
        buckets[3].count++;
        buckets[3].total += amount;
        buckets[3].invoices.push(invoice);
      }
    });

    const totalOutstanding = buckets.reduce((sum, b) => sum + b.total, 0);

    return { buckets, totalOutstanding };
  }, [invoices]);

  const overdueInvoices = useMemo(() => {
    const now = new Date();
    return invoices
      .filter((inv) => {
        if (inv.status === 'paid' || inv.status === 'cancelled') return false;
        if (!inv.due_date) return false;
        return parseISO(inv.due_date) < now;
      })
      .map((inv) => ({
        ...inv,
        daysOverdue: differenceInDays(now, parseISO(inv.due_date!)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices]);

  if (agingData.totalOutstanding === 0 && overdueInvoices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Aging Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Invoice Aging Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {agingData.buckets.map((bucket) => {
            const percentage = agingData.totalOutstanding > 0
              ? (bucket.total / agingData.totalOutstanding) * 100
              : 0;

            return (
              <div key={bucket.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium', bucket.color)}>{bucket.label}</span>
                    <span className="text-muted-foreground text-xs">({bucket.range})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {bucket.count} invoice{bucket.count !== 1 ? 's' : ''}
                    </Badge>
                    <span className={cn('font-semibold', bucket.color)}>
                      ${bucket.total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <Progress
                  value={percentage}
                  className="h-2"
                  indicatorClassName={bucket.bgColor}
                />
              </div>
            );
          })}

          <div className="pt-2 border-t flex justify-between items-center">
            <span className="font-medium">Total Outstanding</span>
            <span className="text-lg font-bold">${agingData.totalOutstanding.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Invoices */}
      {overdueInvoices.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Overdue Invoices ({overdueInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueInvoices.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors"
                  onClick={() => onInvoiceClick?.(invoice)}
                >
                  <div>
                    <p className="font-medium text-sm">{invoice.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.clients?.name || 'Unknown Client'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {invoice.daysOverdue} days
                    </Badge>
                    <span className="font-semibold text-destructive">
                      ${(invoice.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              {overdueInvoices.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{overdueInvoices.length - 5} more overdue invoices
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
