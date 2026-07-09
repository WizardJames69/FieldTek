import { useState, useRef } from 'react';
import { Play, CheckCircle, Loader2, WifiOff, Zap, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineJobUpdate } from '@/hooks/useOfflineJobUpdate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { JobCompletionDialog } from '@/components/jobs/JobCompletionDialog';
import { cn } from '@/lib/utils';

interface JobStatusUpdaterProps {
  jobId: string;
  currentStatus: string;
  jobTitle?: string;
  clientName?: string;
}

const STATUS_FLOW = {
  pending: { next: 'in_progress', label: 'Start Job', icon: Play, color: 'primary' },
  scheduled: { next: 'in_progress', label: 'Start Job', icon: Play, color: 'primary' },
  in_progress: { next: 'completed', label: 'Complete Job', icon: CheckCircle, color: 'success' },
  completed: { next: null, label: 'Completed', icon: CheckCircle, color: 'success' },
  cancelled: { next: null, label: 'Cancelled', icon: null, color: 'muted' },
};

export function JobStatusUpdater({ jobId, currentStatus, jobTitle, clientName }: JobStatusUpdaterProps) {
  const { isOnline } = useOnlineStatus();
  const { updateJobStatus } = useOfflineJobUpdate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [lastFailed, setLastFailed] = useState(false);
  // Remember the resolution notes from the last attempt so a failed completion
  // can be retried without re-typing them (the completion dialog clears its own
  // text on confirm, so reopening it would start blank).
  const lastResolutionNotesRef = useRef<string | undefined>(undefined);

  const statusConfig = STATUS_FLOW[currentStatus as keyof typeof STATUS_FLOW] || STATUS_FLOW.pending;

  const handleStatusUpdate = async () => {
    if (!statusConfig.next || isUpdating) return;

    // Intercept completion: require resolution notes
    if (statusConfig.next === 'completed') {
      setCompletionDialogOpen(true);
      return;
    }

    await applyUpdate();
  };

  const handleRetry = () => {
    // Replay the exact failed attempt — including any resolution notes the
    // technician already entered — instead of reopening the cleared dialog.
    void applyUpdate(lastResolutionNotesRef.current);
  };

  const applyUpdate = async (resolutionNotes?: string) => {
    if (!statusConfig.next) return;

    lastResolutionNotesRef.current = resolutionNotes;
    setIsUpdating(true);
    setLastFailed(false);
    try {
      // updateJobStatus owns the success / offline-queued / error toast (single
      // source of copy), so we don't fire a second toast here. We only track the
      // failed outcome to show an inline Retry affordance.
      const outcome = await updateJobStatus(
        jobId,
        statusConfig.next as 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
        undefined,
        { title: jobTitle, clientName, resolutionNotes }
      );
      setLastFailed(outcome === 'failed');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!statusConfig.next) {
    return (
      <div className={cn(
        "text-center py-5 px-4 rounded-2xl backdrop-blur-xl",
        currentStatus === 'completed' 
          ? 'bg-gradient-to-br from-success/15 to-success/5 text-success ring-1 ring-success/30' 
          : 'bg-muted/50 text-muted-foreground ring-1 ring-border/50'
      )}>
        <div className="flex items-center justify-center gap-3">
          {currentStatus === 'completed' && (
            <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center ring-1 ring-success/40">
              <CheckCircle className="h-5 w-5" />
            </div>
          )}
          <div className="text-left">
            <p className="font-bold text-lg">{statusConfig.label}</p>
            {currentStatus === 'completed' && (
              <p className="text-sm text-success/70 font-medium">Great work!</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const Icon = statusConfig.icon;
  const isStarting = statusConfig.next === 'in_progress';

  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className={cn(
          "w-full h-16 text-lg font-bold touch-native",
          isStarting
            ? "bg-primary hover:bg-primary/90 shadow-md"
            : "bg-success hover:bg-success/90 shadow-md"
        )}
        onClick={handleStatusUpdate}
        disabled={isUpdating}
        aria-busy={isUpdating}
      >
        <span className="relative flex items-center gap-3">
          {isUpdating ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center",
              isStarting ? "bg-primary-foreground/20" : "bg-success-foreground/20"
            )}>
              {Icon && <Icon className="h-5 w-5" />}
            </div>
          )}
          <span>{isUpdating ? (isStarting ? 'Starting…' : 'Completing…') : statusConfig.label}</span>
          {!isUpdating && <Zap className="h-5 w-5 opacity-60" />}
        </span>
      </Button>
      
      {/* Offline indicator - Premium styling */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-500/5 backdrop-blur-sm ring-1 ring-amber-500/30">
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <WifiOff className="h-4 w-4 text-amber-500" />
          </div>
          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            Changes will sync when online
          </span>
        </div>
      )}

      {/* Inline failure + retry (the toast already fired; this stays put so the
          technician has an obvious, persistent way to try the same action again). */}
      {lastFailed && !isUpdating && (
        <div
          role="alert"
          className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-destructive/10 ring-1 ring-destructive/30"
        >
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm font-semibold text-destructive">
            Couldn't update status.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-destructive font-semibold hover:text-destructive"
            onClick={handleRetry}
          >
            Try again
          </Button>
        </div>
      )}

      <JobCompletionDialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        jobTitle={jobTitle}
        onConfirm={(notes) => {
          setCompletionDialogOpen(false);
          applyUpdate(notes);
        }}
      />
    </div>
  );
}
