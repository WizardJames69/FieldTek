// ============================================================
// Suggest Workflow Patterns — Type Definitions
// ============================================================

export interface DiagnosticChain {
  symptom: string;
  failure_component: string;
  repair_action: string;
  equipment_type: string | null;
  occurrence_count: number;
  success_count: number;
  success_rate: number;
  confidence_score: number;
  last_calculated_at: string;
}

export interface PatternCluster {
  cluster_key: string;
  equipment_type: string | null;
  equipment_model: string | null;
  primary_symptom: string;
  failure_components: string[];
  repair_actions: string[];
  chains: DiagnosticChain[];
  chain_count: number;
  total_occurrences: number;
  avg_success_rate: number;
  avg_confidence: number;
  cluster_score: number;
}

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

export interface PatternSuggestion {
  cluster_id: string;
  suggested_name: string;
  suggested_description: string;
  suggested_category: string;
  equipment_type: string | null;
  equipment_model: string | null;
  suggested_steps: SuggestedStep[];
  cluster_score: number;
  total_supporting_jobs: number;
  avg_success_rate: number;
}
