import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useOnlineStatus } from './useOnlineStatus';
import { 
  cacheJobsWithClients, 
  cacheChecklist, 
  setOfflineMetadata,
  initOfflineDb 
} from '@/lib/offlineDb';
import { toast } from 'sonner';

interface PreloadOptions {
  onProgress?: (progress: number, message: string) => void;
  forceRefresh?: boolean;
}

/**
 * Hook that preloads and caches data for offline use
 * Call this on app startup or when user explicitly requests to cache data
 */
export function useOfflineDataPreloader() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { isOnline } = useOnlineStatus();
  const queryClient = useQueryClient();
  const isPreloading = useRef(false);

  const preloadOfflineData = useCallback(async (options: PreloadOptions = {}) => {
    if (!user?.id || !tenant?.id || !isOnline || isPreloading.current) {
      return { success: false, reason: 'Not ready or already preloading' };
    }

    isPreloading.current = true;
    const { onProgress, forceRefresh = false } = options;

    try {
      // Initialize DB
      await initOfflineDb();
      onProgress?.(10, 'Initializing offline storage...');

      // Fetch jobs assigned to the current user
      onProgress?.(20, 'Fetching your jobs...');
      const { data: jobs, error: jobsError } = await supabase
        .from('scheduled_jobs')
        .select(`
          *,
          client:clients(id, name, phone, address, email)
        `)
        .eq('tenant_id', tenant.id)
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'scheduled', 'in_progress'])
        .order('scheduled_date', { ascending: true })
        .limit(50); // Limit for performance

      if (jobsError) throw jobsError;

      if (jobs && jobs.length > 0) {
        // Cache all jobs and their clients
        onProgress?.(40, `Caching ${jobs.length} jobs...`);
        await cacheJobsWithClients(jobs);

        // Fetch and cache checklists for each job
        onProgress?.(60, 'Caching job checklists...');
        for (let i = 0; i < jobs.length; i++) {
          const job = jobs[i];
          
          const { data: checklist } = await supabase
            .from('job_checklist_completions')
            .select('*')
            .eq('job_id', job.id)
            .order('created_at');

          if (checklist && checklist.length > 0) {
            await cacheChecklist(job.id, checklist);
          }

          onProgress?.(60 + Math.round((i / jobs.length) * 30), `Caching checklist ${i + 1}/${jobs.length}...`);
        }
      }

      // Store last cache time
      await setOfflineMetadata('lastCacheTime', new Date().toISOString());
      await setOfflineMetadata('userId', user.id);
      await setOfflineMetadata('tenantId', tenant.id);

      onProgress?.(100, 'Offline data ready!');
      isPreloading.current = false;

      return { 
        success: true, 
        jobsCached: jobs?.length || 0,
      };
    } catch (error) {
      console.error('Failed to preload offline data:', error);
      isPreloading.current = false;
      return { success: false, reason: String(error) };
    }
  }, [user?.id, tenant?.id, isOnline]);

  // Auto-preload on mount when conditions are met
  useEffect(() => {
    if (user?.id && tenant?.id && isOnline) {
      // Delay to not impact initial load
      const timer = setTimeout(() => {
        preloadOfflineData().then((result) => {
          if (result.success && result.jobsCached && result.jobsCached > 0) {
            console.log(`Preloaded ${result.jobsCached} jobs for offline use`);
          }
        });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [user?.id, tenant?.id, isOnline, preloadOfflineData]);

  return {
    preloadOfflineData,
    isPreloading: isPreloading.current,
  };
}
