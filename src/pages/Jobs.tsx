import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  Plus, 
  MoreHorizontal, 
  Clock, 
  MapPin, 
  User, 
  Calendar,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Download,
  UserPlus,
  Upload,
  RefreshCw
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { JobFilters } from '@/components/jobs/JobFilters';
import { JobFormDialog } from '@/components/jobs/JobFormDialog';
import { JobDetailSheet } from '@/components/jobs/JobDetailSheet';
import { RecurringJobsList } from '@/components/jobs/RecurringJobsList';
import { RecurringJobBadge } from '@/components/jobs/RecurringJobBadge';
import { CSVImportDialog } from '@/components/import';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useUserRole } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ScheduledJob, JobStatus, JobPriority, Client, Profile } from '@/types/database';
import { useNavigate } from 'react-router-dom';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTerminology } from '@/hooks/useTerminology';
import { notifyJobCompleted } from '@/lib/pushNotifications';
import { useSelection } from '@/hooks/useSelection';
import { SelectCheckbox, SelectAllCheckbox } from '@/components/bulk/SelectCheckbox';
import { BulkActionToolbar } from '@/components/bulk/BulkActionToolbar';
import { BulkConfirmDialog } from '@/components/bulk/BulkConfirmDialog';
import { exportJobsToCsv } from '@/lib/exportCsv';
import { useActiveRecurringJobsCount } from '@/hooks/useRecurringJobs';

interface JobClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface JobProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface JobWithRelations extends Omit<ScheduledJob, 'client' | 'assigned_user'> {
  clients?: JobClient | null;
  profiles?: JobProfile | null;
}

export default function Jobs() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { t } = useTerminology();

  const [jobs, setJobs] = useState<JobWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'jobs' | 'recurring'>('jobs');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [viewingJob, setViewingJob] = useState<JobWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  const recurringCount = useActiveRecurringJobsCount();

  // Bulk selection
  const selection = useSelection();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string | null }[]>([]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await fetchJobs();
  }, [tenant]);

  const { isRefreshing, pullProgress, handlers, containerStyle } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isMobile || authLoading || tenantLoading,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !tenantLoading && user && !tenant) {
      navigate('/onboarding');
    }
  }, [user, tenant, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    if (tenant) {
      fetchJobs();
      fetchTeamMembers();
    }
  }, [tenant]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Fetch jobs with client relation
      const { data: jobsData, error: jobsError } = await supabase
        .from('scheduled_jobs')
        .select(`
          *,
          clients:client_id (id, name, email, phone, address)
        `)
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .order('scheduled_time', { ascending: true, nullsFirst: false });

      if (jobsError) throw jobsError;

      // Fetch profiles for assigned technicians
      const assignedUserIds = (jobsData || [])
        .filter(j => j.assigned_to)
        .map(j => j.assigned_to);
      
      let profilesMap: Record<string, JobProfile> = {};
      
      if (assignedUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, avatar_url')
          .in('user_id', assignedUserIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = p as JobProfile;
            return acc;
          }, {} as Record<string, JobProfile>);
        }
      }

      // Combine jobs with profiles
      const jobsWithProfiles: JobWithRelations[] = (jobsData || []).map(job => ({
        ...job,
        profiles: job.assigned_to ? profilesMap[job.assigned_to] || null : null,
      })) as JobWithRelations[];

      setJobs(jobsWithProfiles);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error loading jobs',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data } = await supabase
        .from('tenant_users')
        .select('user_id')
        .eq('is_active', true);

      if (data && data.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', data.map(d => d.user_id));
        
        if (profiles) {
          setTeamMembers(profiles);
        }
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;
    
    try {
      const { error } = await supabase
        .from('scheduled_jobs')
        .delete()
        .eq('id', deleteJobId);

      if (error) throw error;
      
      toast({ title: 'Job deleted successfully' });
      setJobs(jobs.filter(j => j.id !== deleteJobId));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting job',
        description: error.message,
      });
    } finally {
      setDeleteJobId(null);
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    const jobToUpdate = jobs.find(j => j.id === jobId);
    const previousStatus = jobToUpdate?.status;
    
    try {
      const { error } = await supabase
        .from('scheduled_jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;
      
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
      toast({ title: `Job marked as ${newStatus.replace('_', ' ')}` });
      
      // Notify dispatchers when job is completed
      if (newStatus === 'completed' && previousStatus !== 'completed' && tenant?.id && jobToUpdate) {
        notifyJobCompleted(tenant.id, {
          jobId,
          jobTitle: jobToUpdate.title,
          clientName: jobToUpdate.clients?.name || 'Unknown Client',
          technicianName: jobToUpdate.profiles?.full_name || undefined,
        }).catch(err => console.error('Push notification failed:', err));
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating status',
        description: error.message,
      });
    }
  };

  // Bulk operations
  const handleBulkStatusChange = async (newStatus: JobStatus) => {
    setBulkStatusLoading(true);
    try {
      const ids = selection.selectedArray;
      const { error } = await supabase
        .from('scheduled_jobs')
        .update({ status: newStatus })
        .in('id', ids);

      if (error) throw error;

      setJobs(jobs.map(j => ids.includes(j.id) ? { ...j, status: newStatus } : j));
      toast({ title: `${ids.length} jobs updated to ${newStatus.replace('_', ' ')}` });
      selection.clearAll();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating jobs',
        description: error.message,
      });
    } finally {
      setBulkStatusLoading(false);
    }
  };

  const handleBulkAssign = async (userId: string) => {
    setBulkStatusLoading(true);
    try {
      const ids = selection.selectedArray;
      const { error } = await supabase
        .from('scheduled_jobs')
        .update({ assigned_to: userId })
        .in('id', ids);

      if (error) throw error;

      toast({ title: `${ids.length} jobs assigned` });
      selection.clearAll();
      fetchJobs(); // Refresh to get updated profile data
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error assigning jobs',
        description: error.message,
      });
    } finally {
      setBulkStatusLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const ids = selection.selectedArray;
      const { error } = await supabase
        .from('scheduled_jobs')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setJobs(jobs.filter(j => !ids.includes(j.id)));
      toast({ title: `${ids.length} jobs deleted` });
      selection.clearAll();
      setBulkDeleteOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error deleting jobs',
        description: error.message,
      });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExportSelected = () => {
    const selectedJobs = jobs.filter(j => selection.selectedIds.has(j.id));
    exportJobsToCsv(selectedJobs);
    toast({ title: `Exported ${selectedJobs.length} jobs to CSV` });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDateFilter(undefined);
  };

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          job.title.toLowerCase().includes(query) ||
          job.clients?.name?.toLowerCase().includes(query) ||
          job.address?.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && job.priority !== priorityFilter) return false;

      // Date filter
      if (dateFilter && job.scheduled_date) {
        const jobDate = format(new Date(job.scheduled_date), 'yyyy-MM-dd');
        const filterDate = format(dateFilter, 'yyyy-MM-dd');
        if (jobDate !== filterDate) return false;
      }

      return true;
    });
  }, [jobs, searchQuery, statusFilter, priorityFilter, dateFilter]);

  const filteredJobIds = useMemo(() => filteredJobs.map(j => j.id), [filteredJobs]);

  const getStatusBadge = (status: JobStatus) => {
    const styles: Record<JobStatus, string> = {
      pending: 'bg-muted text-muted-foreground',
      scheduled: 'bg-info/10 text-info',
      in_progress: 'bg-warning/10 text-warning',
      completed: 'bg-success/10 text-success',
      cancelled: 'bg-destructive/10 text-destructive',
    };
    return styles[status];
  };

  const getPriorityBadge = (priority: JobPriority) => {
    const styles: Record<JobPriority, string> = {
      low: 'border-muted-foreground/30 text-muted-foreground',
      medium: 'border-info/30 text-info',
      high: 'border-warning/30 text-warning',
      urgent: 'border-destructive/30 text-destructive',
    };
    return styles[priority];
  };

  const getPriorityIcon = (priority: JobPriority) => {
    if (priority === 'urgent') return <AlertTriangle className="h-3 w-3" />;
    return null;
  };

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <MainLayout 
      title={t('jobs')} 
      subtitle={`${filteredJobs.length} ${t('jobs').toLowerCase()} found`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>
          <Button data-testid="jobs-create-button" onClick={() => { setSelectedJob(null); setIsFormOpen(true); }} className="gap-2 btn-shimmer touch-native">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New {t('job')}</span>
          </Button>
        </div>
      }
    >
      <div 
        className="space-y-4 md:space-y-6 animate-fade-up"
        {...handlers}
        style={containerStyle}
      >
        <PullToRefreshIndicator isRefreshing={isRefreshing} pullProgress={pullProgress} />
        
        {/* Tabs for Jobs vs Recurring */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'jobs' | 'recurring')}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="jobs" className="gap-2">
              <Calendar className="h-4 w-4" />
              All {t('jobs')}
            </TabsTrigger>
            <TabsTrigger value="recurring" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recurring
              {recurringCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{recurringCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recurring" className="mt-4">
            <RecurringJobsList />
          </TabsContent>

          <TabsContent value="jobs" className="mt-4 space-y-4">
        
        {/* Phase 6: Glass filter container */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {filteredJobs.length > 0 && (
                <SelectAllCheckbox
                  checked={selection.isAllSelected(filteredJobIds)}
                  indeterminate={selection.isPartiallySelected(filteredJobIds)}
                  onCheckedChange={(checked) => {
                if (checked) {
                  selection.selectAll(filteredJobIds);
                } else {
                    selection.clearAll();
                  }
                }}
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <JobFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                priorityFilter={priorityFilter}
                onPriorityChange={setPriorityFilter}
                dateFilter={dateFilter}
                onDateChange={setDateFilter}
                onClearFilters={clearFilters}
              />
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Jobs List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card className="border-dashed app-glass-container" data-testid="jobs-empty-state">
            <CardContent className="p-12 text-center">
              {/* Phase 5: Enhanced empty state with radial glow */}
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center empty-state-glow">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-2">No {t('jobs').toLowerCase()} found</h3>
              <p className="text-muted-foreground mb-4">
                {jobs.length === 0 
                  ? `You haven't created any ${t('jobs').toLowerCase()} yet.` 
                  : `No ${t('jobs').toLowerCase()} match your current filters.`}
              </p>
              <Button onClick={() => { setSelectedJob(null); setIsFormOpen(true); }} className="touch-native">
                <Plus className="h-4 w-4 mr-2" />
                Create your first {t('job').toLowerCase()}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" data-testid="jobs-list">
            {filteredJobs.map((job) => {
              // Phase 6: Priority-based glow effects
              const priorityGlow = job.priority === 'urgent' 
                ? 'priority-glow-urgent' 
                : job.priority === 'high' 
                  ? 'shadow-[inset_0_0_0_1px_hsl(var(--warning)/0.2)]' 
                  : '';
              
              return (
              <Card key={job.id} data-testid="job-card" className={cn(
                "card-interactive card-premium group touch-native relative overflow-hidden",
                priorityGlow,
                selection.isSelected(job.id) && "ring-2 ring-primary/50"
              )}>
                {/* Priority accent bar */}
                {(job.priority === 'urgent' || job.priority === 'high') && (
                  <div 
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      job.priority === 'urgent' ? 'bg-destructive' : 'bg-warning'
                    )}
                  />
                )}
                <CardContent className="p-4 sm:p-6 pl-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Selection checkbox + Job info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <SelectCheckbox
                        checked={selection.isSelected(job.id)}
                        onCheckedChange={() => selection.toggle(job.id)}
                        aria-label={`Select ${job.title}`}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                            {job.clients && (
                              <p className="text-sm text-muted-foreground">{job.clients.name}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusBadge(job.status)}>
                              {job.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className={cn('gap-1', getPriorityBadge(job.priority))}>
                              {getPriorityIcon(job.priority)}
                              {job.priority}
                            </Badge>
                          </div>
                        </div>

                        {job.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {job.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          {job.scheduled_date && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(job.scheduled_date), 'MMM d, yyyy')}</span>
                              {job.scheduled_time && (
                                <span>at {job.scheduled_time.slice(0, 5)}</span>
                              )}
                            </div>
                          )}
                          {job.estimated_duration && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              <span>{job.estimated_duration} min</span>
                            </div>
                          )}
                          {job.profiles && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-4 w-4" />
                              <span>{job.profiles.full_name}</span>
                            </div>
                          )}
                          {job.address && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-4 w-4" />
                              <span className="truncate max-w-[200px]">{job.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side - Actions */}
                    <div className="flex items-center gap-2 self-start">
                      {job.status !== 'completed' && job.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(job.id, job.status === 'in_progress' ? 'completed' : 'in_progress')}
                          className="gap-1"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {job.status === 'in_progress' ? 'Complete' : 'Start'}
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setViewingJob(job);
                            setDetailOpen(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedJob(job); setIsFormOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'pending')}>
                            Set as Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'scheduled')}>
                            Set as Scheduled
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'in_progress')}>
                            Set as In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'completed')}>
                            Set as Completed
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setDeleteJobId(job.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>
        )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selection.count}
        onClearSelection={selection.clearAll}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={bulkStatusLoading}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleBulkStatusChange('pending')}>
              Set as Pending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkStatusChange('scheduled')}>
              Set as Scheduled
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkStatusChange('in_progress')}>
              Set as In Progress
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBulkStatusChange('completed')}>
              Set as Completed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={bulkStatusLoading}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {teamMembers.map((member) => (
              <DropdownMenuItem 
                key={member.user_id}
                onClick={() => handleBulkAssign(member.user_id)}
              >
                {member.full_name || 'Unnamed'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="outline" onClick={handleExportSelected}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>

        {isAdmin && (
          <Button 
            size="sm" 
            variant="outline" 
            className="text-destructive hover:text-destructive"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </BulkActionToolbar>

      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete Selected Jobs"
        description={`Are you sure you want to delete ${selection.count} jobs? This action cannot be undone.`}
        actionLabel="Delete Jobs"
        onConfirm={handleBulkDelete}
        isLoading={bulkDeleteLoading}
        variant="destructive"
      />

      <JobDetailSheet
        job={viewingJob}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={() => {
          setDetailOpen(false);
          setSelectedJob(viewingJob as ScheduledJob);
          setIsFormOpen(true);
        }}
        onStatusChange={handleStatusChange}
      />

      {/* Create/Edit Dialog */}
      <JobFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        job={selectedJob}
        onSuccess={fetchJobs}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteJob} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={fetchJobs}
      />
    </MainLayout>
  );
}
