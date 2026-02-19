import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { 
  cacheJobsWithClients, 
  getAllCachedJobs, 
  getCachedChecklist,
  cacheChecklist,
  setOfflineMetadata,
  CachedJob 
} from '@/lib/offlineDb';

interface UseOfflineJobsOptions {
  userId?: string;
  tenantId?: string;
  enabled?: boolean;
}

interface Job {
  id: string;
  title: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  description?: string | null;
  notes?: string | null;
  address?: string | null;
  job_type?: string | null;
  priority?: string | null;
  estimated_duration?: number | null;
  assigned_to?: string | null;
  tenant_id?: string;
  client?: {
    id?: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
  } | null;
  [key: string]: any;
}

/**
 * Hook that provides offline-aware job fetching.
 * - When online: fetches from Supabase and caches to IndexedDB
 * - When offline: returns cached jobs from IndexedDB
 */
export function useOfflineJobs({ userId, tenantId, enabled = true }: UseOfflineJobsOptions) {
  const { isOnline } = useOnlineStatus();
  const queryClient = useQueryClient();

  // Fetch jobs from Supabase (when online)
  const onlineQuery = useQuery({
    queryKey: ['my-jobs', userId, tenantId],
    queryFn: async (): Promise<Job[]> => {
      if (!userId || !tenantId) return [];

      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select(`
          *,
          client:clients(id, name, phone, address, email)
        `)
        .eq('tenant_id', tenantId)
        .eq('assigned_to', userId)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!userId && !!tenantId && isOnline,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Cache jobs to IndexedDB when we successfully fetch them
  useEffect(() => {
    const cacheJobsLocally = async () => {
      if (onlineQuery.data && onlineQuery.data.length > 0) {
        try {
          await cacheJobsWithClients(onlineQuery.data);
          await setOfflineMetadata('lastCacheTime', new Date().toISOString());
          
          // Also cache checklists for each job
          for (const job of onlineQuery.data) {
            const { data: checklist } = await supabase
              .from('job_checklist_completions')
              .select('*')
              .eq('job_id', job.id)
              .order('created_at');

            if (checklist && checklist.length > 0) {
              await cacheChecklist(job.id, checklist);
            }
          }
        } catch (error) {
          console.error('Failed to cache jobs:', error);
        }
      }
    };

    if (isOnline && onlineQuery.isSuccess) {
      cacheJobsLocally();
    }
  }, [onlineQuery.data, onlineQuery.isSuccess, isOnline]);

  // Fetch cached jobs from IndexedDB (when offline)
  const offlineQuery = useQuery({
    queryKey: ['my-jobs-offline', userId, tenantId],
    queryFn: async (): Promise<Job[]> => {
      const cachedJobs = await getAllCachedJobs();
      
      // Filter to only jobs assigned to this user (if we have that info)
      const userJobs = cachedJobs
        .map((cached: CachedJob) => cached.data as Job)
        .filter((job: Job) => {
          if (userId && job.assigned_to !== userId) return false;
          if (tenantId && job.tenant_id !== tenantId) return false;
          return true;
        })
        .sort((a: Job, b: Job) => {
          // Sort by scheduled_date, then scheduled_time
          const dateA = a.scheduled_date || '';
          const dateB = b.scheduled_date || '';
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          const timeA = a.scheduled_time || '';
          const timeB = b.scheduled_time || '';
          return timeA.localeCompare(timeB);
        });

      return userJobs;
    },
    enabled: enabled && !isOnline,
    staleTime: Infinity, // Cached data doesn't go stale
  });

  // Combine the results
  const jobs = isOnline ? onlineQuery.data : offlineQuery.data;
  const isLoading = isOnline ? onlineQuery.isLoading : offlineQuery.isLoading;
  const error = isOnline ? onlineQuery.error : offlineQuery.error;
  const isFromCache = !isOnline && !!offlineQuery.data;

  // Prefetch/refresh cache when going online
  const refreshCache = useCallback(async () => {
    if (isOnline && userId && tenantId) {
      await queryClient.invalidateQueries({ queryKey: ['my-jobs', userId, tenantId] });
    }
  }, [isOnline, userId, tenantId, queryClient]);

  // Get cached checklist for a job (works offline)
  const getJobChecklist = useCallback(async (jobId: string) => {
    if (isOnline) {
      // Fetch from server
      const { data, error } = await supabase
        .from('job_checklist_completions')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at');

      if (error) throw error;
      return data || [];
    } else {
      // Get from cache
      const cached = await getCachedChecklist(jobId);
      return cached?.items || [];
    }
  }, [isOnline]);

  return {
    jobs: jobs || [],
    isLoading,
    error,
    isOnline,
    isFromCache,
    refreshCache,
    getJobChecklist,
  };
}
