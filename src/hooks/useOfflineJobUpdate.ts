import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addToSyncQueue, cacheJob, getCachedJob } from '@/lib/offlineDb';
import { useOnlineStatus } from './useOnlineStatus';
import { useTenant } from '@/contexts/TenantContext';
import { notifyJobCompleted } from '@/lib/pushNotifications';
import { toast } from 'sonner';

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export function useOfflineJobUpdate() {
  const { isOnline } = useOnlineStatus();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();

  const updateJobStatus = useCallback(async (
    jobId: string,
    status: JobStatus,
    notes?: string,
    jobDetails?: { title?: string; clientName?: string }
  ): Promise<boolean> => {
    if (isOnline) {
      // Online: update directly
      try {
        const { error } = await supabase
          .from('scheduled_jobs')
          .update({ 
            status, 
            notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (error) throw error;

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
        queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });

        // Notify dispatchers when job is completed
        if (status === 'completed' && tenant?.id) {
          notifyJobCompleted(tenant.id, {
            jobId,
            jobTitle: jobDetails?.title || 'Job',
            clientName: jobDetails?.clientName || 'Unknown Client',
          }).catch(err => console.error('Push notification failed:', err));
        }

        return true;
      } catch (error) {
        console.error('Failed to update job status:', error);
        toast.error('Failed to update job status');
        return false;
      }
    } else {
      // Offline: queue for later sync
      try {
        await addToSyncQueue({
          type: 'job_status_update',
          payload: { jobId, status, notes },
        });

        // Update local cache optimistically
        const cached = await getCachedJob(jobId);
        if (cached) {
          await cacheJob({
            ...cached.data,
            status,
            notes,
            updated_at: new Date().toISOString(),
          });
        }

        toast.info('Saved offline. Will sync when connected.');
        return true;
      } catch (error) {
        console.error('Failed to queue offline update:', error);
        toast.error('Failed to save update');
        return false;
      }
    }
  }, [isOnline, queryClient, tenant?.id]);

  const updateJobChecklist = useCallback(async (
    jobId: string,
    checklistData: Record<string, any>
  ): Promise<boolean> => {
    if (isOnline) {
      // Online: update directly
      try {
        const { error } = await supabase
          .from('scheduled_jobs')
          .update({ 
            checklist_data: checklistData,
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['my-jobs'] });

        return true;
      } catch (error) {
        console.error('Failed to update job checklist:', error);
        toast.error('Failed to save checklist');
        return false;
      }
    } else {
      // Offline: queue for later sync
      try {
        await addToSyncQueue({
          type: 'job_checklist_update',
          payload: { jobId, checklistData },
        });

        // Update local cache optimistically
        const cached = await getCachedJob(jobId);
        if (cached) {
          await cacheJob({
            ...cached.data,
            checklist_data: checklistData,
            updated_at: new Date().toISOString(),
          });
        }

        toast.info('Checklist saved offline. Will sync when connected.');
        return true;
      } catch (error) {
        console.error('Failed to queue checklist update:', error);
        toast.error('Failed to save checklist');
        return false;
      }
    }
  }, [isOnline, queryClient]);

  const cacheJobForOffline = useCallback(async (job: Record<string, any>) => {
    try {
      await cacheJob(job);
    } catch (error) {
      console.error('Failed to cache job:', error);
    }
  }, []);

  return {
    isOnline,
    updateJobStatus,
    updateJobChecklist,
    cacheJobForOffline,
  };
}
