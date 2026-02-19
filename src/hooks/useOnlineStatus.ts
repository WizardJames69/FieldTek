import { useState, useEffect, useCallback } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
}

export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineAt: null,
    lastOfflineAt: null,
  });

  const handleOnline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      isOnline: true,
      wasOffline: true,
      lastOnlineAt: new Date(),
    }));
  }, []);

  const handleOffline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      isOnline: false,
      lastOfflineAt: new Date(),
    }));
  }, []);

  const clearWasOffline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      wasOffline: false,
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return {
    ...status,
    clearWasOffline,
  };
}
