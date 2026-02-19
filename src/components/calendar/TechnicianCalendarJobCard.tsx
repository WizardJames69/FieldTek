import { useState, memo, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  MapPin,
  Play,
  CheckCircle2,
  Circle,
  XCircle,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  title: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  status: string | null;
  priority: string | null;
  job_type: string | null;
  address: string | null;
  client?: {
    name: string;
  } | null;
}

interface TechnicianCalendarJobCardProps {
  job: Job;
  compact?: boolean;
  onClick?: () => void;
  onQuickAction?: (jobId: string, action: 'start' | 'complete') => void;
}

const jobTypeColors: Record<string, { border: string; bg: string; glow?: string }> = {
  service: { border: 'border-l-blue-500', bg: 'bg-blue-500/10 dark:bg-blue-500/15', glow: 'shadow-blue-500/10' },
  install: { border: 'border-l-green-500', bg: 'bg-green-500/10 dark:bg-green-500/15', glow: 'shadow-green-500/10' },
  installation: { border: 'border-l-green-500', bg: 'bg-green-500/10 dark:bg-green-500/15', glow: 'shadow-green-500/10' },
  warranty: { border: 'border-l-purple-500', bg: 'bg-purple-500/10 dark:bg-purple-500/15', glow: 'shadow-purple-500/10' },
  maintenance: { border: 'border-l-amber-500', bg: 'bg-amber-500/10 dark:bg-amber-500/15', glow: 'shadow-amber-500/10' },
  repair: { border: 'border-l-blue-500', bg: 'bg-blue-500/10 dark:bg-blue-500/15', glow: 'shadow-blue-500/10' },
  inspection: { border: 'border-l-indigo-500', bg: 'bg-indigo-500/10 dark:bg-indigo-500/15', glow: 'shadow-indigo-500/10' },
};

const priorityConfig: Record<string, { variant: 'destructive' | 'warning' | 'secondary' | 'default'; glow?: boolean }> = {
  urgent: { variant: 'destructive', glow: true },
  high: { variant: 'warning', glow: true },
  medium: { variant: 'secondary' },
  low: { variant: 'default' },
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Circle className="h-3 w-3 text-muted-foreground" />,
  scheduled: <Circle className="h-3 w-3 text-muted-foreground" />,
  in_progress: <Play className="h-3 w-3 text-blue-500 fill-blue-500" />,
  completed: <CheckCircle2 className="h-3 w-3 text-green-500" />,
  cancelled: <XCircle className="h-3 w-3 text-destructive" />,
};

export const TechnicianCalendarJobCard = memo(function TechnicianCalendarJobCard({
  job,
  compact = false,
  onClick,
  onQuickAction,
}: TechnicianCalendarJobCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Memoize computed values
  const jobTypeStyle = useMemo(() => 
    jobTypeColors[job.job_type?.toLowerCase() || ''] || { border: 'border-l-muted-foreground', bg: '', glow: '' },
    [job.job_type]
  );
  
  const priorityStyle = useMemo(() => 
    priorityConfig[job.priority || 'medium'] || priorityConfig.medium,
    [job.priority]
  );
  
  const canStart = job.status === 'scheduled' || job.status === 'pending';
  const canComplete = job.status === 'in_progress';
  const showQuickActions = isHovered && onQuickAction && (canStart || canComplete);

  // Memoize callbacks
  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);
  
  const handleStartClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickAction?.(job.id, 'start');
  }, [onQuickAction, job.id]);
  
  const handleCompleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickAction?.(job.id, 'complete');
  }, [onQuickAction, job.id]);

  if (compact) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'group relative p-2.5 rounded-xl border-l-4 cursor-pointer transition-all text-xs backdrop-blur-sm',
          'hover:shadow-lg hover:-translate-y-0.5',
          jobTypeStyle.border,
          jobTypeStyle.bg,
          isHovered && jobTypeStyle.glow && `shadow-lg ${jobTypeStyle.glow}`
        )}
      >
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-background/50 flex items-center justify-center ring-1 ring-border/30">
            {statusIcons[job.status || 'scheduled']}
          </div>
          <p className="font-semibold truncate flex-1">{job.title}</p>
          {job.priority && (job.priority === 'urgent' || job.priority === 'high') && (
            <Badge 
              variant={priorityStyle.variant} 
              glow={priorityStyle.glow}
              className="text-[10px] px-1.5 py-0 h-5"
            >
              {job.priority}
            </Badge>
          )}
        </div>
        {job.scheduled_time && (
          <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 pl-7">
            <Clock className="h-3 w-3" />
            <span className="font-medium">{job.scheduled_time.slice(0, 5)}</span>
          </div>
        )}

        {/* Quick Actions on Hover - Enhanced */}
        {showQuickActions && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1.5">
            {canStart && (
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 rounded-lg shadow-lg btn-shimmer"
                onClick={handleStartClick}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            {canComplete && (
              <Button
                size="icon"
                className="h-7 w-7 rounded-lg shadow-lg bg-success hover:bg-success/90"
                onClick={handleCompleteClick}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card
      variant="interactive"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group relative p-4 border-l-4 cursor-pointer',
        jobTypeStyle.border,
        jobTypeStyle.bg,
        isHovered && jobTypeStyle.glow && `shadow-xl ${jobTypeStyle.glow}`
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-background/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-border/40">
              {statusIcons[job.status || 'scheduled']}
            </div>
            <h4 className="font-semibold text-sm leading-tight">{job.title}</h4>
          </div>
          <div className="flex items-center gap-1.5">
            {job.priority && (
              <Badge 
                variant={priorityStyle.variant} 
                glow={priorityStyle.glow}
                className="text-xs shrink-0 font-semibold capitalize"
              >
                {job.priority}
              </Badge>
            )}
            {job.job_type && (
              <Badge variant="outline" className="text-xs shrink-0 capitalize font-medium bg-background/50">
                {job.job_type}
              </Badge>
            )}
          </div>
        </div>

        {job.client?.name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-5 w-5 rounded-md bg-muted/50 flex items-center justify-center ring-1 ring-border/30">
              <User className="h-3 w-3" />
            </div>
            <span className="font-medium">{job.client.name}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {job.scheduled_time && (
            <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-md">
              <Clock className="h-3 w-3" />
              <span className="font-medium">{job.scheduled_time.slice(0, 5)}</span>
              {job.estimated_duration && (
                <span className="text-muted-foreground/70">({job.estimated_duration}min)</span>
              )}
            </div>
          )}
        </div>

        {job.address && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{job.address}</span>
          </div>
        )}
      </div>

      {/* Quick Actions on Hover - Enhanced */}
      {showQuickActions && (
        <div className="absolute right-3 top-3 flex gap-2">
          {canStart && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 rounded-lg shadow-lg btn-shimmer font-semibold"
              onClick={handleStartClick}
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-lg shadow-lg bg-success hover:bg-success/90 font-semibold"
              onClick={handleCompleteClick}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </Button>
          )}
        </div>
      )}
    </Card>
  );
});
