import { WifiOff, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineIndicatorProps {
  className?: string;
  showPendingCount?: boolean;
  compact?: boolean;
}

export function OfflineIndicator({ 
  className, 
  showPendingCount = true,
  compact = false 
}: OfflineIndicatorProps) {
  const { isOnline, isSyncing, pendingCount, syncQueue, lastSyncAt } = useOfflineSync();

  // Don't show anything if online with no pending items
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn('flex items-center gap-2', className)}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                {!isOnline ? (
                  <Badge 
                    variant="destructive" 
                    className={cn(
                      'gap-1.5 font-medium',
                      compact && 'px-2 py-0.5 text-xs'
                    )}
                  >
                    <WifiOff className={cn('h-3.5 w-3.5', compact && 'h-3 w-3')} />
                    {!compact && 'Offline'}
                  </Badge>
                ) : isSyncing ? (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      'gap-1.5 font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      compact && 'px-2 py-0.5 text-xs'
                    )}
                  >
                    <Loader2 className={cn('h-3.5 w-3.5 animate-spin', compact && 'h-3 w-3')} />
                    {!compact && 'Syncing...'}
                  </Badge>
                ) : pendingCount > 0 ? (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      'gap-1.5 font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      compact && 'px-2 py-0.5 text-xs'
                    )}
                  >
                    <CloudOff className={cn('h-3.5 w-3.5', compact && 'h-3 w-3')} />
                    {showPendingCount && (
                      <span>{pendingCount} pending</span>
                    )}
                  </Badge>
                ) : null}

                {/* Sync button when online with pending items */}
                {isOnline && pendingCount > 0 && !isSyncing && !compact && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncQueue()}
                    className="h-7 px-2 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sync Now
                  </Button>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {!isOnline 
                    ? 'You are offline' 
                    : pendingCount > 0 
                      ? `${pendingCount} update${pendingCount > 1 ? 's' : ''} pending sync`
                      : 'All changes synced'}
                </p>
                {!isOnline && (
                  <p className="text-muted-foreground text-xs">
                    Changes will sync automatically when you're back online.
                  </p>
                )}
                {lastSyncAt && (
                  <p className="text-muted-foreground text-xs">
                    Last synced: {formatLastSync(lastSyncAt)}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </motion.div>
    </AnimatePresence>
  );
}
