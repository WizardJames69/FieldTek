import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface OnboardingProgress {
  id: string;
  tenant_id: string;
  company_info_completed: boolean;
  branding_completed: boolean;
  first_team_member_invited: boolean;
  first_client_added: boolean;
  first_job_created: boolean;
  first_invoice_created: boolean;
  first_document_uploaded: boolean;
  first_service_request_received: boolean;
  stripe_connect_completed: boolean;
  payment_method_added: boolean;
  onboarding_completed: boolean;
}

export function useOnboardingProgress() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: progress, isLoading } = useQuery({
    queryKey: ['onboarding-progress', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching onboarding progress:', error);
        return null;
      }

      return data as OnboardingProgress;
    },
    enabled: !!tenant?.id,
  });

  const updateProgress = useMutation({
    mutationFn: async (updates: Partial<OnboardingProgress>) => {
      if (!tenant?.id) throw new Error('No tenant');

      const timestampUpdates: Record<string, any> = { ...updates };
      
      // Add timestamps for completed items
      Object.keys(updates).forEach(key => {
        if (key.endsWith('_completed') || key.startsWith('first_')) {
          const value = updates[key as keyof OnboardingProgress];
          if (value === true) {
            const timestampKey = key.replace('_completed', '_completed_at').replace('first_', 'first_') + (key.startsWith('first_') ? '_at' : '');
            if (!timestampKey.endsWith('_at_at')) {
              timestampUpdates[key.endsWith('_completed') ? key + '_at' : key + '_at'] = new Date().toISOString();
            }
          }
        }
      });

      const { error } = await supabase
        .from('onboarding_progress')
        .update(timestampUpdates)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', tenant?.id] });
    },
  });

  // Calculate completion percentage
  const steps = progress ? getStepsArray(progress) : [];
  const completionPercentage = progress ? calculateCompletion(progress) : 0;
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = steps.length || 9; // 9 actual milestones

  return {
    progress,
    isLoading,
    updateProgress: updateProgress.mutate,
    completionPercentage,
    completedSteps,
    totalSteps,
    isComplete: progress?.onboarding_completed ?? false,
  };
}

function getStepsArray(progress: OnboardingProgress): boolean[] {
  return [
    progress.company_info_completed,
    progress.branding_completed,
    progress.first_client_added,
    progress.first_job_created,
    progress.first_invoice_created,
    progress.first_team_member_invited,
    progress.first_document_uploaded,
    progress.first_service_request_received,
    progress.stripe_connect_completed,
  ];
}

function calculateCompletion(progress: OnboardingProgress): number {
  const steps = getStepsArray(progress);
  const completed = steps.filter(Boolean).length;
  return Math.round((completed / steps.length) * 100);
}
