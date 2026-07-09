import { memo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: {
    id: string;
    title: string;
    client_name?: string;
    assigned_to_name?: string;
    scheduled_time?: string;
    estimated_duration?: number;
    status?: string;
    priority?: string;
    address?: string;
  };
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, jobId: string) => void;
}

const priorityConfig: Record<string, { badge: 'secondary' | 'warning' | 'destructive' }> = {
  low: { badge: 'secondary' },
  medium: { badge: 'secondary' },
  high: { badge: 'warning' },
  urgent: { badge: 'destructive' },
};

// Status is conveyed by a small leading dot (matches the calendar legend colors).
const statusDotColors: Record<string, string> = {
  pending: "bg-muted-foreground",
  scheduled: "bg-primary",
  in_progress: "bg-info",
  completed: "bg-success",
  cancelled: "bg-destructive",
};

export const JobCard = memo(function JobCard({ 
  job, 
  compact = false, 
  draggable = true, 
  onDragStart 
}: JobCardProps) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, job.id);
    }
    e.dataTransfer.setData("jobId", job.id);
    e.dataTransfer.effectAllowed = "move";
  }, [onDragStart, job.id]);

  const priority = priorityConfig[job.priority || 'medium'] || priorityConfig.medium;
  const statusDot = statusDotColors[job.status || "pending"];

  if (compact) {
    return (
      <div
        draggable={draggable}
        onDragStart={handleDragStart}
        className={cn(
          "p-2.5 rounded-xl bg-card border cursor-move",
          "hover:shadow-md transition-shadow duration-200 touch-native"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("h-2 w-2 rounded-full shrink-0", statusDot)} aria-hidden="true" />
          <p className="font-medium truncate text-xs">{job.title}</p>
        </div>
        {job.scheduled_time && (
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            {job.scheduled_time.slice(0, 5)}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card
      variant="interactive"
      draggable={draggable}
      onDragStart={handleDragStart}
      className="p-3.5 cursor-move"
    >
      <div className="space-y-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("h-2 w-2 rounded-full shrink-0", statusDot)} aria-hidden="true" />
            <h4 className="font-semibold text-sm leading-tight">{job.title}</h4>
          </div>
          {job.priority && job.priority !== 'low' && (
            <Badge
              variant={priority.badge}
              className="text-xs shrink-0 capitalize"
            >
              {job.priority}
            </Badge>
          )}
        </div>

        {/* Client */}
        {job.client_name && (
          <p className="text-xs text-muted-foreground font-medium">{job.client_name}</p>
        )}

        {/* Time info */}
        <div className="flex flex-wrap gap-2.5 text-xs text-muted-foreground">
          {job.scheduled_time && (
            <span className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-md">
              <Clock className="h-3 w-3" />
              <span className="font-medium">{job.scheduled_time.slice(0, 5)}</span>
            </span>
          )}
          {job.estimated_duration && (
            <span className="text-muted-foreground/70">({job.estimated_duration}min)</span>
          )}
        </div>

        {/* Technician */}
        {job.assigned_to_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-4 w-4 rounded-full bg-muted/60 flex items-center justify-center">
              <User className="h-2.5 w-2.5" />
            </div>
            <span>{job.assigned_to_name}</span>
          </div>
        )}

        {/* Address */}
        {job.address && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{job.address}</span>
          </div>
        )}
      </div>
    </Card>
  );
});
