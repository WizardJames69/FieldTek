import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type {
  WorkflowTemplateStep,
  EvidenceRequirements,
  ValidationRules,
  RequiredInputs,
  StepType,
  StageName,
} from './useWorkflowTemplates';

// ── Types ──────────────────────────────────────────────────────────────

export type ExecutionStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'aborted';
export type StepExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface WorkflowExecution {
  id: string;
  tenant_id: string;
  workflow_id: string;
  job_id: string;
  technician_id: string;
  status: ExecutionStatus;
  current_step_number: number;
  started_at: string | null;
  completed_at: string | null;
  abort_reason: string | null;
  created_at: string;
}

export interface WorkflowStepExecution {
  id: string;
  execution_id: string;
  step_id: string;
  step_number: number;
  status: StepExecutionStatus;
  technician_notes: string | null;
  measurement_value: number | null;
  measurement_unit: string | null;
  serial_number: string | null;
  photos: string[] | null;
  gps_location: Record<string, unknown> | null;
  custom_inputs: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  skipped_reason: string | null;
  created_at: string;
}

export interface EnrichedStep {
  templateStep: WorkflowTemplateStep;
  stepExecution: WorkflowStepExecution;
}

export interface WorkflowExecutionData {
  execution: WorkflowExecution;
  steps: EnrichedStep[];
  templateName: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: EnrichedStep | null;
}

export interface StepCompletionData {
  technician_notes?: string;
  measurement_value?: number;
  measurement_unit?: string;
  serial_number?: string;
  photos?: string[];
  gps_location?: Record<string, unknown>;
  custom_inputs?: Record<string, unknown>;
}

// ── Query Key ──────────────────────────────────────────────────────────

const EXEC_KEY = 'workflow-execution';

// ── Hook: Fetch execution data ─────────────────────────────────────────

export function useWorkflowExecution(executionId: string | null | undefined) {
  return useQuery({
    queryKey: [EXEC_KEY, executionId],
    queryFn: async (): Promise<WorkflowExecutionData | null> => {
      if (!executionId) return null;

      // Fetch execution
      const { data: exec, error: execErr } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('id', executionId)
        .single();
      if (execErr) throw execErr;

      const execution = exec as unknown as WorkflowExecution;

      // Fetch template name
      const { data: tmpl, error: tmplErr } = await supabase
        .from('workflow_templates')
        .select('name')
        .eq('id', execution.workflow_id)
        .single();
      if (tmplErr) throw tmplErr;

      // Fetch template steps
      const { data: templateSteps, error: tsErr } = await supabase
        .from('workflow_template_steps')
        .select('*')
        .eq('workflow_id', execution.workflow_id)
        .order('step_number', { ascending: true });
      if (tsErr) throw tsErr;

      // Fetch step executions
      const { data: stepExecs, error: seErr } = await supabase
        .from('workflow_step_executions')
        .select('*')
        .eq('execution_id', executionId)
        .order('step_number', { ascending: true });
      if (seErr) throw seErr;

      const typedTemplateSteps = (templateSteps ?? []) as unknown as WorkflowTemplateStep[];
      const typedStepExecs = (stepExecs ?? []) as unknown as WorkflowStepExecution[];

      // Merge template steps with step executions
      const steps: EnrichedStep[] = typedTemplateSteps.map((ts) => {
        const se = typedStepExecs.find((e) => e.step_id === ts.id);
        return {
          templateStep: ts,
          stepExecution: se!,
        };
      }).filter((s) => s.stepExecution);

      const completedSteps = steps.filter(
        (s) => s.stepExecution.status === 'completed' || s.stepExecution.status === 'skipped'
      ).length;

      const currentStep = steps.find(
        (s) => s.stepExecution.step_number === execution.current_step_number
      ) ?? null;

      return {
        execution,
        steps,
        templateName: tmpl.name,
        totalSteps: steps.length,
        completedSteps,
        currentStep,
      };
    },
    enabled: !!executionId,
    staleTime: 10_000,
  });
}

// ── Hook: Start execution ──────────────────────────────────────────────

export function useStartExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      jobId: string;
      workflowId: string;
      technicianId: string;
      tenantId: string;
    }) => {
      const { jobId, workflowId, technicianId, tenantId } = params;

      // Fetch template steps
      const { data: templateSteps, error: tsErr } = await supabase
        .from('workflow_template_steps')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('step_number', { ascending: true });
      if (tsErr) throw tsErr;
      if (!templateSteps || templateSteps.length === 0) {
        throw new Error('Template has no steps');
      }

      // Create execution
      const now = new Date().toISOString();
      const { data: exec, error: execErr } = await supabase
        .from('workflow_executions')
        .insert({
          tenant_id: tenantId,
          workflow_id: workflowId,
          job_id: jobId,
          technician_id: technicianId,
          status: 'in_progress',
          current_step_number: 1,
          started_at: now,
        })
        .select()
        .single();
      if (execErr) throw execErr;

      // Create step executions
      const stepRows = templateSteps.map((ts, idx) => ({
        execution_id: exec.id,
        step_id: ts.id,
        step_number: idx + 1,
        status: idx === 0 ? 'in_progress' : 'pending',
        started_at: idx === 0 ? now : null,
        custom_inputs: {},
      }));

      const { error: seErr } = await supabase
        .from('workflow_step_executions')
        .insert(stepRows);
      if (seErr) throw seErr;

      // Link execution to job
      const { error: jobErr } = await supabase
        .from('scheduled_jobs')
        .update({ workflow_execution_id: exec.id })
        .eq('id', jobId);
      if (jobErr) throw jobErr;

      return { executionId: exec.id as string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXEC_KEY] });
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
    },
  });
}

// ── Hook: Advance step (with concurrency guard) ────────────────────────

export function useAdvanceStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      executionId: string;
      stepExecutionId: string;
      data?: StepCompletionData;
    }) => {
      const { executionId, stepExecutionId, data } = params;
      const now = new Date().toISOString();

      // Concurrency guard: only complete if in_progress and belongs to this execution
      const { data: updated, error: updateErr } = await supabase
        .from('workflow_step_executions')
        .update({
          status: 'completed',
          completed_at: now,
          technician_notes: data?.technician_notes ?? null,
          measurement_value: data?.measurement_value ?? null,
          measurement_unit: data?.measurement_unit ?? null,
          serial_number: data?.serial_number ?? null,
          photos: data?.photos ?? null,
          gps_location: data?.gps_location ?? null,
          custom_inputs: data?.custom_inputs ?? {},
        })
        .eq('id', stepExecutionId)
        .eq('execution_id', executionId)
        .eq('status', 'in_progress')
        .select();
      if (updateErr) throw updateErr;
      if (!updated || updated.length === 0) {
        throw new Error('Step already completed or not in progress');
      }

      const completedStep = updated[0] as unknown as WorkflowStepExecution;
      const nextStepNumber = completedStep.step_number + 1;

      // Try to start the next step
      const { data: nextStep } = await supabase
        .from('workflow_step_executions')
        .update({ status: 'in_progress', started_at: now })
        .eq('execution_id', executionId)
        .eq('step_number', nextStepNumber)
        .eq('status', 'pending')
        .select();

      // Update execution's current_step_number (guarded by status)
      const newStepNumber = nextStep && nextStep.length > 0
        ? nextStepNumber
        : completedStep.step_number;

      const { data: execUpdated, error: execErr } = await supabase
        .from('workflow_executions')
        .update({ current_step_number: newStepNumber })
        .eq('id', executionId)
        .eq('status', 'in_progress')
        .select();
      if (execErr) throw execErr;
      if (!execUpdated || execUpdated.length === 0) {
        throw new Error('Execution is no longer active');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXEC_KEY, variables.executionId] });
    },
  });
}

// ── Hook: Skip step ────────────────────────────────────────────────────

export function useSkipStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      executionId: string;
      stepExecutionId: string;
      reason: string;
    }) => {
      const { executionId, stepExecutionId, reason } = params;
      const now = new Date().toISOString();

      // Concurrency guard: only skip if in_progress and belongs to this execution
      const { data: updated, error: updateErr } = await supabase
        .from('workflow_step_executions')
        .update({
          status: 'skipped',
          completed_at: now,
          skipped_reason: reason,
        })
        .eq('id', stepExecutionId)
        .eq('execution_id', executionId)
        .eq('status', 'in_progress')
        .select();
      if (updateErr) throw updateErr;
      if (!updated || updated.length === 0) {
        throw new Error('Step already completed or not in progress');
      }

      const skippedStep = updated[0] as unknown as WorkflowStepExecution;
      const nextStepNumber = skippedStep.step_number + 1;

      // Start next step
      const { data: nextStep } = await supabase
        .from('workflow_step_executions')
        .update({ status: 'in_progress', started_at: now })
        .eq('execution_id', executionId)
        .eq('step_number', nextStepNumber)
        .eq('status', 'pending')
        .select();

      // Update execution's current_step_number (guarded by status)
      const newStepNumber = nextStep && nextStep.length > 0
        ? nextStepNumber
        : skippedStep.step_number;

      const { data: execUpdated, error: execErr } = await supabase
        .from('workflow_executions')
        .update({ current_step_number: newStepNumber })
        .eq('id', executionId)
        .eq('status', 'in_progress')
        .select();
      if (execErr) throw execErr;
      if (!execUpdated || execUpdated.length === 0) {
        throw new Error('Execution is no longer active');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXEC_KEY, variables.executionId] });
    },
  });
}

// ── Hook: Complete execution ───────────────────────────────────────────

export function useCompleteExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { executionId: string }) => {
      const { executionId } = params;

      // Verify all steps are completed or skipped
      const { data: pending, error: checkErr } = await supabase
        .from('workflow_step_executions')
        .select('id')
        .eq('execution_id', executionId)
        .in('status', ['pending', 'in_progress']);
      if (checkErr) throw checkErr;
      if (pending && pending.length > 0) {
        throw new Error('Not all steps are completed');
      }

      const { data: execUpdated, error } = await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionId)
        .eq('status', 'in_progress')
        .select();
      if (error) throw error;
      if (!execUpdated || execUpdated.length === 0) {
        throw new Error('Execution is no longer active');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXEC_KEY, variables.executionId] });
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
    },
  });
}

// ── Hook: Abort execution ──────────────────────────────────────────────

export function useAbortExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { executionId: string; reason: string }) => {
      const { executionId, reason } = params;

      const { data: execUpdated, error } = await supabase
        .from('workflow_executions')
        .update({
          status: 'aborted',
          abort_reason: reason,
        })
        .eq('id', executionId)
        .eq('status', 'in_progress')
        .select();
      if (error) throw error;
      if (!execUpdated || execUpdated.length === 0) {
        throw new Error('Execution is not active');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EXEC_KEY, variables.executionId] });
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
    },
  });
}

// ── Hook: Fetch published templates for assignment ─────────────────────

export function usePublishedTemplates(equipmentType?: string | null) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['workflow-templates', 'published', tenant?.id, equipmentType],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('workflow_templates')
        .select('*, workflow_template_steps(count)')
        .eq('tenant_id', tenant.id)
        .eq('is_published', true)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (equipmentType) {
        query = query.or(`equipment_type.eq.${equipmentType},equipment_type.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });
}
