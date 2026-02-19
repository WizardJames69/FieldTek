import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  GripVertical,
  ChevronDown,
  Inbox,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  title: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  status: string | null;
  priority: string | null;
  job_type?: string | null;
  address: string | null;
  assigned_to: string | null;
  client_name?: string;
}

interface UnassignedJobsSidebarProps {
  jobs: Job[];
  onJobDragStart?: (e: React.DragEvent, jobId: string) => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/20 text-primary',
  high: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  urgent: 'bg-destructive/20 text-destructive',
};

const priorityIcons: Record<string, React.ReactNode> = {
  urgent: <AlertTriangle className="h-3 w-3" />,
  high: <AlertTriangle className="h-3 w-3" />,
};

export function UnassignedJobsSidebar({ jobs, onJobDragStart }: UnassignedJobsSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Filter jobs that are unscheduled (no date) or unassigned (no technician)
  const unassignedJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      // Job is considered unassigned if it has no scheduled_date OR no assigned_to
      const isUnassigned = !job.scheduled_date || !job.assigned_to;
      const isNotCompleted = job.status !== 'completed' && job.status !== 'cancelled';
      const matchesPriority = priorityFilter === 'all' || job.priority === priorityFilter;
      return isUnassigned && isNotCompleted && matchesPriority;
    });

    // Sort by priority (urgent first)
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return filtered.sort((a, b) => {
      return (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2);
    });
  }, [jobs, priorityFilter]);

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData('jobId', jobId);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add visual feedback
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
    
    onJobDragStart?.(e, jobId);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const urgentCount = unassignedJobs.filter(j => j.priority === 'urgent').length;
  const highCount = unassignedJobs.filter(j => j.priority === 'high').length;

  return (
    <Card variant="glass" className="h-full flex flex-col shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex flex-col h-full">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/40 transition-all duration-200 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                  <Inbox className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">
                  Unassigned Jobs
                </CardTitle>
                <Badge 
                  variant="secondary" 
                  className="text-xs font-semibold bg-muted/80 backdrop-blur-sm"
                  glow={unassignedJobs.length > 0}
                >
                  {unassignedJobs.length}
                </Badge>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </div>
            {(urgentCount > 0 || highCount > 0) && (
              <div className="flex gap-2 mt-2.5">
                {urgentCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    glow 
                    className="text-xs shadow-[0_0_10px_-3px_hsl(var(--destructive)/0.5)]"
                  >
                    {urgentCount} Urgent
                  </Badge>
                )}
                {highCount > 0 && (
                  <Badge 
                    variant="warning" 
                    glow 
                    className="text-xs shadow-[0_0_10px_-3px_hsl(var(--warning)/0.5)]"
                  >
                    {highCount} High
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex-1 flex flex-col min-h-0">
          {/* Premium Filter */}
          <div className="px-4 pb-3">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 text-xs bg-background/60 backdrop-blur-sm border-border/50 focus:ring-primary/20">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent className="backdrop-blur-xl bg-popover/95">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent Only</SelectItem>
                <SelectItem value="high">High Only</SelectItem>
                <SelectItem value="medium">Medium Only</SelectItem>
                <SelectItem value="low">Low Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Job List */}
          <CardContent className="flex-1 p-0 min-h-0">
            <ScrollArea className="h-full px-4 pb-4">
              {unassignedJobs.length === 0 ? (
                <div className="empty-state-native flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3 ring-1 ring-border/30">
                    <Calendar className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {priorityFilter === 'all' 
                      ? 'All jobs are scheduled!'
                      : `No ${priorityFilter} priority jobs`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {unassignedJobs.map((job) => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "p-3.5 rounded-xl bg-card/80 backdrop-blur-sm cursor-grab active:cursor-grabbing",
                        "border border-border/50 ring-1 ring-transparent",
                        "hover:shadow-lg hover:border-primary/40 hover:ring-primary/20 hover:bg-card transition-all duration-200",
                        "group touch-native",
                        job.priority === 'urgent' && "border-l-4 border-l-destructive priority-glow-urgent",
                        job.priority === 'high' && "border-l-4 border-l-warning"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-50 group-hover:opacity-100" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium text-sm leading-tight truncate">
                              {job.title}
                            </h4>
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                'text-[10px] shrink-0 gap-0.5',
                                priorityColors[job.priority || 'medium']
                              )}
                            >
                              {priorityIcons[job.priority || '']}
                              {job.priority}
                            </Badge>
                          </div>

                          {job.client_name && (
                            <p className="text-xs text-muted-foreground truncate mb-1">
                              {job.client_name}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {job.estimated_duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {job.estimated_duration}m
                              </span>
                            )}
                            {job.address && (
                              <span className="flex items-center gap-1 truncate max-w-[120px]">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{job.address}</span>
                              </span>
                            )}
                          </div>

                          {/* Status badges */}
                          <div className="flex gap-1 mt-2">
                            {!job.scheduled_date && (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                No Date
                              </Badge>
                            )}
                            {!job.assigned_to && (
                              <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                Unassigned
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
