import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Clipboard, 
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Pencil
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/useTerminology';
import type { Client, ScheduledJob, Equipment, JobStatus, JobPriority } from '@/types/database';

interface ClientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onEdit: () => void;
}

export function ClientDetailSheet({ open, onOpenChange, client, onEdit }: ClientDetailSheetProps) {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTerminology();
  useEffect(() => {
    if (open && client) {
      fetchClientData();
    }
  }, [open, client]);

  const fetchClientData = async () => {
    if (!client) return;
    
    setLoading(true);
    try {
      const [jobsResult, equipmentResult] = await Promise.all([
        supabase
          .from('scheduled_jobs')
          .select('*')
          .eq('client_id', client.id)
          .order('scheduled_date', { ascending: false })
          .limit(20),
        supabase
          .from('equipment_registry')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }),
      ]);

      setJobs((jobsResult.data as ScheduledJob[]) || []);
      setEquipment((equipmentResult.data as Equipment[]) || []);
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-3 w-3" />;
      case 'in_progress': return <Clock className="h-3 w-3" />;
      default: return null;
    }
  };

  const jobStats = {
    total: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    inProgress: jobs.filter(j => j.status === 'in_progress').length,
    pending: jobs.filter(j => j.status === 'pending' || j.status === 'scheduled').length,
  };

  if (!client) return null;

  const fullAddress = [client.address, client.city, client.state, client.zip_code]
    .filter(Boolean)
    .join(', ');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl font-display">{client.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {t('client')} since {format(new Date(client.created_at), 'MMM yyyy')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </SheetHeader>

        {/* Contact Info */}
        <div className="space-y-3 mb-6">
          {client.email && (
            <a 
              href={`mailto:${client.email}`}
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span>{client.email}</span>
            </a>
          )}
          {client.phone && (
            <a 
              href={`tel:${client.phone}`}
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span>{client.phone}</span>
            </a>
          )}
          {fullAddress && (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5" />
              <span>{fullAddress}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="app-glass-container rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{jobStats.total}</p>
            <p className="text-xs text-muted-foreground">Total {t('jobs')}</p>
          </div>
          <div className="app-glass-container rounded-lg p-3 text-center bg-success/10">
            <p className="text-2xl font-bold text-success">{jobStats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="app-glass-container rounded-lg p-3 text-center bg-warning/10">
            <p className="text-2xl font-bold text-warning">{jobStats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="app-glass-container rounded-lg p-3 text-center bg-info/10">
            <p className="text-2xl font-bold text-info">{equipment.length}</p>
            <p className="text-xs text-muted-foreground">{t('equipment')}</p>
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Tabs */}
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="jobs" className="gap-1.5">
              <Clipboard className="h-4 w-4" />
              {t('jobs')}
            </TabsTrigger>
            <TabsTrigger value="equipment" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              {t('equipment')}
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              Notes
            </TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Clipboard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No service history yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <Card key={job.id} className="card-hover-depth transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{job.title}</h4>
                            <Badge className={cn('text-xs gap-1', getStatusBadge(job.status))}>
                              {getStatusIcon(job.status)}
                              {job.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {job.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                              {job.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {job.scheduled_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                              </span>
                            )}
                            {job.job_type && (
                              <span className="bg-muted px-2 py-0.5 rounded">{job.job_type}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : equipment.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No {t('equipment').toLowerCase()} registered</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {equipment.map((eq) => (
                  <Card key={eq.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{eq.equipment_type}</h4>
                            <Badge variant="outline" className="text-xs">
                              {eq.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {eq.brand && <span>Brand: {eq.brand}</span>}
                            {eq.model && <span>Model: {eq.model}</span>}
                            {eq.serial_number && <span>S/N: {eq.serial_number}</span>}
                            {eq.warranty_expiry && (
                              <span className={cn(
                                new Date(eq.warranty_expiry) < new Date() && 'text-destructive'
                              )}>
                                Warranty: {format(new Date(eq.warranty_expiry), 'MMM yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardContent className="p-4">
                {client.notes ? (
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No notes for this {t('client').toLowerCase()}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
