import { useState, useCallback } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobCard } from "./JobCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";

export type ViewMode = "day" | "week" | "month";

interface Job {
  id: string;
  title: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  status: string | null;
  priority: string | null;
  address: string | null;
  client_name?: string;
  assigned_to_name?: string;
  assigned_to: string | null;
}

export interface ExternalBusyBlock {
  id: string;
  user_id: string;
  provider: string;
  title: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
}

interface CalendarViewProps {
  jobs: Job[];
  viewMode: ViewMode;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onJobDrop: (jobId: string, date: string, technicianId?: string) => void;
  onJobClick: (job: Job) => void;
  selectedTechnician: string | null;
  busyBlocks?: ExternalBusyBlock[];
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7 AM to 6 PM

export function CalendarView({
  jobs,
  viewMode,
  currentDate,
  onDateChange,
  onViewModeChange,
  onJobDrop,
  onJobClick,
  selectedTechnician,
  busyBlocks = [],
}: CalendarViewProps) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isMobile = useIsMobile();

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrevious,
    threshold: 50,
  });

  function navigatePrevious() {
    if (viewMode === "day") onDateChange(subDays(currentDate, 1));
    else if (viewMode === "week") onDateChange(subWeeks(currentDate, 1));
    else onDateChange(subMonths(currentDate, 1));
  }

  function navigateNext() {
    if (viewMode === "day") onDateChange(addDays(currentDate, 1));
    else if (viewMode === "week") onDateChange(addWeeks(currentDate, 1));
    else onDateChange(addMonths(currentDate, 1));
  }

  const filteredJobs = selectedTechnician
    ? jobs.filter((job) => job.assigned_to === selectedTechnician)
    : jobs;

  const getBusyBlocksForDate = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return busyBlocks.filter((b) => {
        const blockDate = b.start_at.split("T")[0];
        return blockDate === dateStr;
      });
    },
    [busyBlocks]
  );

  const getJobsForDate = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return filteredJobs.filter((job) => job.scheduled_date === dateStr);
    },
    [filteredJobs]
  );

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateStr);
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if we're leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('[data-drop-zone]')) {
      setDragOverDate(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    if (jobId) {
      onJobDrop(jobId, dateStr, selectedTechnician || undefined);
    }
    setDragOverDate(null);
    setIsDragging(false);
  };

  const handleDragEnd = () => {
    setDragOverDate(null);
    setIsDragging(false);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const getTitle = () => {
    if (viewMode === "day") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  };

  const renderDayView = () => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayJobs = getJobsForDate(currentDate);
    const dayBusy = getBusyBlocksForDate(currentDate);

    return (
      <div className="flex-1 overflow-hidden" onDragEnd={handleDragEnd}>
        <ScrollArea className="h-full">
          <div className="min-h-full">
            {HOURS.map((hour) => {
              const hourJobs = dayJobs.filter((job) => {
                if (!job.scheduled_time) return hour === 7;
                const jobHour = parseInt(job.scheduled_time.split(":")[0]);
                return jobHour === hour;
              });
              const hourBusy = dayBusy.filter((b) => {
                if (b.is_all_day) return hour === 7;
                const bHour = new Date(b.start_at).getHours();
                return bHour === hour;
              });
              const hourKey = `${dateStr}-${hour}`;

              return (
                <div
                  key={hour}
                  data-drop-zone
                  className={cn(
                    "flex border-b min-h-[80px] transition-all duration-200",
                    dragOverDate === hourKey && "bg-primary/10 ring-2 ring-primary/30 ring-inset"
                  )}
                  onDragOver={(e) => handleDragOver(e, hourKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateStr)}
                >
                  <div className="w-20 shrink-0 p-2 text-sm text-muted-foreground border-r bg-muted/30">
                    {format(new Date().setHours(hour, 0), "h a")}
                  </div>
                  <div className="flex-1 p-2 space-y-2">
                    {hourBusy.map((b) => (
                      <div key={b.id} className="px-2 py-1 rounded bg-muted/60 border border-border/40 text-xs text-muted-foreground flex items-center gap-1.5 select-none">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                        Busy ({b.provider === "google" ? "Google" : "Outlook"})
                      </div>
                    ))}
                    {hourJobs.map((job) => (
                      <div key={job.id} onClick={() => onJobClick(job)}>
                        <JobCard
                          job={{
                            ...job,
                            scheduled_time: job.scheduled_time || undefined,
                            estimated_duration: job.estimated_duration || undefined,
                            status: job.status || undefined,
                            priority: job.priority || undefined,
                            address: job.address || undefined,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({
      start,
      end: endOfWeek(currentDate, { weekStartsOn: 0 }),
    });

    return (
      <div className="flex-1 overflow-hidden" onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 border-b">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "p-2 text-center border-r last:border-r-0",
                isToday(day) && "bg-primary/10"
              )}
            >
              <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  isToday(day) && "text-primary"
                )}
              >
                {format(day, "d")}
              </p>
            </div>
          ))}
        </div>
        <ScrollArea className="h-[calc(100%-60px)]">
          <div className="grid grid-cols-7 min-h-full">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayJobs = getJobsForDate(day);
              const dayBusy = getBusyBlocksForDate(day);

              return (
                <div
                  key={day.toISOString()}
                  data-drop-zone
                  className={cn(
                    "border-r last:border-r-0 p-2 min-h-[400px] transition-all duration-200",
                    dragOverDate === dateStr && "bg-primary/10 ring-2 ring-primary/30 ring-inset",
                    isDragging && dragOverDate !== dateStr && "bg-muted/20"
                  )}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateStr)}
                >
                  <div className="space-y-2">
                    {dayBusy.map((b) => (
                      <div key={b.id} className="px-1.5 py-1 rounded bg-muted/50 border border-border/30 text-xs text-muted-foreground select-none">
                        🔒 Busy
                      </div>
                    ))}
                    {dayJobs.map((job) => (
                      <div key={job.id} onClick={() => onJobClick(job)}>
                        <JobCard
                          job={{
                            ...job,
                            scheduled_time: job.scheduled_time || undefined,
                            estimated_duration: job.estimated_duration || undefined,
                            status: job.status || undefined,
                            priority: job.priority || undefined,
                            address: job.address || undefined,
                          }}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="flex-1 overflow-hidden flex flex-col" onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayJobs = getJobsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={day.toISOString()}
                  data-drop-zone
                  className={cn(
                    "border-r border-b last:border-r-0 p-1 min-h-[100px] transition-all duration-200",
                    !isCurrentMonth && "bg-muted/30",
                    dragOverDate === dateStr && "bg-primary/10 ring-2 ring-primary/30 ring-inset",
                    isDragging && dragOverDate !== dateStr && isCurrentMonth && "bg-muted/10"
                  )}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateStr)}
                >
                  <p
                    className={cn(
                      "text-sm mb-1",
                      !isCurrentMonth && "text-muted-foreground",
                      isToday(day) &&
                        "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center"
                    )}
                  >
                    {format(day, "d")}
                  </p>
                  <div className="space-y-1">
                    {dayJobs.slice(0, 3).map((job) => (
                      <div key={job.id} onClick={() => onJobClick(job)}>
                        <JobCard
                          job={{
                            ...job,
                            scheduled_time: job.scheduled_time || undefined,
                            estimated_duration: job.estimated_duration || undefined,
                            status: job.status || undefined,
                            priority: job.priority || undefined,
                            address: job.address || undefined,
                          }}
                          compact
                        />
                      </div>
                    ))}
                    {dayJobs.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{dayJobs.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Mobile swipe container props
  const mobileSwipeProps = isMobile ? swipeHandlers : {};

  return (
    <div 
      className="flex flex-col h-full glass-morphism rounded-xl shadow-lg ring-1 ring-border/50"
      {...mobileSwipeProps}
    >
      {/* Premium glass toolbar header */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-border/30 bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur-xl rounded-t-xl">
        <div className="flex items-center gap-1.5 md:gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={navigatePrevious} 
            className="h-8 w-8 md:h-9 md:w-9 touch-native bg-background/60 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={navigateNext} 
            className="h-8 w-8 md:h-9 md:w-9 touch-native bg-background/60 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goToToday} 
            className="h-8 md:h-9 touch-native bg-background/60 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all"
          >
            Today
          </Button>
          <h2 className="text-base md:text-lg font-semibold ml-2 hidden sm:block">{getTitle()}</h2>
        </div>
        {/* Premium pill view mode switcher */}
        <div className="flex items-center gap-0.5 bg-muted/40 backdrop-blur-xl rounded-xl p-1 ring-1 ring-border/30 shadow-inner">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "capitalize h-7 md:h-8 px-2.5 md:px-3 text-xs md:text-sm touch-native rounded-lg transition-all",
                viewMode === mode && "shadow-md bg-primary text-primary-foreground"
              )}
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Mobile: Show title below header */}
      <div className="sm:hidden px-4 py-2 border-b border-border/20 bg-gradient-to-r from-muted/30 via-muted/10 to-muted/30 backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-center">{getTitle()}</h2>
        <p className="text-xs text-muted-foreground text-center mt-0.5">Swipe left/right to navigate</p>
      </div>

      {/* Premium drop zone indicator when dragging */}
      {isDragging && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 backdrop-blur-sm border-b border-primary/30 text-center text-sm text-primary font-medium flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Drop job on a date to schedule it
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
      )}

      {viewMode === "day" && renderDayView()}
      {viewMode === "week" && renderWeekView()}
      {viewMode === "month" && renderMonthView()}
    </div>
  );
}
