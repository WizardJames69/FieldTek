import { useState, useEffect } from 'react';
import { 
  WifiOff, 
  Wifi, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Database, 
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getOfflineStats } from '@/lib/offlineDb';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface OfflineSyncStatusProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export function OfflineSyncStatus({ className, variant = 'full' }: OfflineSyncStatusProps) {
  const { isOnline, isSyncing, pendingCount, lastSyncAt, syncQueue, syncErrors } = useOfflineSync();
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState<{
    cachedJobsCount: number;
    cachedClientsCount: number;
    pendingOpsCount: number;
    lastCacheTime: string | null;
  } | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const offlineStats = await getOfflineStats();
        setStats(offlineStats);
      } catch (error) {
        console.error('Failed to load offline stats:', error);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [pendingCount]);

  const formatTime = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'h:mm a');
  };

  // Compact variant for header
  if (variant === 'compact') {
    return (
      <AnimatePresence>
        {(!isOnline || pendingCount > 0 || isSyncing) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn('flex items-center gap-2', className)}
          >
            {!isOnline ? (
              <Badge variant="destructive" className="gap-1.5 font-semibold">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            ) : isSyncing ? (
              <Badge variant="secondary" className="gap-1.5 font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing
              </Badge>
            ) : pendingCount > 0 ? (
              <Badge variant="warning" className="gap-1.5 font-semibold">
                <CloudOff className="h-3 w-3" />
                {pendingCount}
              </Badge>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Full variant for mobile page
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl overflow-hidden',
          isOnline 
            ? pendingCount > 0 
              ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 ring-1 ring-amber-500/30'
              : 'bg-gradient-to-br from-success/10 to-success/5 ring-1 ring-success/30'
            : 'bg-gradient-to-br from-destructive/10 to-destructive/5 ring-1 ring-destructive/30',
          className
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              {/* Status icon */}
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center ring-1',
                isOnline 
                  ? pendingCount > 0
                    ? 'bg-gradient-to-br from-amber-500/30 to-amber-600/20 ring-amber-500/40'
                    : 'bg-gradient-to-br from-success/30 to-success/20 ring-success/40'
                  : 'bg-gradient-to-br from-destructive/30 to-destructive/20 ring-destructive/40'
              )}>
                {!isOnline ? (
                  <WifiOff className="h-5 w-5 text-destructive" />
                ) : isSyncing ? (
                  <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                ) : pendingCount > 0 ? (
                  <CloudOff className="h-5 w-5 text-amber-500" />
                ) : (
                  <Cloud className="h-5 w-5 text-success" />
                )}
              </div>

              {/* Status text */}
              <div className="text-left">
                <p className={cn(
                  'font-bold text-sm',
                  isOnline 
                    ? pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-success'
                    : 'text-destructive'
                )}>
                  {!isOnline 
                    ? 'Offline Mode' 
                    : isSyncing 
                      ? 'Syncing changes...'
                      : pendingCount > 0 
                        ? `${pendingCount} pending sync${pendingCount > 1 ? 's' : ''}`
                        : 'All synced'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {!isOnline 
                    ? `${stats?.cachedJobsCount || 0} jobs available offline`
                    : lastSyncAt 
                      ? `Last sync: ${formatTime(lastSyncAt)}`
                      : 'Tap for details'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick actions */}
              {isOnline && pendingCount > 0 && !isSyncing && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    syncQueue();
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync
                </Button>
              )}
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                isExpanded && 'rotate-180'
              )} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-border/50">
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center p-3 rounded-xl bg-background/50 ring-1 ring-border/50">
                <Database className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{stats?.cachedJobsCount || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Jobs cached</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-background/50 ring-1 ring-border/50">
                <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{pendingCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-background/50 ring-1 ring-border/50">
                {syncErrors.length > 0 ? (
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 mx-auto mb-1 text-success" />
                )}
                <p className="text-lg font-bold">{syncErrors.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Errors</p>
              </div>
            </div>

            {/* Connection status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 ring-1 ring-border/50">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-success" />
                ) : (
                  <WifiOff className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {isOnline ? 'Connected' : 'No connection'}
                </span>
              </div>
              <Badge variant={isOnline ? 'success' : 'destructive'} className="text-xs">
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>

            {/* Sync errors */}
            {syncErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 ring-1 ring-destructive/30">
                <p className="text-xs font-semibold text-destructive mb-2">Sync Errors:</p>
                <ul className="text-xs text-destructive/80 space-y-1">
                  {syncErrors.slice(0, 3).map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Last cache info */}
            {stats?.lastCacheTime && (
              <p className="text-xs text-center text-muted-foreground">
                Data cached at {formatTime(stats.lastCacheTime)}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </motion.div>
    </Collapsible>
  );
}
