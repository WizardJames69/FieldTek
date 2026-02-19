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

const priorityConfig: Record<string, { badge: 'secondary' | 'warning' | 'destructive'; glow?: boolean }> = {
  low: { badge: 'secondary' },
  medium: { badge: 'secondary' },
  high: { badge: 'warning', glow: true },
  urgent: { badge: 'destructive', glow: true },
};

const statusBorderColors: Record<string, string> = {
  pending: "border-l-muted-foreground",
  scheduled: "border-l-primary",
  in_progress: "border-l-info",
  completed: "border-l-success",
  cancelled: "border-l-destructive",
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
  const statusBorder = statusBorderColors[job.status || "pending"];

  if (compact) {
    return (
      <div
        draggable={draggable}
        onDragStart={handleDragStart}
        className={cn(
          "p-2.5 rounded-xl bg-card/95 backdrop-blur-sm border-l-4 cursor-move",
          "hover:shadow-md hover:bg-card transition-all duration-200 touch-native",
          "ring-1 ring-border/30 hover:ring-primary/20",
          statusBorder
        )}
      >
        <p className="font-medium truncate text-xs">{job.title}</p>
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
      className={cn(
        "p-3.5 cursor-move border-l-4",
        statusBorder,
        job.priority === 'urgent' && "priority-glow-urgent"
      )}
    >
      <div className="space-y-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm leading-tight">{job.title}</h4>
          {job.priority && job.priority !== 'low' && (
            <Badge 
              variant={priority.badge}
              glow={priority.glow}
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
