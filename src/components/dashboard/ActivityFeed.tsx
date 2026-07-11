import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Clipboard, ReceiptText, Inbox, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorState } from '@/components/ui/QueryErrorState';
import { useTenant } from '@/contexts/TenantContext';
import { useTerminology } from '@/hooks/useTerminology';
import { supabase } from '@/integrations/supabase/client';

type ActivityItem = {
  id: string;
  kind: 'job' | 'invoice' | 'request';
  icon: LucideIcon;
  label: string;
  detail: string | null;
  timestamp: string;
  href: string;
};

const JOB_VERBS: Record<string, string> = {
  completed: 'completed',
  in_progress: 'started',
  cancelled: 'cancelled',
  scheduled: 'scheduled',
  pending: 'created',
};

const INVOICE_VERBS: Record<string, string> = {
  paid: 'paid',
  sent: 'sent',
  overdue: 'overdue',
  cancelled: 'cancelled',
  draft: 'created',
};

/**
 * Recent workspace activity: the latest job, invoice, and service-request
 * events merged into one timeline. Three bounded read-only selects (limit 5
 * each, 60s staleTime) aggregated client-side — no backend changes.
 */
export function ActivityFeed() {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { t } = useTerminology();

  const { data: items, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['dashboard-activity', tenant?.id],
    staleTime: 60_000,
    enabled: !!tenant?.id,
    queryFn: async (): Promise<ActivityItem[]> => {
      if (!tenant?.id) return [];

      const [jobsRes, invoicesRes, requestsRes] = await Promise.all([
        supabase
          .from('scheduled_jobs')
          .select('id, title, status, updated_at, clients(name)')
          .eq('tenant_id', tenant.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('invoices')
          .select('id, invoice_number, status, updated_at, clients(name)')
          .eq('tenant_id', tenant.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('service_requests')
          .select('id, title, created_at, clients(name)')
          .eq('tenant_id', tenant.id)
          .eq('status', 'new')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (requestsRes.error) throw requestsRes.error;

      const jobItems: ActivityItem[] = (jobsRes.data ?? []).map((job) => ({
        id: `job-${job.id}`,
        kind: 'job',
        icon: Clipboard,
        label: `${t('job')} ${JOB_VERBS[job.status ?? ''] ?? 'updated'}: ${job.title}`,
        detail: (job.clients as { name: string } | null)?.name ?? null,
        timestamp: job.updated_at,
        href: `/jobs?open=${job.id}`,
      }));

      const invoiceItems: ActivityItem[] = (invoicesRes.data ?? []).map((invoice) => ({
        id: `invoice-${invoice.id}`,
        kind: 'invoice',
        icon: ReceiptText,
        label: `Invoice ${invoice.invoice_number} ${INVOICE_VERBS[invoice.status ?? ''] ?? 'updated'}`,
        detail: (invoice.clients as { name: string } | null)?.name ?? null,
        timestamp: invoice.updated_at,
        href: `/invoices?open=${invoice.id}`,
      }));

      const requestItems: ActivityItem[] = (requestsRes.data ?? []).map((request) => ({
        id: `request-${request.id}`,
        kind: 'request',
        icon: Inbox,
        label: `New request: ${request.title}`,
        detail: (request.clients as { name: string } | null)?.name ?? null,
        timestamp: request.created_at,
        href: '/requests',
      }));

      return [...jobItems, ...invoiceItems, ...requestItems]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8);
    },
  });

  return (
    <Card data-testid="dashboard-activity-feed">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError && !isLoading ? (
          <QueryErrorState
            variant="inline"
            title="Couldn't load recent activity"
            onRetry={() => refetch()}
            retrying={isFetching}
            testId="dashboard-activity-error"
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{item.label}</span>
                    {item.detail && (
                      <span className="block text-xs text-muted-foreground truncate">{item.detail}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
            <p>Activity will appear here as your team works</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
