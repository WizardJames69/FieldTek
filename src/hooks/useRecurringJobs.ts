import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import type { JobPriority } from '@/types/database';

export type RecurrencePattern = 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface RecurringJobTemplate {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  equipment_id: string | null;
  assigned_to: string | null;
  job_type: string | null;
  priority: JobPriority;
  estimated_duration: number;
  address: string | null;
  notes: string | null;
  recurrence_pattern: RecurrencePattern;
  recurrence_day: number;
  recurrence_interval: number;
  next_occurrence: string;
  end_date: string | null;
  is_active: boolean;
  auto_assign: boolean;
  advance_days: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  clients?: { id: string; name: string } | null;
  equipment_registry?: { id: string; equipment_type: string; brand: string | null } | null;
  profiles?: { user_id: string; full_name: string | null } | null;
}

export interface RecurringJobFormData {
  title: string;
  description?: string;
  client_id?: string;
  equipment_id?: string;
  assigned_to?: string;
  job_type?: string;
  priority: JobPriority;
  estimated_duration: number;
  address?: string;
  notes?: string;
  recurrence_pattern: RecurrencePattern;
  recurrence_day: number;
  recurrence_interval: number;
  next_occurrence: Date;
  end_date?: Date;
  auto_assign: boolean;
  advance_days: number;
}

export const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export function getRecurrenceDescription(template: RecurringJobTemplate): string {
  const { recurrence_pattern, recurrence_day, recurrence_interval } = template;
  
  switch (recurrence_pattern) {
    case 'weekly': {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[recurrence_day] || 'day';
      return recurrence_interval === 1 
        ? `Every ${dayName}`
        : `Every ${recurrence_interval} weeks on ${dayName}`;
    }
    case 'monthly':
      return recurrence_interval === 1 
        ? `Monthly on day ${recurrence_day}`
        : `Every ${recurrence_interval} months on day ${recurrence_day}`;
    case 'quarterly':
      return `Every quarter on day ${recurrence_day}`;
    case 'annually':
      return `Annually on day ${recurrence_day}`;
    default:
      return recurrence_pattern;
  }
}

export function useRecurringJobs() {
  const { tenant } = useTenant();
  
  return useQuery({
    queryKey: ['recurring-jobs', tenant?.id],
    queryFn: async () => {
      if (!tenant) return [];
      
      const { data, error } = await supabase
        .from('recurring_job_templates')
        .select(`
          *,
          clients:client_id (id, name),
          equipment_registry:equipment_id (id, equipment_type, brand)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles for assigned users
      const assignedUserIds = (data || [])
        .filter(t => t.assigned_to)
        .map(t => t.assigned_to as string);
      
      let profilesMap: Record<string, { user_id: string; full_name: string | null }> = {};
      
      if (assignedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', assignedUserIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p;
            return acc;
          }, {} as typeof profilesMap);
        }
      }
      
      return (data || []).map(template => ({
        ...template,
        profiles: template.assigned_to ? profilesMap[template.assigned_to] || null : null,
      })) as RecurringJobTemplate[];
    },
    enabled: !!tenant,
  });
}

export function useActiveRecurringJobsCount() {
  const { data: templates } = useRecurringJobs();
  return templates?.filter(t => t.is_active).length || 0;
}

export function useCreateRecurringJob() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: RecurringJobFormData) => {
      if (!tenant) throw new Error('No tenant');
      
      const { data: session } = await supabase.auth.getSession();
      
      const { data: template, error } = await supabase
        .from('recurring_job_templates')
        .insert({
          tenant_id: tenant.id,
          title: data.title,
          description: data.description || null,
          client_id: data.client_id || null,
          equipment_id: data.equipment_id || null,
          assigned_to: data.assigned_to || null,
          job_type: data.job_type || null,
          priority: data.priority,
          estimated_duration: data.estimated_duration,
          address: data.address || null,
          notes: data.notes || null,
          recurrence_pattern: data.recurrence_pattern,
          recurrence_day: data.recurrence_day,
          recurrence_interval: data.recurrence_interval,
          next_occurrence: data.next_occurrence.toISOString().split('T')[0],
          end_date: data.end_date ? data.end_date.toISOString().split('T')[0] : null,
          auto_assign: data.auto_assign,
          advance_days: data.advance_days,
          created_by: session?.session?.user?.id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-jobs'] });
      toast({ title: 'Recurring job template created' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error creating template',
        description: error.message,
      });
    },
  });
}

export function useUpdateRecurringJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RecurringJobFormData> & { is_active?: boolean } }) => {
      const updateData: Record<string, unknown> = {};
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.client_id !== undefined) updateData.client_id = data.client_id || null;
      if (data.equipment_id !== undefined) updateData.equipment_id = data.equipment_id || null;
      if (data.assigned_to !== undefined) updateData.assigned_to = data.assigned_to || null;
      if (data.job_type !== undefined) updateData.job_type = data.job_type || null;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.estimated_duration !== undefined) updateData.estimated_duration = data.estimated_duration;
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.recurrence_pattern !== undefined) updateData.recurrence_pattern = data.recurrence_pattern;
      if (data.recurrence_day !== undefined) updateData.recurrence_day = data.recurrence_day;
      if (data.recurrence_interval !== undefined) updateData.recurrence_interval = data.recurrence_interval;
      if (data.next_occurrence !== undefined) updateData.next_occurrence = data.next_occurrence.toISOString().split('T')[0];
      if (data.end_date !== undefined) updateData.end_date = data.end_date ? data.end_date.toISOString().split('T')[0] : null;
      if (data.auto_assign !== undefined) updateData.auto_assign = data.auto_assign;
      if (data.advance_days !== undefined) updateData.advance_days = data.advance_days;
      
      const { error } = await supabase
        .from('recurring_job_templates')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-jobs'] });
      toast({ title: 'Recurring job template updated' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating template',
        description: error.message,
      });
    },
  });
}

export function useToggleRecurringJobActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('recurring_job_templates')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-jobs'] });
      toast({ title: is_active ? 'Template activated' : 'Template paused' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating template',
        description: error.message,
      });
    },
  });
}

export function useDeleteRecurringJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_job_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-jobs'] });
      toast({ title: 'Recurring job template deleted' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error deleting template',
        description: error.message,
      });
    },
  });
}
