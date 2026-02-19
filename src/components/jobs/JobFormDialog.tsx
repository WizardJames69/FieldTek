import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Clock, User, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantSettings } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useTerminology } from '@/hooks/useTerminology';
import { notifyJobAssignment } from '@/lib/pushNotifications';
import type { ScheduledJob, Client, Profile, JobStatus, JobPriority } from '@/types/database';

const jobFormSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(2000).optional(),
  client_id: z.string().optional(),
  assigned_to: z.string().optional(),
  job_type: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']),
  scheduled_date: z.date().optional(),
  scheduled_time: z.string().optional(),
  estimated_duration: z.number().min(15).max(480),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: ScheduledJob | null;
  onSuccess: () => void;
}

export function JobFormDialog({ open, onOpenChange, job, onSuccess }: JobFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; full_name: string; user_id: string }[]>([]);
  const [scheduledDateCalendarOpen, setScheduledDateCalendarOpen] = useState(false);
  
  const { tenant } = useTenant();
  const settings = useTenantSettings();
  const { toast } = useToast();
  const { t } = useTerminology();
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: '',
      description: '',
      client_id: '',
      assigned_to: '',
      job_type: '',
      priority: 'medium',
      status: 'pending',
      estimated_duration: 60,
      address: '',
      notes: '',
    },
  });

  // Reset form when job changes
  useEffect(() => {
    if (job) {
      form.reset({
        title: job.title,
        description: job.description || '',
        client_id: job.client_id || '',
        assigned_to: job.assigned_to || '',
        job_type: job.job_type || '',
        priority: job.priority,
        status: job.status,
        scheduled_date: job.scheduled_date ? new Date(job.scheduled_date) : undefined,
        scheduled_time: job.scheduled_time || '',
        estimated_duration: job.estimated_duration,
        address: job.address || '',
        notes: job.notes || '',
      });
    } else {
      form.reset({
        title: '',
        description: '',
        client_id: '',
        assigned_to: '',
        job_type: '',
        priority: 'medium',
        status: 'pending',
        estimated_duration: 60,
        address: '',
        notes: '',
      });
    }
  }, [job, form]);

  // Fetch clients and technicians
  useEffect(() => {
    if (open && tenant) {
      fetchClients();
      fetchTechnicians();
    }
  }, [open, tenant]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (data) setClients(data as Client[]);
  };

  const fetchTechnicians = async () => {
    const { data: tenantUsers } = await supabase
      .from('tenant_users')
      .select('user_id, role')
      .in('role', ['technician', 'dispatcher', 'admin', 'owner'])
      .eq('is_active', true);

    if (tenantUsers) {
      const userIds = tenantUsers.map(tu => tu.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, user_id')
        .in('user_id', userIds);
      
      if (profiles) {
        setTechnicians(profiles.map(p => ({
          id: p.id,
          full_name: p.full_name || 'Unknown',
          user_id: p.user_id,
        })));
      }
    }
  };

  const onSubmit = async (values: JobFormValues) => {
    if (!tenant) return;
    
    setIsLoading(true);
    try {
      const jobData = {
        tenant_id: tenant.id,
        title: values.title,
        description: values.description || null,
        client_id: values.client_id || null,
        assigned_to: values.assigned_to || null,
        job_type: values.job_type || null,
        priority: values.priority as JobPriority,
        status: values.status as JobStatus,
        scheduled_date: values.scheduled_date ? format(values.scheduled_date, 'yyyy-MM-dd') : null,
        scheduled_time: values.scheduled_time || null,
        estimated_duration: values.estimated_duration,
        address: values.address || null,
        notes: values.notes || null,
      };

      // Track if this is a new assignment
      const previousAssignee = job?.assigned_to;
      const newAssignee = values.assigned_to;
      const isNewAssignment = newAssignee && newAssignee !== previousAssignee;

      let savedJobId = job?.id;

      if (job) {
        // Update existing job
        const { error } = await supabase
          .from('scheduled_jobs')
          .update(jobData)
          .eq('id', job.id);

        if (error) throw error;
        toast({ title: 'Job updated successfully' });
      } else {
        // Create new job
        const { data: newJob, error } = await supabase
          .from('scheduled_jobs')
          .insert(jobData)
          .select('id')
          .single();

        if (error) throw error;
        savedJobId = newJob?.id;
        toast({ title: 'Job created successfully' });
      }

      // Send push notification to newly assigned technician
      if (isNewAssignment && savedJobId) {
        const clientName = clients.find(c => c.id === values.client_id)?.name || 'Unknown Client';
        const scheduledDate = values.scheduled_date 
          ? format(values.scheduled_date, 'MMM d, yyyy')
          : 'Unscheduled';
        
        notifyJobAssignment(newAssignee, tenant.id, {
          jobId: savedJobId,
          jobTitle: values.title,
          clientName,
          scheduledDate,
          address: values.address,
        }).catch(err => console.error('Push notification failed:', err));
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save job',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const jobTypes = settings?.job_types || ['Service', 'Installation', 'Repair', 'Maintenance'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="job-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {job ? `Edit ${t('job')}` : `Create New ${t('job')}`}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('job')} Title *</FormLabel>
                  <FormControl>
                    <Input placeholder={`e.g., ${t('job')} description`} {...field} data-testid="job-form-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the job details..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client */}
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('client')}</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${t('client').toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No {t('client').toLowerCase()}</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assigned To */}
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${t('technician').toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.user_id} value={tech.user_id}>
                            {tech.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Job Type */}
              <FormField
                control={form.control}
                name="job_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('job')} Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(jobTypes as string[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="job-form-priority">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="job-form-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scheduled Date */}
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date</FormLabel>
                    <Popover open={scheduledDateCalendarOpen} onOpenChange={setScheduledDateCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setScheduledDateCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scheduled Time */}
              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estimated Duration */}
              <FormField
                control={form.control}
                name="estimated_duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={15} 
                        max={480}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('job')} Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="123 Main St, City, State ZIP" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes for the technician..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} data-testid="job-form-save">
                {isLoading ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
