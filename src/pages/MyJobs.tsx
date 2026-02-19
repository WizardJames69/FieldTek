import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { MapPin, Phone, MessageSquare, Loader2, Inbox, WifiOff, CloudOff, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { MobileJobCard } from '@/components/mobile/MobileJobCard';
import { JobStatusUpdater } from '@/components/mobile/JobStatusUpdater';
import { JobChecklist } from '@/components/mobile/JobChecklist';
import { JobPartsList } from '@/components/jobs/JobPartsList';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useOfflineJobs } from '@/hooks/useOfflineJobs';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useOfflineDataPreloader } from '@/hooks/useOfflineDataPreloader';
import { OfflineSyncStatus } from '@/components/offline/OfflineSyncStatus';
import { cn } from '@/lib/utils';

export default function MyJobs() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [offlineChecklistItems, setOfflineChecklistItems] = useState<any[]>([]);
  
  // Offline-aware jobs fetching
  const { jobs, isLoading, isOnline, isFromCache, refreshCache, getJobChecklist } = useOfflineJobs({
    userId: user?.id,
    tenantId: tenant?.id,
    enabled: !!user?.id && !!tenant?.id,
  });
  
  // Sync queue status
  const { pendingCount, isSyncing } = useOfflineSync();
  
  // Preloader for offline data
  const { preloadOfflineData } = useOfflineDataPreloader();

  // Pull to refresh
  const { isRefreshing, pullProgress, handlers, containerStyle } = usePullToRefresh({
    onRefresh: async () => {
      await refreshCache();
    },
  });

  // Fetch checklist items for selected job - works offline too
  useEffect(() => {
    const loadChecklist = async () => {
      if (selectedJob?.id) {
        try {
          const items = await getJobChecklist(selectedJob.id);
          setOfflineChecklistItems(items);
        } catch (error) {
          console.error('Failed to load checklist:', error);
          setOfflineChecklistItems([]);
        }
      } else {
        setOfflineChecklistItems([]);
      }
    };
    loadChecklist();
  }, [selectedJob?.id, getJobChecklist]);

  // Refresh cache when coming back online
  const hasRefreshedOnReconnect = useRef(false);
  useEffect(() => {
    if (isOnline && !isLoading && !hasRefreshedOnReconnect.current) {
      hasRefreshedOnReconnect.current = true;
      refreshCache();
    }
    if (!isOnline) {
      hasRefreshedOnReconnect.current = false;
    }
  }, [isOnline, isLoading, refreshCache]);

  const today = new Date();
  
  const filteredJobs = jobs?.filter((job) => {
    if (!job.scheduled_date) return view === 'today';
    
    const jobDate = parseISO(job.scheduled_date);
    
    switch (view) {
      case 'today':
        return isToday(jobDate) && job.status !== 'completed';
      case 'upcoming':
        return jobDate > today && job.status !== 'completed';
      case 'completed':
        return job.status === 'completed';
    }
  }) || [];

  const groupJobsByDate = (jobsToGroup: typeof jobs) => {
    if (!jobsToGroup) return {};
    return jobsToGroup.reduce((acc, job) => {
      const date = job.scheduled_date || 'Unscheduled';
      if (!acc[date]) acc[date] = [];
      acc[date].push(job);
      return acc;
    }, {} as Record<string, typeof jobsToGroup>);
  };

  const formatDateHeader = (date: string) => {
    if (date === 'Unscheduled') return date;
    const d = parseISO(date);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEEE, MMM d');
  };

  const groupedJobs = groupJobsByDate(filteredJobs);

  // Count jobs for each tab
  const todayCount = jobs?.filter(j => {
    if (!j.scheduled_date) return true;
    return isToday(parseISO(j.scheduled_date)) && j.status !== 'completed';
  }).length || 0;

  const upcomingCount = jobs?.filter(j => {
    if (!j.scheduled_date) return false;
    return parseISO(j.scheduled_date) > today && j.status !== 'completed';
  }).length || 0;

  return (
    <MainLayout title="My Jobs" subtitle="Your assigned work">
      <div 
        className="space-y-4 relative"
        {...handlers}
        style={containerStyle}
      >
        <PullToRefreshIndicator isRefreshing={isRefreshing} pullProgress={pullProgress} />
        
        {/* Enhanced Offline Status */}
        <OfflineSyncStatus />

        {/* View Tabs - Premium pills with animated badges */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
          <TabsList variant="pills" className="grid w-full grid-cols-3 h-14 p-1.5">
            <TabsTrigger variant="pills" value="today" className="relative h-full text-sm font-semibold">
              Today
              {todayCount > 0 && (
                <span className="absolute -top-1.5 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs flex items-center justify-center font-bold shadow-lg shadow-primary/30 ring-2 ring-background">
                  {todayCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger variant="pills" value="upcoming" className="relative h-full text-sm font-semibold">
              Upcoming
              {upcomingCount > 0 && (
                <span className="absolute -top-1.5 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-medium ring-2 ring-background">
                  {upcomingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger variant="pills" value="completed" className="h-full text-sm font-semibold">
              Completed
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Loading your jobs...</p>
            </div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="empty-state-native py-20">
            <div className="relative">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-muted/80 to-muted/40 backdrop-blur-xl flex items-center justify-center mb-5 ring-1 ring-border/50 shadow-xl">
                <Inbox className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="absolute inset-0 rounded-3xl bg-gradient-radial from-primary/10 to-transparent blur-xl" />
            </div>
            <h3 className="text-xl font-bold">No jobs</h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-[280px] leading-relaxed">
              {view === 'today'
                ? "You don't have any jobs scheduled for today. Enjoy your break!"
                : view === 'upcoming'
                ? 'No upcoming jobs assigned to you yet'
                : 'No completed jobs to show'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedJobs).map(([date, dateJobs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-base font-bold text-foreground">
                    {formatDateHeader(date)}
                  </h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/80 to-transparent" />
                  <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-3 py-1 rounded-full backdrop-blur-sm ring-1 ring-border/30">
                    {dateJobs.length} job{dateJobs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-3">
                  {dateJobs.map((job) => (
                    <MobileJobCard
                      key={job.id}
                      job={job}
                      onSelect={setSelectedJob}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Detail Sheet with premium glass styling */}
      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto sheet-glass">
          {selectedJob && (
            <>
              <SheetHeader className="sticky top-0 glass-morphism -mx-6 px-6 py-5 border-b border-border/30 z-10 shadow-lg shadow-black/5">
                <SheetTitle className="text-xl font-bold">{selectedJob.title}</SheetTitle>
              </SheetHeader>

              <div className="mt-8 space-y-8">
                {/* Status Updater */}
                <JobStatusUpdater 
                  jobId={selectedJob.id} 
                  currentStatus={selectedJob.status}
                  jobTitle={selectedJob.title}
                  clientName={selectedJob.client?.name}
                />

                <div className="section-divider" />

                {/* Client Info */}
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
                        <p className="font-semibold text-base">{selectedJob.client.name}</p>
                      </div>
                      {selectedJob.client.address && (
                        <div className="flex items-start gap-2.5 text-sm text-muted-foreground mb-4">
                          <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/70" />
                          <span>{selectedJob.client.address}</span>
                        </div>
                      )}
                      <div className="flex gap-3">
                        {selectedJob.client.phone && (
                          <Button size="default" variant="outline" className="flex-1 touch-native h-12 font-semibold" asChild>
                            <a href={`tel:${selectedJob.client.phone}`}>
                              <Phone className="h-4 w-4 mr-2" />
                              Call
                            </a>
                          </Button>
                        )}
                        <Button size="default" variant="outline" className="flex-1 touch-native h-12 font-semibold" asChild>
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(
                              selectedJob.address || selectedJob.client?.address || ''
                            )}`}
                            target="_blank"
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            Navigate
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedJob.description && (
                  <div>
                    <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-3">Description</h4>
                    <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 rounded-xl p-4 border border-border/30">{selectedJob.description}</p>
                  </div>
                )}

                {/* Notes */}
                {selectedJob.notes && (
                  <div>
                    <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-3">Notes</h4>
                    <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 rounded-xl p-4 border border-border/30">{selectedJob.notes}</p>
                  </div>
                )}

                {/* Checklist - works offline */}
                {offlineChecklistItems && offlineChecklistItems.length > 0 && (
                  <>
                    <div className="section-divider" />
                    <div>
                      <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-4">Checklist</h4>
                      <JobChecklist jobId={selectedJob.id} items={offlineChecklistItems} />
                    </div>
                  </>
                )}

                {/* Parts List */}
                <div className="section-divider" />
                <JobPartsList jobId={selectedJob.id} />

                {/* AI Assistant Link */}
                <div className="section-divider" />
                <Button variant="outline" className="w-full btn-shimmer touch-native h-14 font-semibold text-base" asChild>
                  <a href={`/assistant?job=${selectedJob.id}`}>
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Ask AI Assistant
                  </a>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}
