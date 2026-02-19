import { useState } from 'react';
import { Play, CheckCircle, Loader2, WifiOff, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/contexts/TenantContext';
import { useOfflineJobUpdate } from '@/hooks/useOfflineJobUpdate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
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
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { isOnline } = useOnlineStatus();
  const { updateJobStatus } = useOfflineJobUpdate();
  const [isUpdating, setIsUpdating] = useState(false);

  const statusConfig = STATUS_FLOW[currentStatus as keyof typeof STATUS_FLOW] || STATUS_FLOW.pending;

  const handleStatusUpdate = async () => {
    if (!statusConfig.next) return;
    
    setIsUpdating(true);
    try {
      const success = await updateJobStatus(
        jobId, 
        statusConfig.next as 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
        undefined,
        { title: jobTitle, clientName }
      );
      
      if (success) {
        toast({ 
          title: isOnline ? 'Status updated' : 'Saved offline',
          description: isOnline ? undefined : 'Will sync when connected'
        });
      }
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
          "w-full h-16 text-lg font-bold btn-3d btn-shimmer touch-native relative overflow-hidden group",
          isStarting 
            ? "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg shadow-primary/25" 
            : "bg-gradient-to-r from-success to-success/90 hover:from-success/95 hover:to-success/85 shadow-lg shadow-success/25"
        )}
        onClick={handleStatusUpdate}
        disabled={isUpdating}
      >
        {/* Background pulse effect */}
        <span className={cn(
          "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          isStarting 
            ? "bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.3),transparent_70%)]"
            : "bg-[radial-gradient(circle_at_50%_50%,hsl(var(--success)/0.3),transparent_70%)]"
        )} />
        
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
          <span>{statusConfig.label}</span>
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
    </div>
  );
}
