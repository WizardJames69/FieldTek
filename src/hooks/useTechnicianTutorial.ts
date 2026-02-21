import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

const STORAGE_KEY_PREFIX = 'fieldtek-tech-tutorial-';

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export function useTechnicianTutorial() {
  const { user } = useAuth();
  const { role } = useTenant();

  const [dismissed, setDismissed] = useState(() => {
    if (!user?.id) return false;
    return !!localStorage.getItem(getStorageKey(user.id));
  });

  const shouldShowTutorial = role === 'technician' && !!user?.id && !dismissed;

  const completeTutorial = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(getStorageKey(user.id), new Date().toISOString());
    setDismissed(true);
  }, [user?.id]);

  const skipTutorial = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(getStorageKey(user.id), 'skipped');
    setDismissed(true);
  }, [user?.id]);

  return { shouldShowTutorial, completeTutorial, skipTutorial };
}
