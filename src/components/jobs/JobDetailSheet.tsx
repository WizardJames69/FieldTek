import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  Play,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import { CustomerEquipmentHistory } from '@/components/equipment/CustomerEquipmentHistory';
import { JobStageWorkflow } from '@/components/jobs/JobStageWorkflow';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/useTerminology';
import { useUserRole } from '@/contexts/TenantContext';

interface Job {
  id: string;
  title: string;
  description: string | null;
  job_type: string | null;
  status: string | null;
  priority: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  address: string | null;
  notes: string | null;
  internal_notes: string | null;
  workflow_stage?: string | null;
  client_id: string | null;
  clients?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  profiles?: {
    full_name: string | null;
    phone?: string | null;
  } | null;
}

interface JobDetailSheetProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onStatusChange?: (jobId: string, status: string) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground', icon: Clock },
  scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-700', icon: Calendar },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-700', icon: Play },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-700', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/20 text-destructive', icon: AlertTriangle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', color: 'bg-primary/20 text-primary' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-700' },
  urgent: { label: 'Urgent', color: 'bg-destructive/20 text-destructive' },
};

export function JobDetailSheet({
  job,
  open,
  onOpenChange,
  onEdit,
  onStatusChange,
}: JobDetailSheetProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const { t } = useTerminology();
  const { role } = useUserRole();
  if (!job) return null;

  const status = statusConfig[job.status || 'pending'];
  const priority = priorityConfig[job.priority || 'medium'];
  const StatusIcon = status.icon;

  const canStart = job.status === 'pending' || job.status === 'scheduled';
  const canComplete = job.status === 'in_progress';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 sheet-glass">
        <ScrollArea className="h-full">
          {/* Phase 6: Glass header section */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30">
            <div className="p-6 pb-4">
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <SheetTitle className="text-xl leading-tight">{job.title}</SheetTitle>
                    {job.job_type && (
                      <Badge variant="outline" className="mt-2 text-xs bg-background/50">
                        {job.job_type}
                      </Badge>
                    )}
                  </div>
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 touch-native bg-background/50 hover:bg-background/80">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
              </SheetHeader>

              {/* Status & Priority badges */}
              <div className="flex items-center gap-2 mt-4">
                <Badge className={cn('flex items-center gap-1', status.color)} glow>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
                <Badge variant="secondary" className={priority.color}>
                  {priority.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-6 pt-4 space-y-6">
              {/* Quick Actions with enhanced styling */}
              {onStatusChange && (canStart || canComplete) && (
                <div className="flex gap-2">
                  {canStart && (
                    <Button
                      className="flex-1 gap-2 btn-shimmer touch-native"
                      onClick={() => onStatusChange(job.id, 'in_progress')}
                    >
                      <Play className="h-4 w-4" />
                      Start {t('job')}
                    </Button>
                  )}
                  {canComplete && (
                    <Button
                      className="flex-1 gap-2 btn-shimmer touch-native"
                      onClick={() => onStatusChange(job.id, 'completed')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete {t('job')}
                    </Button>
                  )}
                </div>
              )}
              
              {/* Section divider */}
              <div className="section-divider" />

              {/* Schedule Info */}
              <div className="grid grid-cols-2 gap-4">
                {job.scheduled_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Date</p>
                      <p className="font-medium">
                        {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}
                {job.scheduled_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Time</p>
                      <p className="font-medium">{job.scheduled_time.slice(0, 5)}</p>
                    </div>
                  </div>
                )}
                {job.estimated_duration && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Duration</p>
                      <p className="font-medium">{job.estimated_duration} min</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Address */}
              {job.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Location</p>
                    <p className="font-medium">{job.address}</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      asChild
                    >
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Maps
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              <div className="section-divider" />

              {/* Client Info */}
              {job.clients && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">{t('client')}</h4>
                  <Card className="app-glass-container">
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium">{job.clients.name}</p>
                      {job.clients.email && role !== 'technician' && (
                        <a
                          href={`mailto:${job.clients.email}`}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {job.clients.email}
                        </a>
                      )}
                      {job.clients.phone && (
                        <a
                          href={`tel:${job.clients.phone}`}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {job.clients.phone}
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Customer Equipment History */}
              {job.client_id && (
                <CustomerEquipmentHistory
                  clientId={job.client_id}
                  clientName={job.clients?.name}
                />
              )}

              <div className="section-divider" />

              {/* Description */}
              {job.description && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {job.description}
                  </p>
                </div>
              )}

              {/* Notes */}
              {job.notes && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {job.notes}
                  </p>
                </div>
              )}

              {/* Internal Notes */}
              {job.internal_notes && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Internal Notes
                  </h4>
                  <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                    <CardContent className="p-3">
                      <p className="text-sm whitespace-pre-wrap">{job.internal_notes}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Job Workflow Checklist with enhanced styling */}
              {job.status === 'in_progress' && (
                <>
                  <div className="section-divider" />
                  <div>
                    <Button
                      variant="outline"
                      className="w-full mb-3 touch-native bg-background/50 hover:bg-background/80"
                      onClick={() => setShowChecklist(!showChecklist)}
                    >
                      {showChecklist ? 'Hide Checklist' : `Show ${t('job')} Checklist`}
                    </Button>
                    {showChecklist && (
                      <JobStageWorkflow
                        jobId={job.id}
                        jobType={job.job_type || undefined}
                        currentStage={job.workflow_stage || undefined}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
