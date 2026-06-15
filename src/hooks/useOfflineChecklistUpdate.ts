import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addToSyncQueue, updateCachedChecklistItem } from '@/lib/offlineDb';
import { useOnlineStatus } from './useOnlineStatus';
import { useAuth } from '@/contexts/AuthContext';
import type { SaveOutcome } from '@/lib/actionFeedback';
import { toast } from 'sonner';

/**
 * Offline-aware updates for job_checklist_completions rows (mirrors
 * useOfflineJobUpdate). Online: direct update. Offline: queue a
 * 'checklist_completion_update' op for replay. Both paths patch the
 * cached_checklists entry so a sheet re-opened offline shows current state.
 *
 * Each mutation resolves to a {@link SaveOutcome} ('synced' | 'queued' |
 * 'failed') so the calling component can render the matching inline feedback.
 * Toast copy lives here so it stays consistent:
 *   - toggle: silent on online success (the checkbox turning green is the
 *     feedback — a toast on every tap would be noisy), info toast when queued
 *     offline, error toast on failure.
 *   - notes: success toast online, info toast when queued offline, error toast
 *     on failure (a note save is a deliberate one-off action, so a confirmation
 *     toast is helpful rather than noisy).
 * The queue/replay/retry semantics are unchanged.
 */
export function useOfflineChecklistUpdate(jobId: string) {
  const { isOnline } = useOnlineStatus();
  const { user } = useAuth();

  const toggleItem = useCallback(async (
    itemId: string,
    completed: boolean
  ): Promise<SaveOutcome> => {
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
        return 'synced';
      } catch (error) {
        console.error('Failed to update checklist item:', error);
        toast.error("Couldn't update checklist item", {
          description: 'Check your connection and try again.',
        });
        return 'failed';
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
      return 'queued';
    } catch (error) {
      console.error('Failed to queue checklist update:', error);
      toast.error("Couldn't save checklist item", {
        description: 'It was not saved. Please try again.',
      });
      return 'failed';
    }
  }, [isOnline, jobId, user?.id]);

  const saveNotes = useCallback(async (
    itemId: string,
    notes: string
  ): Promise<SaveOutcome> => {
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
        return 'synced';
      } catch (error) {
        console.error('Failed to save checklist notes:', error);
        toast.error("Couldn't save notes", {
          description: 'Your text is still here — check your connection and try again.',
        });
        return 'failed';
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
      return 'queued';
    } catch (error) {
      console.error('Failed to queue checklist notes:', error);
      toast.error("Couldn't save notes", {
        description: 'Your text is still here — please try again.',
      });
      return 'failed';
    }
  }, [isOnline, jobId]);

  return { isOnline, toggleItem, saveNotes };
}
