import { useState } from 'react';
import {
  Briefcase,
  Search,
  Filter,
  Clock,
  MapPin,
  User,
  Play,
  CheckCircle,
  Square,
  CheckSquare,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';
import { toast } from '@/hooks/use-toast';

export default function DemoJobs() {
  const { getDemoJobs, getDemoClients, demoTeam, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const jobs = getDemoJobs();
  const clients = getDemoClients();

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clients.find(c => c.id === job.client_id)?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedJobData = jobs.find(j => j.id === selectedJob);
  const selectedJobClient = selectedJobData ? clients.find(c => c.id === selectedJobData.client_id) : null;
  const selectedJobTech = selectedJobData ? demoTeam.find(t => t.user_id === selectedJobData.assigned_to) : null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'warning';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'scheduled': return 'bg-yellow-500';
      case 'pending': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const toggleJobSelection = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedJobIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedJobIds.size === filteredJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(filteredJobs.map(j => j.id)));
    }
  };

  const handleBulkAction = (action: string) => {
    toast({
      title: "Demo Mode",
      description: `In the full app, you would ${action} ${selectedJobIds.size} ${t('jobs').toLowerCase()}. Sign up to try it!`,
    });
    setSelectedJobIds(new Set());
  };

  const handleQuickAction = (action: string, jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Demo Mode",
      description: `In the full app, this would ${action} the ${t('job').toLowerCase()}. Sign up to try it!`,
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">{t('jobs')}</h1>
          <p className="text-muted-foreground">Manage and track all {t('jobs').toLowerCase()}</p>
        </div>
        <Button onClick={() => toast({
          title: "Demo Mode",
          description: `In the full app, you would create a new ${t('job').toLowerCase()} here. Sign up to try it!`,
        })}>
          <Briefcase className="h-4 w-4 mr-2" />
          New {t('job')}
        </Button>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedJobIds.size > 0 && (
        <div 
          className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg"
          data-tour="bulk-actions"
        >
          <span className="text-sm font-medium">
            {selectedJobIds.size} selected
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleBulkAction('update status for')}
          >
            Update Status
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleBulkAction('reassign')}
          >
            Reassign
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleBulkAction('export')}
          >
            Export
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => setSelectedJobIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Always-visible bulk actions anchor when no selection */}
      {selectedJobIds.size === 0 && (
        <div 
          className="flex items-center gap-2 p-2 text-xs text-muted-foreground border border-dashed border-muted-foreground/30 rounded-lg"
          data-tour="bulk-actions"
        >
          <CheckSquare className="h-4 w-4" />
          <span>Select {t('jobs').toLowerCase()} using checkboxes for bulk actions</span>
        </div>
      )}

      {/* Filters */}
      <Card data-tour="jobs-filters">
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedJobIds.size === filteredJobs.length && filteredJobs.length > 0}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all jobs"
              />
              <span className="text-sm text-muted-foreground">All</span>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${t('jobs').toLowerCase()} or ${t('clients').toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <div className="space-y-2 md:space-y-3" data-tour="jobs-list">
        {filteredJobs.map(job => {
          const client = clients.find(c => c.id === job.client_id);
          const tech = demoTeam.find(t => t.user_id === job.assigned_to);
          const isSelected = selectedJobIds.has(job.id);

          return (
            <Card
              key={job.id}
              className={`cursor-pointer transition-colors ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              onClick={() => setSelectedJob(job.id)}
            >
              <CardContent className="py-3 md:py-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    {/* Selection Checkbox */}
                    <div className="flex items-center pt-1" onClick={(e) => toggleJobSelection(job.id, e)}>
                      <Checkbox
                        checked={isSelected}
                        aria-label={`Select ${job.title}`}
                      />
                    </div>
                    <div className={`w-1 h-12 sm:h-16 rounded-full flex-shrink-0 ${getStatusColor(job.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="font-semibold text-sm sm:text-base break-words">{job.title}</span>
                        <Badge variant={getPriorityColor(job.priority) as any} className="text-[10px] sm:text-xs flex-shrink-0">
                          {job.priority}
                        </Badge>
                        <Badge variant="outline" className="capitalize text-[10px] sm:text-xs flex-shrink-0">
                          {job.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{client?.name || 'Unknown'}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          {job.scheduled_date} {job.scheduled_time}
                        </span>
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{job.address || client?.address || 'No address'}</span>
                        </span>
                      </div>
                      
                      {/* Quick Actions Strip */}
                      <div 
                        className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50"
                        data-tour="job-quick-actions"
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => handleQuickAction('start', job.id, e)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => handleQuickAction('complete', job.id, e)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right pl-3 sm:pl-0 border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0 sm:flex-shrink-0">
                    <p className="text-xs sm:text-sm font-medium">{tech?.name || 'Unassigned'}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{job.job_type}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Job Detail Sheet */}
      <Sheet open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedJobData && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedJobData.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex gap-2">
                  <Badge variant={getPriorityColor(selectedJobData.priority) as any}>
                    {selectedJobData.priority}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {selectedJobData.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="secondary">{selectedJobData.job_type}</Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Client</h4>
                    <p className="font-medium">{selectedJobClient?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedJobClient?.phone}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Address</h4>
                    <p>{selectedJobData.address || selectedJobClient?.address}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Scheduled</h4>
                    <p>{selectedJobData.scheduled_date} at {selectedJobData.scheduled_time}</p>
                    <p className="text-sm text-muted-foreground">
                      Est. {selectedJobData.estimated_duration} minutes
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Assigned To</h4>
                    <p>{selectedJobTech?.name || 'Unassigned'}</p>
                  </div>

                  {selectedJobData.description && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                      <p className="text-sm">{selectedJobData.description}</p>
                    </div>
                  )}

                  {selectedJobData.notes && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Notes</h4>
                      <p className="text-sm">{selectedJobData.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: "In the full app, you can update job status, add notes, and track progress. Sign up to try it!",
                  })}>Update Status</Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast({
                    title: "Demo Mode",
                    description: "In the full app, you can edit all job details and reassign technicians. Sign up to try it!",
                  })}>Edit {t('job')}</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
