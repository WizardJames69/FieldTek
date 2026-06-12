import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addToSyncQueue, updateCachedChecklistItem } from '@/lib/offlineDb';
import { useOnlineStatus } from './useOnlineStatus';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Offline-aware updates for job_checklist_completions rows (mirrors
 * useOfflineJobUpdate). Online: direct update. Offline: queue a
 * 'checklist_completion_update' op for replay. Both paths patch the
 * cached_checklists entry so a sheet re-opened offline shows current state.
 */
export function useOfflineChecklistUpdate(jobId: string) {
  const { isOnline } = useOnlineStatus();
  const { user } = useAuth();

  const toggleItem = useCallback(async (
    itemId: string,
    completed: boolean
  ): Promise<boolean> => {
    const completedBy = completed ? (user?.id ?? null) : null;
    const completedAt = completed ? new Date().toISOString() : null;
    const patch = {
      completed,
      completed_by: completedBy,
      completed_at: completedAt,
    };

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('job_checklist_completions')
          .update(patch)
          .eq('id', itemId);

        if (error) throw error;

        await updateCachedChecklistItem(jobId, itemId, patch).catch((err) =>
          console.warn('Failed to update cached checklist item:', err)
        );
        return true;
      } catch (error) {
        console.error('Failed to update checklist item:', error);
        toast.error('Failed to update checklist item');
        return false;
      }
    }

    try {
      await addToSyncQueue({
        type: 'checklist_completion_update',
        payload: { itemId, jobId, completed, completedBy, completedAt },
      });
      await updateCachedChecklistItem(jobId, itemId, patch).catch((err) =>
        console.warn('Failed to update cached checklist item:', err)
      );
      toast.info('Saved offline. Will sync when connected.');
      return true;
    } catch (error) {
      console.error('Failed to queue checklist update:', error);
      toast.error('Failed to save checklist item');
      return false;
    }
  }, [isOnline, jobId, user?.id]);

  const saveNotes = useCallback(async (
    itemId: string,
    notes: string
  ): Promise<boolean> => {
    if (isOnline) {
      try {
        const { error } = await supabase
          .from('job_checklist_completions')
          .update({ notes })
          .eq('id', itemId);

        if (error) throw error;

        await updateCachedChecklistItem(jobId, itemId, { notes }).catch((err) =>
          console.warn('Failed to update cached checklist item:', err)
        );
        toast.success('Notes saved');
        return true;
      } catch (error) {
        console.error('Failed to save checklist notes:', error);
        toast.error('Failed to save notes');
        return false;
      }
    }

    try {
      await addToSyncQueue({
        type: 'checklist_completion_update',
        payload: { itemId, jobId, notes },
      });
      await updateCachedChecklistItem(jobId, itemId, { notes }).catch((err) =>
        console.warn('Failed to update cached checklist item:', err)
      );
      toast.info('Saved offline. Will sync when connected.');
      return true;
    } catch (error) {
      console.error('Failed to queue checklist notes:', error);
      toast.error('Failed to save notes');
      return false;
    }
  }, [isOnline, jobId]);

  return { isOnline, toggleItem, saveNotes };
}
