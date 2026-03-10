import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

// ── Types ──────────────────────────────────────────────────────────────

export interface SuggestedStep {
  step_number: number;
  stage_name: string;
  title: string;
  instruction: string;
  step_type: string;
  evidence_requirements: Record<string, boolean>;
  validation_rules: Record<string, number>;
  estimated_minutes: number | null;
  safety_warning: string | null;
  source_chain: string | null;
}

export interface PatternSuggestionRow {
  id: string;
  tenant_id: string;
  cluster_id: string;
  suggested_name: string;
  suggested_description: string | null;
  suggested_category: string;
  equipment_type: string | null;
  equipment_model: string | null;
  suggested_steps: SuggestedStep[];
  cluster_score: number;
  total_supporting_jobs: number;
  avg_success_rate: number;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  converted_template_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Query Keys ─────────────────────────────────────────────────────────

const SUGGESTIONS_KEY = 'workflow-pattern-suggestions';

// ── Hook: List Pattern Suggestions ─────────────────────────────────────

export function usePatternSuggestions(statusFilter?: string) {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: [SUGGESTIONS_KEY, tenant?.id, statusFilter],
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from('workflow_pattern_suggestions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('cluster_score', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('review_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Parse suggested_steps from JSONB
      return (data ?? []).map((row) => ({
        ...row,
        suggested_steps: Array.isArray(row.suggested_steps)
          ? row.suggested_steps
          : typeof row.suggested_steps === 'string'
            ? JSON.parse(row.suggested_steps)
            : [],
      })) as PatternSuggestionRow[];
    },
    enabled: !!tenant?.id,
  });
}

// ── Hook: Review Suggestion (approve/reject) ───────────────────────────

export function useReviewSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      suggestionId: string;
      reviewStatus: 'approved' | 'rejected';
      reviewNotes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('workflow_pattern_suggestions')
        .update({
          review_status: params.reviewStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: params.reviewNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
    },
  });
}

// ── Hook: Convert Suggestion to Template ───────────────────────────────

export function useConvertSuggestionToTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('convert_suggestion_to_template', {
        p_suggestion_id: suggestionId,
        p_reviewed_by: user.id,
      });

      if (error) throw error;
      return data as string; // returns template UUID
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
    },
  });
}

// ── Hook: Trigger Pattern Discovery ────────────────────────────────────

export function useTriggerPatternDiscovery() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase.functions.invoke('suggest-workflow-patterns', {
        body: { tenant_id: tenant.id },
      });

      if (error) throw error;
      return data as {
        success: boolean;
        clusters_found: number;
        suggestions_created: number;
        latency_ms: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
    },
  });
}
