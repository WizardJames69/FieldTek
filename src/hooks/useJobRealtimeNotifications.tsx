import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useUserRole } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  notifyJobAssignment, 
  notifyJobStatusChange, 
  notifyJobCompleted 
} from '@/lib/pushNotifications';

interface JobChangePayload {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  client_id: string | null;
  scheduled_date: string | null;
  address: string | null;
  tenant_id: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Hook that listens to real-time job status changes via Supabase Realtime
 * and triggers push notifications for relevant users
 */
export function useJobRealtimeNotifications() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { role } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Track previous job states to detect actual changes
  const previousJobsRef = useRef<Map<string, { status: string; assigned_to: string | null }>>(new Map());
  const isInitializedRef = useRef(false);

  // Get client name for notifications
  const fetchClientName = useCallback(async (clientId: string | null): Promise<string> => {
    if (!clientId) return 'Unknown Client';
    
    const { data } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .maybeSingle();
    
    return data?.name || 'Unknown Client';
  }, []);

  // Get user profile name
  const fetchUserName = useCallback(async (userId: string | null): Promise<string> => {
    if (!userId) return 'Unknown';
    
    const { data } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', userId)
      .maybeSingle();
    
    return data?.full_name || data?.email?.split('@')[0] || 'Unknown';
  }, []);

  // Handle job assignment change
  const handleAssignmentChange = useCallback(async (
    job: JobChangePayload,
    oldAssignedTo: string | null,
    newAssignedTo: string | null
  ) => {
    if (!tenant?.id || !newAssignedTo || newAssignedTo === oldAssignedTo) return;

    try {
      const clientName = await fetchClientName(job.client_id);
      
      // Notify the newly assigned technician
      await notifyJobAssignment(newAssignedTo, tenant.id, {
        jobId: job.id,
        jobTitle: job.title,
        clientName,
        scheduledDate: job.scheduled_date || 'TBD',
        address: job.address || undefined,
      });

      // If this user is being assigned, show in-app toast
      if (newAssignedTo === user?.id) {
        toast({
          title: '🔧 New Job Assignment',
          description: `You've been assigned: ${job.title}`,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Failed to send assignment notification:', error);
    }
  }, [tenant?.id, user?.id, fetchClientName, toast]);

  // Handle job status change
  const handleStatusChange = useCallback(async (
    job: JobChangePayload,
    oldStatus: string,
    newStatus: string
  ) => {
    if (!tenant?.id || oldStatus === newStatus) return;

    try {
      const clientName = await fetchClientName(job.client_id);
      
      // If job is completed, notify dispatchers/admins
      if (newStatus === 'completed') {
        const technicianName = job.assigned_to 
          ? await fetchUserName(job.assigned_to)
          : undefined;

        await notifyJobCompleted(tenant.id, {
          jobId: job.id,
          jobTitle: job.title,
          clientName,
          technicianName,
        });
      }
      
      // If job status changed to in_progress, notify dispatchers
      if (newStatus === 'in_progress') {
        const { data: dispatchers } = await supabase
          .from('tenant_users')
          .select('user_id')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .in('role', ['owner', 'admin', 'dispatcher']);

        if (dispatchers?.length) {
          const dispatcherIds = dispatchers.map(d => d.user_id);
          
          await notifyJobStatusChange(dispatcherIds, tenant.id, {
            jobId: job.id,
            jobTitle: job.title,
            oldStatus: STATUS_LABELS[oldStatus] || oldStatus,
            newStatus: STATUS_LABELS[newStatus] || newStatus,
            clientName,
          });
        }
      }

      // If this user is an admin/dispatcher, show in-app toast for status changes
      if (['owner', 'admin', 'dispatcher'].includes(role || '')) {
        const emoji = newStatus === 'completed' ? '✅' : 
                      newStatus === 'in_progress' ? '🔄' : '📋';
        toast({
          title: `${emoji} Job Status Updated`,
          description: `${job.title}: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`,
          duration: 4000,
        });
      }

      // Invalidate job queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (error) {
      console.error('Failed to send status change notification:', error);
    }
  }, [tenant?.id, role, fetchClientName, fetchUserName, queryClient, toast]);

  useEffect(() => {
    if (!user?.id || !tenant?.id) return;

    // Initialize previous state from current jobs
    const initializePreviousState = async () => {
      const { data: jobs } = await supabase
        .from('scheduled_jobs')
        .select('id, status, assigned_to')
        .eq('tenant_id', tenant.id);

      if (jobs) {
        jobs.forEach(job => {
          previousJobsRef.current.set(job.id, {
            status: job.status || 'pending',
            assigned_to: job.assigned_to,
          });
        });
      }
      isInitializedRef.current = true;
    };

    initializePreviousState();

    // Subscribe to job changes for this tenant
    const channel = supabase
      .channel(`job-realtime-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scheduled_jobs',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        async (payload) => {
          if (!isInitializedRef.current) return;

          const newJob = payload.new as JobChangePayload;
          const prevState = previousJobsRef.current.get(newJob.id);

          if (prevState) {
            // Check for status change
            if (prevState.status !== newJob.status) {
              await handleStatusChange(newJob, prevState.status, newJob.status);
            }

            // Check for assignment change
            if (prevState.assigned_to !== newJob.assigned_to) {
              await handleAssignmentChange(newJob, prevState.assigned_to, newJob.assigned_to);
            }
          }

          // Update our reference
          previousJobsRef.current.set(newJob.id, {
            status: newJob.status,
            assigned_to: newJob.assigned_to,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scheduled_jobs',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        async (payload) => {
          const newJob = payload.new as JobChangePayload;
          
          // Track the new job
          previousJobsRef.current.set(newJob.id, {
            status: newJob.status || 'pending',
            assigned_to: newJob.assigned_to,
          });

          // If job is assigned on creation, notify the technician
          if (newJob.assigned_to) {
            await handleAssignmentChange(newJob, null, newJob.assigned_to);
          }

          // Show toast for new jobs to dispatchers
          if (['owner', 'admin', 'dispatcher'].includes(role || '')) {
            toast({
              title: '📋 New Job Created',
              description: newJob.title,
              duration: 4000,
            });
          }

          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'scheduled_jobs',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const oldJob = payload.old as { id: string };
          previousJobsRef.current.delete(oldJob.id);
          
          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      isInitializedRef.current = false;
    };
  }, [user?.id, tenant?.id, role, handleAssignmentChange, handleStatusChange, queryClient, toast]);
}
