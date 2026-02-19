import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw } from 'lucide-react';
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
  FormDescription,
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantSettings } from '@/contexts/TenantContext';
import { useTerminology } from '@/hooks/useTerminology';
import { 
  useCreateRecurringJob, 
  useUpdateRecurringJob,
  RecurringJobTemplate,
  RecurringJobFormData,
  RecurrencePattern,
  RECURRENCE_LABELS,
} from '@/hooks/useRecurringJobs';
import type { Client } from '@/types/database';

const formSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(2000).optional(),
  client_id: z.string().optional(),
  equipment_id: z.string().optional(),
  assigned_to: z.string().optional(),
  job_type: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimated_duration: z.number().min(15).max(480),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  recurrence_pattern: z.enum(['weekly', 'monthly', 'quarterly', 'annually']),
  recurrence_day: z.number().min(0).max(31),
  recurrence_interval: z.number().min(1).max(12),
  next_occurrence: z.date(),
  end_date: z.date().optional(),
  auto_assign: z.boolean(),
  advance_days: z.number().min(1).max(30),
});

type FormValues = z.infer<typeof formSchema>;

interface RecurringJobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: RecurringJobTemplate | null;
  onSuccess?: () => void;
}

export function RecurringJobFormDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: RecurringJobFormDialogProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<{ user_id: string; full_name: string }[]>([]);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  
  const { tenant } = useTenant();
  const settings = useTenantSettings();
  const { t } = useTerminology();
  const createMutation = useCreateRecurringJob();
  const updateMutation = useUpdateRecurringJob();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      client_id: '',
      equipment_id: '',
      assigned_to: '',
      job_type: '',
      priority: 'medium',
      estimated_duration: 60,
      address: '',
      notes: '',
      recurrence_pattern: 'monthly',
      recurrence_day: 1,
      recurrence_interval: 1,
      next_occurrence: new Date(),
      auto_assign: true,
      advance_days: 7,
    },
  });

  const recurrencePattern = form.watch('recurrence_pattern');

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      form.reset({
        title: template.title,
        description: template.description || '',
        client_id: template.client_id || '',
        equipment_id: template.equipment_id || '',
        assigned_to: template.assigned_to || '',
        job_type: template.job_type || '',
        priority: template.priority,
        estimated_duration: template.estimated_duration,
        address: template.address || '',
        notes: template.notes || '',
        recurrence_pattern: template.recurrence_pattern,
        recurrence_day: template.recurrence_day,
        recurrence_interval: template.recurrence_interval,
        next_occurrence: new Date(template.next_occurrence),
        end_date: template.end_date ? new Date(template.end_date) : undefined,
        auto_assign: template.auto_assign,
        advance_days: template.advance_days,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        client_id: '',
        equipment_id: '',
        assigned_to: '',
        job_type: '',
        priority: 'medium',
        estimated_duration: 60,
        address: '',
        notes: '',
        recurrence_pattern: 'monthly',
        recurrence_day: 1,
        recurrence_interval: 1,
        next_occurrence: new Date(),
        auto_assign: true,
        advance_days: 7,
      });
    }
  }, [template, form]);

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
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      if (profiles) {
        setTechnicians(profiles.map(p => ({
          user_id: p.user_id,
          full_name: p.full_name || 'Unknown',
        })));
      }
    }
  };

  const onSubmit = async (values: FormValues) => {
    const formData: RecurringJobFormData = {
      title: values.title,
      description: values.description,
      client_id: values.client_id,
      equipment_id: values.equipment_id,
      assigned_to: values.assigned_to,
      job_type: values.job_type,
      priority: values.priority,
      estimated_duration: values.estimated_duration,
      address: values.address,
      notes: values.notes,
      recurrence_pattern: values.recurrence_pattern,
      recurrence_day: values.recurrence_day,
      recurrence_interval: values.recurrence_interval,
      next_occurrence: values.next_occurrence,
      end_date: values.end_date,
      auto_assign: values.auto_assign,
      advance_days: values.advance_days,
    };

    if (template) {
      await updateMutation.mutateAsync({ id: template.id, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
    onSuccess?.();
    onOpenChange(false);
  };

  const jobTypes = settings?.job_types || ['Service', 'Installation', 'Repair', 'Maintenance'];
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const getDayLabel = () => {
    switch (recurrencePattern) {
      case 'weekly':
        return 'Day of Week (0=Sun, 6=Sat)';
      case 'monthly':
      case 'quarterly':
      case 'annually':
        return 'Day of Month';
      default:
        return 'Day';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            {template ? 'Edit Recurring Job' : 'Create Recurring Job'}
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
                    <Input placeholder="e.g., Monthly HVAC Maintenance" {...field} />
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
                      placeholder="Describe the recurring job..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recurrence Settings */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4 border border-border/50">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Recurrence Schedule
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="recurrence_pattern"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recurrence_interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Every N {recurrencePattern === 'weekly' ? 'weeks' : 'periods'}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={12}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recurrence_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{getDayLabel()}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={recurrencePattern === 'weekly' ? 0 : 1} 
                          max={recurrencePattern === 'weekly' ? 6 : 31}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="next_occurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Occurrence *</FormLabel>
                      <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
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
                              setStartDateOpen(false);
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
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
                              {field.value ? format(field.value, 'PPP') : 'No end date'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setEndDateOpen(false);
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="advance_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Create Job N Days Before</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={30}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                      />
                    </FormControl>
                    <FormDescription>
                      Jobs will be created this many days before the scheduled date
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                    <FormLabel>Default Assignee</FormLabel>
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
                        <SelectTrigger>
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

              {/* Auto Assign */}
              <FormField
                control={form.control}
                name="auto_assign"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Auto-assign</FormLabel>
                      <FormDescription className="text-xs">
                        Assign to default technician
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                  <FormLabel>Service Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, City, State" {...field} />
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
                      placeholder="Additional notes for technicians..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
