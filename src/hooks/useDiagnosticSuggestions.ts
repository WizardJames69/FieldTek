import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { detectSymptoms } from '@/lib/symptomDetection';

// ── Types ──────────────────────────────────────────────────────────────

export interface DiagnosticSuggestion {
  repairAction: string;
  failureComponent: string | null;
  likelihood: number;
  confidence: 'high' | 'moderate' | 'low';
  occurrences: number;
  bestRepair: string | null;
}

export interface DiagnosticCheck {
  label: string;
  equipmentType: string | null;
  successRate: number;
  totalExecutions: number;
}

export interface RepairPattern {
  symptom: string;
  repairs: string[];
  components: string[];
  successRate: number;
  occurrences: number;
  clusterScore: number;
}

export interface SentinelInsight {
  causes: DiagnosticSuggestion[];
  checks: DiagnosticCheck[];
  repairs: RepairPattern[];
  dataQuality: 'high' | 'moderate' | 'low' | 'none';
  symptomsDetected: string[];
  totalOccurrences: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const MIN_OCCURRENCES = 5;
const CONFIDENCE_HIGH = 25;
const CONFIDENCE_MODERATE = 8;
const DEBOUNCE_MS = 400;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

// ── Helpers ────────────────────────────────────────────────────────────

function getConfidence(occurrences: number): 'high' | 'moderate' | 'low' {
  if (occurrences >= CONFIDENCE_HIGH) return 'high';
  if (occurrences >= CONFIDENCE_MODERATE) return 'moderate';
  return 'low';
}

function getDataQuality(total: number): SentinelInsight['dataQuality'] {
  if (total === 0) return 'none';
  if (total >= CONFIDENCE_HIGH) return 'high';
  if (total >= CONFIDENCE_MODERATE) return 'moderate';
  return 'low';
}

// ── Debounce hook ──────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ── Fetch function ─────────────────────────────────────────────────────

async function fetchInsights(
  tenantId: string,
  symptomKeys: string[],
  jobType: string | null,
): Promise<SentinelInsight> {
  // Run 3 queries in parallel
  const [statsResult, clustersResult, diagnosticsResult] = await Promise.all([
    // 1. Diagnostic statistics — symptom-based causes
    supabase
      .from('workflow_diagnostic_statistics')
      .select('symptom, failure_component, repair_action, occurrence_count, success_count, success_rate, confidence_score')
      .eq('tenant_id', tenantId)
      .in('symptom', symptomKeys)
      .gte('occurrence_count', MIN_OCCURRENCES)
      .order('success_rate', { ascending: false })
      .limit(10),

    // 2. Pattern clusters — multi-action repair patterns
    supabase
      .from('workflow_pattern_clusters')
      .select('primary_symptom, failure_components, repair_actions, avg_success_rate, cluster_score, total_occurrences')
      .eq('tenant_id', tenantId)
      .in('primary_symptom', symptomKeys)
      .in('status', ['active', 'suggested'])
      .gte('cluster_score', 0.2)
      .order('cluster_score', { ascending: false })
      .limit(5),

    // 3. Diagnostics — equipment-type checks
    jobType
      ? supabase
          .from('workflow_diagnostics')
          .select('diagnostic_key, diagnostic_label, equipment_type, success_count, total_count')
          .eq('tenant_id', tenantId)
          .eq('equipment_type', jobType)
          .order('success_count', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const stats = statsResult.data ?? [];
  const clusters = clustersResult.data ?? [];
  const diagnostics = diagnosticsResult.data ?? [];

  // ── Fuse into causes ──
  // Group by failure_component, pick best repair per component
  const causeMap = new Map<string, {
    failureComponent: string;
    likelihood: number;
    occurrences: number;
    bestRepair: string | null;
    bestRepairRate: number;
  }>();

  for (const row of stats) {
    const key = row.failure_component || row.repair_action;
    const existing = causeMap.get(key);
    if (!existing) {
      causeMap.set(key, {
        failureComponent: row.failure_component || row.repair_action,
        likelihood: row.success_rate * 100,
        occurrences: row.occurrence_count,
        bestRepair: row.repair_action,
        bestRepairRate: row.success_rate,
      });
    } else {
      existing.occurrences += row.occurrence_count;
      if (row.success_rate > existing.bestRepairRate) {
        existing.bestRepair = row.repair_action;
        existing.bestRepairRate = row.success_rate;
      }
      existing.likelihood = Math.max(existing.likelihood, row.success_rate * 100);
    }
  }

  // Also merge pattern cluster data into causes
  for (const cluster of clusters) {
    for (const comp of cluster.failure_components) {
      const existing = causeMap.get(comp);
      if (existing) {
        existing.occurrences += cluster.total_occurrences;
        existing.likelihood = Math.max(existing.likelihood, cluster.avg_success_rate * 100);
      } else {
        causeMap.set(comp, {
          failureComponent: comp,
          likelihood: cluster.avg_success_rate * 100,
          occurrences: cluster.total_occurrences,
          bestRepair: cluster.repair_actions[0] ?? null,
          bestRepairRate: cluster.avg_success_rate,
        });
      }
    }
  }

  const causes: DiagnosticSuggestion[] = Array.from(causeMap.values())
    .sort((a, b) => b.likelihood - a.likelihood)
    .slice(0, 3)
    .map((c) => ({
      repairAction: c.bestRepair ?? c.failureComponent,
      failureComponent: c.failureComponent,
      likelihood: Math.round(c.likelihood),
      confidence: getConfidence(c.occurrences),
      occurrences: c.occurrences,
      bestRepair: c.bestRepair,
    }));

  // ── Map diagnostics to checks ──
  const checks: DiagnosticCheck[] = diagnostics.map((d: any) => ({
    label: d.diagnostic_label,
    equipmentType: d.equipment_type,
    successRate: d.total_count > 0 ? (d.success_count / d.total_count) * 100 : 0,
    totalExecutions: d.total_count,
  }));

  // ── Map clusters to repair patterns ──
  const repairs: RepairPattern[] = clusters.map((c: any) => ({
    symptom: c.primary_symptom,
    repairs: c.repair_actions ?? [],
    components: c.failure_components ?? [],
    successRate: Math.round(c.avg_success_rate * 100),
    occurrences: c.total_occurrences,
    clusterScore: c.cluster_score,
  }));

  // ── Compute data quality ──
  const totalOccurrences = causes.reduce((sum, c) => sum + c.occurrences, 0);

  return {
    causes,
    checks,
    repairs,
    dataQuality: getDataQuality(totalOccurrences),
    symptomsDetected: symptomKeys,
    totalOccurrences,
  };
}

// ── Main Hook ──────────────────────────────────────────────────────────

export function useDiagnosticSuggestions(
  jobDescription: string | null,
  jobNotes: string | null,
  jobType: string | null,
  equipmentId: string | null,
  equipmentModel: string | null,
  enabled: boolean,
) {
  const { tenant } = useTenant();

  // Combine and debounce text inputs
  const combinedText = [jobDescription, jobNotes].filter(Boolean).join(' ');
  const debouncedText = useDebouncedValue(combinedText, DEBOUNCE_MS);

  // Extract symptoms from debounced text
  const symptomKeys = useMemo(
    () => detectSymptoms(debouncedText),
    [debouncedText],
  );

  const tenantId = tenant?.id;
  const hasSymptoms = symptomKeys.length > 0;

  return useQuery<SentinelInsight>({
    queryKey: ['sentinel-insights', tenantId, symptomKeys, jobType],
    queryFn: () => fetchInsights(tenantId!, symptomKeys, jobType),
    enabled: enabled && !!tenantId && hasSymptoms,
    staleTime: STALE_TIME,
    placeholderData: hasSymptoms
      ? undefined
      : {
          causes: [],
          checks: [],
          repairs: [],
          dataQuality: 'none' as const,
          symptomsDetected: [],
          totalOccurrences: 0,
        },
  });
}
