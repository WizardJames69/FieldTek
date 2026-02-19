import { memo, useCallback, useMemo } from 'react';
import { MapPin, Clock, User, ChevronRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  title: string;
  description?: string | null;
  job_type?: string | null;
  status: string;
  priority?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  address?: string | null;
  estimated_duration?: number | null;
  client?: {
    name: string;
  } | null;
}

interface MobileJobCardProps {
  job: Job;
  onSelect: (job: Job) => void;
}

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'; glow?: boolean }> = {
  pending: { variant: 'warning', glow: true },
  scheduled: { variant: 'info' },
  in_progress: { variant: 'info', glow: true },
  completed: { variant: 'success' },
  cancelled: { variant: 'secondary' },
};

const PRIORITY_CLASSES: Record<string, string> = {
  low: 'border-l-muted-foreground/50',
  medium: 'border-l-warning',
  high: 'border-l-orange-500',
  urgent: 'border-l-destructive',
};

export const MobileJobCard = memo(function MobileJobCard({ job, onSelect }: MobileJobCardProps) {
  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const priorityClass = PRIORITY_CLASSES[job.priority || 'medium'] || PRIORITY_CLASSES.medium;

  const handleClick = useCallback(() => {
    onSelect(job);
  }, [onSelect, job]);

  // Memoize the computed styles for priority glow
  const cardStyles = useMemo(() => {
    const baseStyle: React.CSSProperties = {};
    if (job.priority === 'urgent') {
      baseStyle.boxShadow = '0 4px 24px -4px hsl(0 84% 60% / 0.15), 0 0 0 1px hsl(0 84% 60% / 0.1), inset 0 0 30px -15px hsl(0 84% 60% / 0.1)';
    } else if (job.priority === 'high') {
      baseStyle.boxShadow = '0 4px 20px -4px hsl(25 95% 53% / 0.12), 0 0 0 1px hsl(25 95% 53% / 0.08)';
    }
    return baseStyle;
  }, [job.priority]);

  const isUrgent = job.priority === 'urgent';

  return (
    <Card
      variant="interactive"
      glow={isUrgent ? 'destructive' : job.priority === 'high' ? 'warning' : 'none'}
      className={cn(
        "border-l-4 cursor-pointer group relative overflow-hidden",
        priorityClass,
        isUrgent && "ring-1 ring-destructive/20"
      )}
      onClick={handleClick}
      style={cardStyles}
    >
      {/* Urgent indicator pulse */}
      {isUrgent && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
          </span>
        </div>
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Header with status badge */}
            <div className="flex items-center gap-2 mb-2.5">
              <Badge 
                variant={statusConfig.variant} 
                glow={statusConfig.glow}
                className="text-xs font-semibold"
              >
                {job.status.replace('_', ' ')}
              </Badge>
              {job.job_type && (
                <span className="text-xs text-muted-foreground font-medium bg-muted/60 px-2.5 py-0.5 rounded-full backdrop-blur-sm ring-1 ring-border/30">
                  {job.job_type}
                </span>
              )}
              {isUrgent && (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold uppercase">Urgent</span>
                </div>
              )}
            </div>

            {/* Title */}
            <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
              {job.title}
            </h3>

            {/* Client with avatar placeholder */}
            {job.client?.name && (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground mt-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-muted/80 to-muted/40 ring-1 ring-border/50 flex items-center justify-center">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="truncate font-medium">{job.client.name}</span>
              </div>
            )}

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs text-muted-foreground">
              {job.scheduled_time && (
                <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1.5 rounded-lg backdrop-blur-sm ring-1 ring-border/30">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-semibold">{job.scheduled_time.slice(0, 5)}</span>
                  {job.estimated_duration && (
                    <span className="text-muted-foreground/60">
                      • {job.estimated_duration}min
                    </span>
                  )}
                </div>
              )}
              {job.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[160px]">{job.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Chevron with enhanced animation */}
          <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center shrink-0 mt-1 group-hover:bg-primary/10 group-hover:ring-1 group-hover:ring-primary/20 transition-all">
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
