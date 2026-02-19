import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  initOfflineDb, 
  getSyncQueue, 
  removeFromSyncQueue, 
  updateQueueItemRetry,
  QueuedOperation,
  clearOldCachedJobs,
  setOfflineMetadata
} from '@/lib/offlineDb';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from 'sonner';

const MAX_RETRIES = 3;
const SYNC_INTERVAL = 30000; // 30 seconds

export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const { isOnline, wasOffline, clearWasOffline } = useOnlineStatus();
  const queryClient = useQueryClient();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize IndexedDB on mount
  useEffect(() => {
    initOfflineDb().then(() => {
      // Clean up old cached jobs
      clearOldCachedJobs(7);
      // Load pending count
      refreshPendingCount();
    });
  }, []);

  // Listen for background sync messages from service worker
  useEffect(() => {
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED') {
        console.log('[OfflineSync] Background sync triggered by SW');
        syncQueue();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      
      // Register for background sync when going offline
      if (!isOnline) {
        registerBackgroundSync();
      }
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [isOnline]);

  const registerBackgroundSync = async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'REGISTER_SYNC' });
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to register background sync:', error);
    }
  };

  const refreshPendingCount = useCallback(async () => {
    try {
      const queue = await getSyncQueue();
      setPendingCount(queue.length);
    } catch (error) {
      console.error('Failed to get pending count:', error);
    }
  }, []);

  const processOperation = async (operation: QueuedOperation): Promise<boolean> => {
    try {
      switch (operation.type) {
        case 'job_status_update': {
          const { jobId, status, notes } = operation.payload;
          const { error } = await supabase
            .from('scheduled_jobs')
            .update({ 
              status, 
              notes,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
          
          if (error) throw error;
          break;
        }

        case 'job_checklist_update': {
          const { jobId, checklistData } = operation.payload;
          const { error } = await supabase
            .from('scheduled_jobs')
            .update({ 
              checklist_data: checklistData,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
          
          if (error) throw error;
          break;
        }

        case 'job_notes_update': {
          const { jobId, notes } = operation.payload;
          const { error } = await supabase
            .from('scheduled_jobs')
            .update({ 
              notes,
              updated_at: new Date().toISOString()
            })
            .eq('id', jobId);
          
          if (error) throw error;
          break;
        }

        default:
          console.warn('Unknown operation type:', operation.type);
          return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to process operation:', operation.id, error);
      return false;
    }
  };

  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncErrors([]);
    const errors: string[] = [];

    try {
      const queue = await getSyncQueue();
      
      if (queue.length === 0) {
        setIsSyncing(false);
        return;
      }

      let successCount = 0;

      for (const operation of queue) {
        if (operation.retryCount >= MAX_RETRIES) {
          errors.push(`Operation ${operation.id} exceeded max retries`);
          await removeFromSyncQueue(operation.id);
          continue;
        }

        const success = await processOperation(operation);

        if (success) {
          await removeFromSyncQueue(operation.id);
          successCount++;
        } else {
          await updateQueueItemRetry(operation.id, operation.retryCount + 1);
          errors.push(`Failed to sync ${operation.type} for job`);
        }
      }

      // Invalidate job queries to refresh data
      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
        queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
        
        toast.success(`Synced ${successCount} offline update${successCount > 1 ? 's' : ''}`);
      }

      const now = new Date();
      setLastSyncAt(now);
      await setOfflineMetadata('lastSyncTime', now.toISOString());
      setSyncErrors(errors);
    } catch (error) {
      console.error('Sync failed:', error);
      errors.push('Sync process failed');
      setSyncErrors(errors);
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isOnline, isSyncing, queryClient, refreshPendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      toast.info('Back online! Syncing pending changes...');
      syncQueue().then(() => {
        clearWasOffline();
      });
    }
  }, [isOnline, wasOffline, syncQueue, clearWasOffline]);

  // Periodic sync when online
  useEffect(() => {
    if (isOnline) {
      syncIntervalRef.current = setInterval(() => {
        syncQueue();
      }, SYNC_INTERVAL);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isOnline, syncQueue]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    syncErrors,
    syncQueue,
    refreshPendingCount,
  };
}
