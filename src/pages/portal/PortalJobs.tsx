import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Clock, MapPin, User, Calendar, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { format } from 'date-fns';
import { PortalAuthGuard } from '@/components/portal/PortalAuthGuard';

interface Job {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  job_type: string | null;
  address: string | null;
  estimated_duration: number | null;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  profiles: { full_name: string } | null;
}

export default function PortalJobs() {
  const { client, loading: authLoading, clientLoading, user } = usePortalAuth();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['portal-jobs', client?.id, client?.tenant_id],
    queryFn: async () => {
      if (!client?.id || !client?.tenant_id) return [];

      const { data } = await supabase
        .from('scheduled_jobs')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          scheduled_date,
          scheduled_time,
          job_type,
          address,
          estimated_duration,
          actual_start,
          actual_end,
          notes,
          profiles (full_name)
        `)
        .eq('client_id', client.id)
        .eq('tenant_id', client.tenant_id)
        .order('scheduled_date', { ascending: false });

      return (data || []) as unknown as Job[];
    },
    enabled: !!client?.id && !!client?.tenant_id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'info'; glow?: boolean; label: string }> = {
      pending: { variant: 'info', glow: true, label: 'Scheduled' },
      in_progress: { variant: 'default', glow: true, label: 'In Progress' },
      completed: { variant: 'success', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant as any} glow={config.glow}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const configs: Record<string, { variant: 'destructive' | 'warning' | 'info' | 'secondary'; glow?: boolean }> = {
      urgent: { variant: 'destructive', glow: true },
      high: { variant: 'warning', glow: true },
      medium: { variant: 'info' },
      low: { variant: 'secondary' },
    };
    const config = configs[priority] || configs.medium;
    return (
      <Badge variant={config.variant} glow={config.glow} className="capitalize text-xs">
        {priority}
      </Badge>
    );
  };

  const activeJobs = jobs?.filter(j => j.status === 'pending' || j.status === 'in_progress') || [];
  const completedJobs = jobs?.filter(j => j.status === 'completed') || [];

  const JobCard = ({ job }: { job: Job }) => {
    const priorityGlowClass = job.priority === 'urgent' ? 'priority-glow-urgent' : 
                              job.priority === 'high' ? 'priority-glow-high' : '';
    
    return (
      <Card 
        variant="interactive"
        glow={job.priority === 'urgent' ? 'destructive' : job.priority === 'high' ? 'warning' : 'primary'}
        className={`overflow-hidden cursor-pointer ${priorityGlowClass}`}
        onClick={() => setSelectedJob(job)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{job.title}</h3>
              {job.job_type && (
                <p className="text-sm text-muted-foreground">{job.job_type}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {job.priority && getPriorityBadge(job.priority)}
              {getStatusBadge(job.status || 'pending')}
            </div>
          </div>

          {job.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {job.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {job.scheduled_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary/70" />
                <span>
                  {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                  {job.scheduled_time && ` at ${job.scheduled_time.slice(0, 5)}`}
                </span>
              </div>
            )}

            {job.estimated_duration && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 text-primary/70" />
                <span>{job.estimated_duration} min</span>
              </div>
            )}

            {job.address && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <MapPin className="h-4 w-4 flex-shrink-0 text-primary/70" />
                <span className="truncate">{job.address}</span>
              </div>
            )}

            {job.profiles?.full_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 text-primary/70" />
                <span>{job.profiles.full_name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderJobList = (jobList: Job[], emptyMessage: string) => {
    if (isLoading) {
      return (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      );
    }

    if (jobList.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4">
        {jobList.map(job => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    );
  };

  return (
    <PortalAuthGuard>
    <PortalLayout>
      <div className="space-y-6">
        <div className="page-header-glass rounded-xl p-4 md:p-6 bg-background/60 backdrop-blur-xl border border-border/30">
          <h1 className="text-2xl font-bold font-display">My Jobs</h1>
          <p className="text-muted-foreground">View all your scheduled and completed service jobs</p>
        </div>

        <Tabs defaultValue="active">
          <TabsList variant="pills" className="w-full sm:w-auto">
            <TabsTrigger variant="pills" value="active" className="gap-2">
              Active
              {activeJobs.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                  {activeJobs.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger variant="pills" value="completed" className="gap-2">
              Completed
              {completedJobs.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-success/20 text-success text-xs font-medium">
                  {completedJobs.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger variant="pills" value="all" className="gap-2">
              All
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                {jobs?.length || 0}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {renderJobList(activeJobs, 'No active jobs at the moment')}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {renderJobList(completedJobs, 'No completed jobs yet')}
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            {renderJobList(jobs || [], 'No jobs found')}
          </TabsContent>
        </Tabs>
      </div>

      {/* Job Detail Sheet */}
      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto glass-surface">
          {selectedJob && (
            <>
              <SheetHeader className="pb-4 border-b border-border/50">
                <SheetTitle className="font-display text-xl">{selectedJob.title}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status and Priority */}
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(selectedJob.status || 'pending')}
                  {selectedJob.priority && getPriorityBadge(selectedJob.priority)}
                  {selectedJob.job_type && (
                    <Badge variant="outline" className="bg-background/50">{selectedJob.job_type}</Badge>
                  )}
                </div>

                <div className="section-divider h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />

                {/* Schedule Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Schedule</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedJob.scheduled_date && (
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p>{format(new Date(selectedJob.scheduled_date), 'EEEE, MMMM d, yyyy')}</p>
                      </div>
                    )}
                    {selectedJob.scheduled_time && (
                      <div>
                        <p className="text-muted-foreground">Time</p>
                        <p>{selectedJob.scheduled_time.slice(0, 5)}</p>
                      </div>
                    )}
                    {selectedJob.estimated_duration && (
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p>{selectedJob.estimated_duration} minutes</p>
                      </div>
                    )}
                    {selectedJob.actual_start && (
                      <div>
                        <p className="text-muted-foreground">Started</p>
                        <p>{format(new Date(selectedJob.actual_start), 'h:mm a')}</p>
                      </div>
                    )}
                    {selectedJob.actual_end && (
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p>{format(new Date(selectedJob.actual_end), 'h:mm a')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                {selectedJob.address && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium">Location</h4>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <p className="text-sm">{selectedJob.address}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(selectedJob.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Open in Maps
                        </a>
                      </Button>
                    </div>
                  </>
                )}

                {/* Technician */}
                {selectedJob.profiles?.full_name && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium">Assigned Technician</h4>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">{selectedJob.profiles.full_name}</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Description */}
                {selectedJob.description && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium">Description</h4>
                      <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
                    </div>
                  </>
                )}

                {/* Notes */}
                {selectedJob.notes && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium">Technician Notes</h4>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">{selectedJob.notes}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PortalLayout>
    </PortalAuthGuard>
  );
}