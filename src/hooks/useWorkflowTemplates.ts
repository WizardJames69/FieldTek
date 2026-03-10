import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { Json } from '@/integrations/supabase/types';

// ── Types ──────────────────────────────────────────────────────────────

export type TemplateCategory = 'installation' | 'repair' | 'maintenance' | 'inspection' | 'diagnostic';
export type StepType = 'action' | 'inspection' | 'measurement' | 'decision';
export type StageName = 'Startup' | 'Service' | 'Maintenance' | 'Inspection';

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'installation', label: 'Installation' },
  { value: 'repair', label: 'Repair' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'diagnostic', label: 'Diagnostic' },
];

export const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'decision', label: 'Decision' },
];

export const STAGE_NAMES: StageName[] = ['Startup', 'Service', 'Maintenance', 'Inspection'];

export interface EvidenceRequirements {
  photo?: boolean;
  measurement?: boolean;
  gps_required?: boolean;
  serial_scan?: boolean;
}

export interface ValidationRules {
  measurement_min?: number;
  measurement_max?: number;
  required_photos_count?: number;
}

export interface RequiredInputs {
  measurement_unit?: string;
  serial_scan?: boolean;
  text_input?: boolean;
}

export interface WorkflowTemplateStep {
  id: string;
  workflow_id: string;
  step_number: number;
  stage_name: StageName;
  title: string;
  instruction: string;
  instruction_detail: string | null;
  media_urls: string[] | null;
  step_type: StepType;
  required_inputs: RequiredInputs;
  evidence_requirements: EvidenceRequirements;
  validation_rules: ValidationRules;
  estimated_minutes: number | null;
  safety_warning: string | null;
  created_at: string;
}

export interface WorkflowTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  equipment_type: string | null;
  equipment_model: string | null;
  source: string;
  is_active: boolean;
  is_published: boolean;
  estimated_duration_minutes: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateWithSteps extends WorkflowTemplate {
  workflow_template_steps: WorkflowTemplateStep[];
}

// ── Hooks ──────────────────────────────────────────────────────────────

const QUERY_KEY = 'workflow-templates';

export function useWorkflowTemplates() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: [QUERY_KEY, tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*, workflow_template_steps(count)')
        .eq('tenant_id', tenant.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as (WorkflowTemplate & { workflow_template_steps: { count: number }[] })[];
    },
    enabled: !!tenant?.id,
  });
}

export function useWorkflowTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*, workflow_template_steps(*)')
        .eq('id', templateId)
        .single();
      if (error) throw error;

      // Sort steps by step_number
      const template = data as unknown as WorkflowTemplateWithSteps;
      template.workflow_template_steps.sort((a, b) => a.step_number - b.step_number);
      return template;
    },
    enabled: !!templateId,
  });
}

export function useCreateWorkflowTemplate() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      category: TemplateCategory;
      equipment_type?: string;
      equipment_model?: string;
      estimated_duration_minutes?: number;
    }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('workflow_templates')
        .insert({
          tenant_id: tenant.id,
          name: params.name,
          description: params.description || null,
          category: params.category,
          equipment_type: params.equipment_type || null,
          equipment_model: params.equipment_model || null,
          estimated_duration_minutes: params.estimated_duration_minutes || null,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkflowTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateWorkflowTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      description?: string | null;
      category?: TemplateCategory;
      equipment_type?: string | null;
      equipment_model?: string | null;
      estimated_duration_minutes?: number | null;
      is_active?: boolean;
      is_published?: boolean;
    }) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from('workflow_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkflowTemplate;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', variables.id] });
    },
  });
}

export function useDeleteWorkflowTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workflow_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ── Step mutations ─────────────────────────────────────────────────────

export function useSaveWorkflowSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      workflowId: string;
      steps: Omit<WorkflowTemplateStep, 'id' | 'workflow_id' | 'created_at'>[];
    }) => {
      const { workflowId, steps } = params;

      // Delete existing steps and re-insert (simplest for reordering)
      const { error: deleteError } = await supabase
        .from('workflow_template_steps')
        .delete()
        .eq('workflow_id', workflowId);
      if (deleteError) throw deleteError;

      if (steps.length === 0) return [];

      const rows = steps.map((step, idx) => ({
        workflow_id: workflowId,
        step_number: idx + 1,
        stage_name: step.stage_name,
        title: step.title,
        instruction: step.instruction,
        instruction_detail: step.instruction_detail || null,
        media_urls: step.media_urls || null,
        step_type: step.step_type,
        required_inputs: (step.required_inputs || {}) as unknown as Json,
        evidence_requirements: (step.evidence_requirements || {}) as unknown as Json,
        validation_rules: (step.validation_rules || {}) as unknown as Json,
        estimated_minutes: step.estimated_minutes || null,
        safety_warning: step.safety_warning || null,
      }));

      const { data, error } = await supabase
        .from('workflow_template_steps')
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', variables.workflowId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDuplicateWorkflowTemplate() {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch source template with steps
      const { data: source, error: fetchError } = await supabase
        .from('workflow_templates')
        .select('*, workflow_template_steps(*)')
        .eq('id', sourceId)
        .single();
      if (fetchError) throw fetchError;

      const src = source as unknown as WorkflowTemplateWithSteps;

      // Create new template
      const { data: newTemplate, error: createError } = await supabase
        .from('workflow_templates')
        .insert({
          tenant_id: tenant.id,
          name: `${src.name} (Copy)`,
          description: src.description,
          category: src.category,
          equipment_type: src.equipment_type,
          equipment_model: src.equipment_model,
          estimated_duration_minutes: src.estimated_duration_minutes,
          created_by: user?.id || null,
          is_published: false,
        })
        .select()
        .single();
      if (createError) throw createError;

      // Copy steps
      if (src.workflow_template_steps.length > 0) {
        const stepRows = src.workflow_template_steps.map((s) => ({
          workflow_id: newTemplate.id,
          step_number: s.step_number,
          stage_name: s.stage_name,
          title: s.title,
          instruction: s.instruction,
          instruction_detail: s.instruction_detail,
          media_urls: s.media_urls,
          step_type: s.step_type,
          required_inputs: s.required_inputs as unknown as Json,
          evidence_requirements: s.evidence_requirements as unknown as Json,
          validation_rules: s.validation_rules as unknown as Json,
          estimated_minutes: s.estimated_minutes,
          safety_warning: s.safety_warning,
        }));

        const { error: stepsError } = await supabase
          .from('workflow_template_steps')
          .insert(stepRows);
        if (stepsError) throw stepsError;
      }

      return newTemplate as WorkflowTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
