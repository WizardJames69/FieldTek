import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  parseISO,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Inbox,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TechnicianCalendarJobCard } from '@/components/calendar/TechnicianCalendarJobCard';
import { CalendarLegend } from '@/components/calendar/CalendarLegend';
import { JobQuickActions } from '@/components/calendar/JobQuickActions';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useIsMobile } from '@/hooks/use-mobile';

type ViewMode = 'day' | 'week' | 'month';

interface Job {
  id: string;
  title: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  status: string | null;
  priority: string | null;
  job_type: string | null;
  address: string | null;
  description: string | null;
  notes: string | null;
  client?: {
    name: string;
    phone: string | null;
    address: string | null;
  } | null;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7 AM to 6 PM

export default function MyCalendar() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const isMobile = useIsMobile();

  const navigatePrevious = useCallback(() => {
    if (viewMode === 'day') setCurrentDate(prev => subDays(prev, 1));
    else if (viewMode === 'week') setCurrentDate(prev => subWeeks(prev, 1));
    else setCurrentDate(prev => subMonths(prev, 1));
  }, [viewMode]);

  const navigateNext = useCallback(() => {
    if (viewMode === 'day') setCurrentDate(prev => addDays(prev, 1));
    else if (viewMode === 'week') setCurrentDate(prev => addWeeks(prev, 1));
    else setCurrentDate(prev => addMonths(prev, 1));
  }, [viewMode]);

  // Swipe gestures for mobile navigation
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrevious,
    threshold: 50,
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['my-calendar-jobs', user?.id, tenant?.id, currentDate, viewMode],
    queryFn: async () => {
      if (!user?.id || !tenant?.id) return [];

      // Calculate date range based on view
      let startDate: Date;
      let endDate: Date;

      if (viewMode === 'day') {
        startDate = currentDate;
        endDate = currentDate;
      } else if (viewMode === 'week') {
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
      } else {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      }

      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select(`
          *,
          client:clients(name, phone, address)
        `)
        .eq('tenant_id', tenant.id)
        .eq('assigned_to', user.id)
        .gte('scheduled_date', format(startDate, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endDate, 'yyyy-MM-dd'))
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!user?.id && !!tenant?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: string }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'in_progress') {
        updateData.actual_start = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.actual_end = new Date().toISOString();
      }

      const { error } = await supabase
        .from('scheduled_jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-calendar-jobs'] });
      toast.success('Job status updated');
    },
    onError: () => {
      toast.error('Failed to update job status');
    },
  });

  const getJobsForDate = useCallback(
    (date: Date) => {
      if (!jobs) return [];
      const dateStr = format(date, 'yyyy-MM-dd');
      return jobs.filter((job) => job.scheduled_date === dateStr);
    },
    [jobs]
  );

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getTitle = () => {
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

  const handleQuickAction = (jobId: string, action: 'start' | 'complete') => {
    const newStatus = action === 'start' ? 'in_progress' : 'completed';
    updateStatusMutation.mutate({ jobId, status: newStatus });
  };

  const renderDayView = () => {
    const dayJobs = getJobsForDate(currentDate);

    return (
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="min-h-full">
            {HOURS.map((hour) => {
              const hourJobs = dayJobs.filter((job) => {
                if (!job.scheduled_time) return hour === 7;
                const jobHour = parseInt(job.scheduled_time.split(':')[0]);
                return jobHour === hour;
              });

              return (
                <div key={hour} className="flex border-b min-h-[80px]">
                  <div className="w-20 shrink-0 p-2 text-sm text-muted-foreground border-r bg-muted/30">
                    {format(new Date().setHours(hour, 0), 'h a')}
                  </div>
                  <div className="flex-1 p-2 space-y-2">
                    {hourJobs.map((job) => (
                      <TechnicianCalendarJobCard
                        key={job.id}
                        job={job}
                        onClick={() => setSelectedJob(job)}
                        onQuickAction={handleQuickAction}
                      />
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

    // On mobile, show a 3-day view centered on today or current date
    const mobileDays = isMobile ? days.slice(
      Math.max(0, days.findIndex(d => isToday(d)) - 1),
      Math.max(0, days.findIndex(d => isToday(d)) - 1) + 3
    ).length === 3 ? days.slice(
      Math.max(0, days.findIndex(d => isToday(d)) - 1),
      Math.max(0, days.findIndex(d => isToday(d)) - 1) + 3
    ) : days.slice(0, 3) : days;

    const displayDays = isMobile ? mobileDays : days;

    return (
      <div className="flex-1 overflow-hidden">
        <div className={cn(
          "grid border-b",
          isMobile ? "grid-cols-3" : "grid-cols-7"
        )}>
          {displayDays.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                'p-2 text-center border-r last:border-r-0',
                isToday(day) && 'bg-primary/10'
              )}
            >
              <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
              <p
                className={cn(
                  'text-lg font-semibold',
                  isToday(day) && 'text-primary'
                )}
              >
                {format(day, 'd')}
              </p>
            </div>
          ))}
        </div>
        <ScrollArea className="h-[calc(100%-60px)]">
          <div className={cn(
            "grid min-h-full",
            isMobile ? "grid-cols-3" : "grid-cols-7"
          )}>
            {displayDays.map((day) => {
              const dayJobs = getJobsForDate(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-r last:border-r-0 p-2 min-h-[400px]',
                    isToday(day) && 'bg-primary/5'
                  )}
                >
                  <div className="space-y-2">
                    {dayJobs.map((job) => (
                      <TechnicianCalendarJobCard
                        key={job.id}
                        job={job}
                        compact
                        onClick={() => setSelectedJob(job)}
                        onQuickAction={handleQuickAction}
                      />
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
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
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
              const dayJobs = getJobsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-r border-b last:border-r-0 p-1 min-h-[100px]',
                    !isCurrentMonth && 'bg-muted/30'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm mb-1',
                      !isCurrentMonth && 'text-muted-foreground',
                      isToday(day) &&
                        'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center'
                    )}
                  >
                    {format(day, 'd')}
                  </p>
                  <div className="space-y-1">
                    {dayJobs.slice(0, 3).map((job) => (
                      <TechnicianCalendarJobCard
                        key={job.id}
                        job={job}
                        compact
                        onClick={() => setSelectedJob(job)}
                        onQuickAction={handleQuickAction}
                      />
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

  if (isLoading) {
    return (
      <MainLayout title="My Calendar" subtitle="Your scheduled jobs">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  // Mobile swipe container props
  const mobileSwipeProps = isMobile ? swipeHandlers : {};

  return (
    <MainLayout title="My Calendar" subtitle="Your scheduled jobs">
      <div className="space-y-4">
        {/* Calendar Legend - Enhanced */}
        <CalendarLegend />

        {/* Calendar - Premium glass container */}
        <div 
          className="flex flex-col h-[calc(100vh-220px)] md:h-[calc(100vh-280px)] rounded-2xl border border-border/50 overflow-hidden glass-morphism shadow-xl shadow-black/5"
          {...mobileSwipeProps}
        >
          {/* Header - Premium styling */}
          <div className="flex items-center justify-between p-4 border-b border-border/40 bg-gradient-to-r from-muted/30 to-transparent">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrevious} className="touch-native h-10 w-10 rounded-xl">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext} className="touch-native h-10 w-10 rounded-xl">
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} className="touch-native h-10 px-4 rounded-xl font-semibold">
                Today
              </Button>
              <h2 className="text-lg font-bold ml-3 hidden sm:block">{getTitle()}</h2>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 backdrop-blur-sm rounded-xl p-1.5 ring-1 ring-border/30">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "capitalize rounded-lg h-9 px-4 font-semibold transition-all",
                    viewMode === mode && "shadow-lg shadow-primary/20"
                  )}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Mobile: Show title below header - Premium styling */}
          <div className="sm:hidden px-4 py-3 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
            <h2 className="text-base font-bold text-center">{getTitle()}</h2>
            <p className="text-xs text-muted-foreground text-center mt-1 flex items-center justify-center gap-1.5">
              <span className="inline-block w-4 h-0.5 bg-gradient-to-r from-muted-foreground/50 to-transparent rounded" />
              Swipe to navigate
              <span className="inline-block w-4 h-0.5 bg-gradient-to-l from-muted-foreground/50 to-transparent rounded" />
            </p>
          </div>

          {/* Calendar Content */}
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
        </div>
      </div>

      {/* Job Detail Sheet - Premium styling */}
      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto sheet-glass">
          {selectedJob && (
            <>
              <SheetHeader className="sticky top-0 glass-morphism -mx-6 px-6 py-5 border-b border-border/30 z-10 shadow-lg shadow-black/5">
                <SheetTitle className="text-xl font-bold">{selectedJob.title}</SheetTitle>
              </SheetHeader>

              <div className="mt-8 space-y-8">
                {/* Quick Actions - Enhanced */}
                <JobQuickActions
                  job={selectedJob}
                  onAction={(action) => {
                    handleQuickAction(selectedJob.id, action);
                    setSelectedJob(null);
                  }}
                />

                <div className="section-divider" />

                {/* Job Details - Premium card grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl glass-morphism border border-border/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</p>
                    <Badge
                      variant={selectedJob.status === 'in_progress' ? 'info' : selectedJob.status === 'completed' ? 'success' : 'secondary'}
                      glow={selectedJob.status === 'in_progress'}
                      className="text-sm font-semibold"
                    >
                      {selectedJob.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="p-4 rounded-xl glass-morphism border border-border/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Priority</p>
                    <Badge
                      variant={selectedJob.priority === 'urgent' ? 'destructive' : selectedJob.priority === 'high' ? 'warning' : 'secondary'}
                      glow={selectedJob.priority === 'urgent'}
                      className="text-sm font-semibold capitalize"
                    >
                      {selectedJob.priority}
                    </Badge>
                  </div>
                  {selectedJob.job_type && (
                    <div className="p-4 rounded-xl glass-morphism border border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Job Type</p>
                      <Badge variant="outline" className="text-sm font-semibold capitalize">{selectedJob.job_type}</Badge>
                    </div>
                  )}
                  {selectedJob.estimated_duration && (
                    <div className="p-4 rounded-xl glass-morphism border border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Duration</p>
                      <p className="text-sm font-bold">{selectedJob.estimated_duration} min</p>
                    </div>
                  )}
                </div>

                <div className="section-divider" />

                {/* Client Info - Premium card */}
                {selectedJob.client && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Client Details</h4>
                    <div className="p-5 rounded-2xl glass-morphism border border-border/40">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
                          <span className="text-sm font-bold text-primary">
                            {selectedJob.client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{selectedJob.client.name}</p>
                          {selectedJob.address && (
                            <p className="text-xs text-muted-foreground">{selectedJob.address}</p>
                          )}
                        </div>
                      </div>
                      {selectedJob.client.phone && (
                        <Button size="default" variant="outline" className="w-full touch-native h-12 font-semibold" asChild>
                          <a href={`tel:${selectedJob.client.phone}`}>
                            Call {selectedJob.client.phone}
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedJob.description && (
                  <>
                    <div className="section-divider" />
                    <div>
                      <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-3">Description</h4>
                      <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 rounded-xl p-4 border border-border/30">{selectedJob.description}</p>
                    </div>
                  </>
                )}

                {/* Notes */}
                {selectedJob.notes && (
                  <div>
                    <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-3">Notes</h4>
                    <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 rounded-xl p-4 border border-border/30">{selectedJob.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}
