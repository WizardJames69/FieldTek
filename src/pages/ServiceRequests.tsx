import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RequestCard } from '@/components/requests/RequestCard';
import { RequestDetailSheet } from '@/components/requests/RequestDetailSheet';

type RequestStatus = 'all' | 'new' | 'reviewed' | 'converted' | 'rejected';

export default function ServiceRequests() {
  const { tenant } = useTenant();
  const [status, setStatus] = useState<RequestStatus>('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['service-requests', tenant?.id, status],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('service_requests')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const statusCounts = {
    all: requests?.length || 0,
    new: requests?.filter((r) => r.status === 'new').length || 0,
    reviewed: requests?.filter((r) => r.status === 'reviewed').length || 0,
    converted: requests?.filter((r) => r.status === 'converted').length || 0,
    rejected: requests?.filter((r) => r.status === 'rejected').length || 0,
  };

  return (
    <MainLayout title="Service Requests" subtitle="Manage incoming service requests">
      <div className="space-y-4 md:space-y-6 animate-fade-up">
        {/* Phase 6: Enhanced Status Tabs with pill styling */}
        <Tabs value={status} onValueChange={(v) => setStatus(v as RequestStatus)}>
          <TabsList variant="pills" className="backdrop-blur-sm bg-muted/50">
            <TabsTrigger value="all" className="relative">
              All
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-background/80">{statusCounts.all}</span>
            </TabsTrigger>
            <TabsTrigger value="new" className="relative">
              New
              {statusCounts.new > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">{statusCounts.new}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="relative">
              Reviewed
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-background/80">{statusCounts.reviewed}</span>
            </TabsTrigger>
            <TabsTrigger value="converted" className="relative">
              Converted
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-success/20 text-success">{statusCounts.converted}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Section divider */}
        <div className="section-divider" />

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : requests?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {/* Phase 5: Enhanced empty state with radial glow */}
            <div className="relative w-12 h-12 mb-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-xl" />
              <div className="relative flex items-center justify-center empty-state-glow">
                <Inbox className="h-12 w-12 text-muted-foreground/50" />
              </div>
            </div>
            <h3 className="text-lg font-medium">No requests found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {status === 'all'
                ? 'Service requests from customers will appear here'
                : `No ${status} requests`}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {requests?.map((request) => (
              <div key={request.id} className="list-item-native rounded-lg">
                <RequestCard
                  request={request}
                  onView={setSelectedRequest}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <RequestDetailSheet
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      />
    </MainLayout>
  );
}
