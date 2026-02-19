import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { CalendarView, ViewMode } from "@/components/schedule/CalendarView";
import { TechnicianSidebar } from "@/components/schedule/TechnicianSidebar";
import { UnassignedJobsSidebar } from "@/components/schedule/UnassignedJobsSidebar";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Users, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useTerminology } from "@/hooks/useTerminology";
import { notifyJobAssignment } from "@/lib/pushNotifications";

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
  assigned_to_name?: string;
}

interface Technician {
  user_id: string;
  full_name: string;
  jobCount: number;
}

export default function Schedule() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { t } = useTerminology();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [unassignedSheetOpen, setUnassignedSheetOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      const { data: jobsData, error: jobsError } = await supabase
        .from("scheduled_jobs")
        .select(`
          id,
          title,
          scheduled_date,
          scheduled_time,
          estimated_duration,
          status,
          priority,
          job_type,
          address,
          assigned_to,
          client_id,
          clients (name)
        `)
        .eq("tenant_id", tenant.id)
        .not("status", "eq", "cancelled");

      if (jobsError) throw jobsError;

      // Fetch profiles for assigned technicians
      const assignedUserIds = [...new Set((jobsData || []).map((j) => j.assigned_to).filter(Boolean))];
      let profilesMap: Record<string, string> = {};

      if (assignedUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", assignedUserIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = p.full_name || "Unknown";
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const formattedJobs: Job[] = (jobsData || []).map((job) => ({
        id: job.id,
        title: job.title,
        scheduled_date: job.scheduled_date,
        scheduled_time: job.scheduled_time,
        estimated_duration: job.estimated_duration,
        status: job.status,
        priority: job.priority,
        job_type: job.job_type,
        address: job.address,
        assigned_to: job.assigned_to,
        client_name: job.clients?.name,
        assigned_to_name: job.assigned_to ? profilesMap[job.assigned_to] : undefined,
      }));

      setJobs(formattedJobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    }
  }, [tenant?.id]);

  const fetchTechnicians = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      const { data: tenantUsers, error: usersError } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .in("role", ["technician", "admin", "owner"]);

      if (usersError) throw usersError;

      const userIds = tenantUsers?.map((u) => u.user_id) || [];

      if (userIds.length === 0) {
        setTechnicians([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Count jobs for today for each technician
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { data: todayJobs } = await supabase
        .from("scheduled_jobs")
        .select("assigned_to")
        .eq("tenant_id", tenant.id)
        .eq("scheduled_date", todayStr)
        .not("status", "in", '("completed","cancelled")');

      const jobCounts: Record<string, number> = {};
      (todayJobs || []).forEach((job) => {
        if (job.assigned_to) {
          jobCounts[job.assigned_to] = (jobCounts[job.assigned_to] || 0) + 1;
        }
      });

      const techList: Technician[] = (profiles || []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name || "Unknown",
        jobCount: jobCounts[p.user_id] || 0,
      }));

      setTechnicians(techList);
    } catch (error) {
      console.error("Error fetching technicians:", error);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!tenantLoading && !tenant) {
      navigate("/onboarding");
      return;
    }
  }, [user, tenant, authLoading, tenantLoading, navigate]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchJobs(), fetchTechnicians()]);
      setLoading(false);
    };

    if (tenant?.id) {
      loadData();
    }
  }, [tenant?.id, fetchJobs, fetchTechnicians]);

  const handleJobDrop = async (jobId: string, date: string, technicianId?: string) => {
    try {
      // Find the job being updated to check for new assignment
      const jobBeingUpdated = jobs.find(j => j.id === jobId);
      const previousAssignee = jobBeingUpdated?.assigned_to;
      const isNewAssignment = technicianId && technicianId !== previousAssignee;

      const updateData: Record<string, unknown> = { scheduled_date: date };
      
      // If a technician is selected, also assign the job to them
      if (technicianId) {
        updateData.assigned_to = technicianId;
      }

      const { error } = await supabase
        .from("scheduled_jobs")
        .update(updateData)
        .eq("id", jobId);

      if (error) throw error;

      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId 
            ? { 
                ...job, 
                scheduled_date: date,
                assigned_to: technicianId || job.assigned_to,
              } 
            : job
        )
      );

      // Send push notification for new assignment
      if (isNewAssignment && tenant?.id && jobBeingUpdated) {
        const formattedDate = format(new Date(date), 'MMM d, yyyy');
        
        notifyJobAssignment(technicianId, tenant.id, {
          jobId,
          jobTitle: jobBeingUpdated.title,
          clientName: jobBeingUpdated.client_name || 'Unknown Client',
          scheduledDate: formattedDate,
          address: jobBeingUpdated.address || undefined,
        }).catch(err => console.error('Push notification failed:', err));
      }

      toast.success("Job scheduled successfully");
      fetchTechnicians(); // Refresh technician job counts
    } catch (error) {
      console.error("Error updating job:", error);
      toast.error("Failed to schedule job");
    }
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setJobDialogOpen(true);
  };

  const handleCreateJob = () => {
    setSelectedJob(null);
    setJobDialogOpen(true);
  };

  const handleJobSuccess = () => {
    setJobDialogOpen(false);
    setSelectedJob(null);
    fetchJobs();
    fetchTechnicians();
  };

  // Count unassigned jobs
  const unassignedCount = jobs.filter(
    j => (!j.scheduled_date || !j.assigned_to) && j.status !== 'completed' && j.status !== 'cancelled'
  ).length;

  if (authLoading || tenantLoading || loading) {
    return (
      <MainLayout title={t('schedule')}>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('schedule')}>
      <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
        {/* Header - Premium Glass toolbar */}
        <div className="page-header-glass flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 md:p-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">{t('schedule')}</h1>
            <p className="text-sm text-muted-foreground hidden sm:block mt-0.5">
              Drag unassigned {t('jobs').toLowerCase()} onto the calendar to schedule them
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile: Technician Filter */}
            <div className="lg:hidden">
              <Select
                value={selectedTechnician || "all"}
                onValueChange={(v) => setSelectedTechnician(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[140px] bg-background/80 backdrop-blur-sm touch-native border-border/50">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-xl bg-popover/95">
                  <SelectItem value="all">All Techs</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.user_id} value={tech.user_id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mobile: Unassigned Jobs Sheet */}
            <Sheet open={unassignedSheetOpen} onOpenChange={setUnassignedSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden relative touch-native bg-background/80 backdrop-blur-sm border-border/50">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Unassigned
                  {unassignedCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-[0_2px_8px_-2px_hsl(var(--destructive)/0.5)]">
                      {unassignedCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0 sheet-glass">
                <SheetHeader className="p-4 border-b border-border/30 bg-background/80 backdrop-blur-xl">
                  <SheetTitle>Unassigned {t('jobs')}</SheetTitle>
                </SheetHeader>
                <div className="p-4">
                  <UnassignedJobsSidebar jobs={jobs} />
                </div>
              </SheetContent>
            </Sheet>

            <Button onClick={handleCreateJob} size="sm" className="btn-3d btn-shimmer touch-native">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New {t('job')}</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Sidebar - Technicians (Desktop only) */}
          <div className="hidden lg:block w-64 shrink-0">
            <TechnicianSidebar
              technicians={technicians}
              selectedTechnician={selectedTechnician}
              onSelectTechnician={setSelectedTechnician}
            />
          </div>

          {/* Calendar */}
          <div className="flex-1 min-w-0">
            <CalendarView
              jobs={jobs}
              viewMode={viewMode}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onViewModeChange={setViewMode}
              onJobDrop={handleJobDrop}
              onJobClick={handleJobClick}
              selectedTechnician={selectedTechnician}
            />
          </div>

          {/* Right Sidebar - Unassigned Jobs (Desktop only) */}
          <div className="hidden lg:block w-72 shrink-0">
            <UnassignedJobsSidebar jobs={jobs} />
          </div>
        </div>
      </div>

      <JobFormDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        job={selectedJob as any}
        onSuccess={handleJobSuccess}
      />
    </MainLayout>
  );
}
