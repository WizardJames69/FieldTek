import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

const WARNING_THRESHOLD_MINUTES = 5;

export function SessionExpiryWarning() {
  const { session, signOut, refreshSession } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkSessionExpiry = useCallback(() => {
    if (!session?.expires_at) {
      setShowWarning(false);
      return;
    }

    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const remainingMs = expiresAt - now;
    const remainingMinutes = Math.floor(remainingMs / 60000);

    setTimeRemaining(remainingMinutes);

    if (remainingMinutes <= WARNING_THRESHOLD_MINUTES && remainingMinutes > 0) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [session?.expires_at]);

  useEffect(() => {
    // Check immediately on mount and when session changes
    checkSessionExpiry();

    // Check every 30 seconds
    const interval = setInterval(checkSessionExpiry, 30000);

    return () => clearInterval(interval);
  }, [checkSessionExpiry]);

  const handleExtendSession = async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
      setShowWarning(false);
    } catch (error) {
      console.error('[SessionExpiryWarning] Failed to refresh session:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogOut = async () => {
    await signOut();
    setShowWarning(false);
  };

  if (!showWarning) {
    return null;
  }

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Your session will expire in approximately {timeRemaining} minute{timeRemaining !== 1 ? 's' : ''}.
            Would you like to extend your session or log out?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLogOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Log Out
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleExtendSession} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Extending...' : 'Extend Session'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
