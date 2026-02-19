import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface JobStatusChange {
  id: string;
  title: string;
  status: string;
  old_status?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function usePortalRealtimeNotifications() {
  const { client } = usePortalAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previousJobsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!client?.id) return;

    // Initialize previous jobs state
    const initializePreviousState = async () => {
      const { data: jobs } = await supabase
        .from('scheduled_jobs')
        .select('id, status')
        .eq('client_id', client.id);

      if (jobs) {
        jobs.forEach(job => {
          previousJobsRef.current.set(job.id, job.status || 'pending');
        });
      }
    };

    initializePreviousState();

    const channel = supabase
      .channel(`portal-jobs-${client.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scheduled_jobs',
          filter: `client_id=eq.${client.id}`,
        },
        async (payload) => {
          const newJob = payload.new as any;
          const oldStatus = previousJobsRef.current.get(newJob.id);
          const newStatus = newJob.status;

          // Only notify if status actually changed
          if (oldStatus && oldStatus !== newStatus) {
            const statusLabel = STATUS_LABELS[newStatus] || newStatus;
            
            toast({
              title: '🔔 Job Update',
              description: `"${newJob.title}" is now ${statusLabel}`,
              duration: 5000,
            });

            // Update our reference
            previousJobsRef.current.set(newJob.id, newStatus);
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['portal-jobs'] });
          queryClient.invalidateQueries({ queryKey: ['portal-stats'] });
          queryClient.invalidateQueries({ queryKey: ['portal-recent-jobs'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scheduled_jobs',
          filter: `client_id=eq.${client.id}`,
        },
        (payload) => {
          const newJob = payload.new as any;
          
          toast({
            title: '📋 New Job Scheduled',
            description: `"${newJob.title}" has been scheduled for you`,
            duration: 5000,
          });

          // Track the new job
          previousJobsRef.current.set(newJob.id, newJob.status || 'pending');

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['portal-jobs'] });
          queryClient.invalidateQueries({ queryKey: ['portal-stats'] });
          queryClient.invalidateQueries({ queryKey: ['portal-recent-jobs'] });
        }
      )
      .subscribe();

    // Also listen for invoice updates
    const invoiceChannel = supabase
      .channel(`portal-invoices-${client.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `client_id=eq.${client.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const invoice = payload.new as any;
            toast({
              title: '📄 New Invoice',
              description: `Invoice #${invoice.invoice_number} has been created`,
              duration: 5000,
            });
          } else if (payload.eventType === 'UPDATE') {
            const invoice = payload.new as any;
            if (invoice.status === 'sent') {
              toast({
                title: '📧 Invoice Ready',
                description: `Invoice #${invoice.invoice_number} is ready for payment`,
                duration: 5000,
              });
            }
          }

          queryClient.invalidateQueries({ queryKey: ['portal-invoices'] });
          queryClient.invalidateQueries({ queryKey: ['portal-stats'] });
        }
      )
      .subscribe();

    // Listen for service request updates
    const requestChannel = supabase
      .channel(`portal-requests-${client.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_requests',
          filter: `client_id=eq.${client.id}`,
        },
        (payload) => {
          const request = payload.new as any;
          const statusMessages: Record<string, string> = {
            approved: 'Your service request has been approved',
            rejected: 'Your service request was not approved',
            converted: 'Your service request has been converted to a job',
          };

          const message = statusMessages[request.status];
          if (message) {
            toast({
              title: '✅ Request Update',
              description: `"${request.title}" - ${message}`,
              duration: 5000,
            });
          }

          queryClient.invalidateQueries({ queryKey: ['portal-requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(invoiceChannel);
      supabase.removeChannel(requestChannel);
    };
  }, [client?.id, toast, queryClient]);
}
