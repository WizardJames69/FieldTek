import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Lightbulb,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useJobEvidence, useRequiredEvidence, getItemEvidence } from '@/hooks/useStepEvidence';
import type { RequiredEvidenceMap } from '@/hooks/useStepEvidence';
import { StepEvidenceCapture } from '@/components/mobile/StepEvidenceCapture';
import { EvidenceStatusBadge } from '@/components/mobile/EvidenceStatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { debounce } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  type: 'checkbox' | 'measurement' | 'text' | 'pass_fail';
  unit?: string;
  required: boolean;
}

interface ChecklistCompletion {
  id: string;
  job_id: string;
  stage_name: string;
  checklist_item: string;
  completed: boolean;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

interface ComplianceVerdictRow {
  id: string;
  stage_name: string;
  verdict: 'pass' | 'fail' | 'warn' | 'block';
  explanation: string | null;
  overridden: boolean;
  compliance_rules: {
    rule_name: string;
    severity: string;
    code_references: string[] | null;
  } | null;
}

interface JobStageWorkflowProps {
  jobId: string;
  jobType: string | null;
  currentStage: string | null;
  onStageChange?: (stage: string) => void;
}

const stageStyles = {
  Startup: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
  Service: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
  Maintenance: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-500' },
  Inspection: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500' },
};

export function JobStageWorkflow({ jobId, jobType, currentStage, onStageChange }: JobStageWorkflowProps) {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeStage, setActiveStage] = useState(currentStage || 'Service');
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  // Step verification
  const { isEnabled } = useFeatureFlags();
  const verificationEnabled = isEnabled('workflow_step_verification');
  const { data: jobEvidence = [] } = useJobEvidence(verificationEnabled ? jobId : undefined);
  const { data: requiredEvidence = {} as RequiredEvidenceMap } = useRequiredEvidence(
    verificationEnabled ? activeStage : undefined
  );

  // Fetch stage templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['job-stage-templates', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_stage_templates')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('order_index');
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch checklist completions for this job
  const { data: completions, isLoading: completionsLoading } = useQuery({
    queryKey: ['job-checklist-completions', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_checklist_completions')
        .select('*')
        .eq('job_id', jobId);
      
      if (error) throw error;
      return data as ChecklistCompletion[];
    },
    enabled: !!jobId,
  });

  // Fetch compliance verdicts for this job
  const { data: complianceVerdicts } = useQuery({
    queryKey: ['compliance-verdicts', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_verdicts')
        .select('id, stage_name, verdict, explanation, overridden, compliance_rules:rule_id(rule_name, severity, code_references)')
        .eq('job_id', jobId)
        .eq('overridden', false);

      if (error) throw error;
      return (data || []) as unknown as ComplianceVerdictRow[];
    },
    enabled: !!jobId,
  });

  // Get verdict status for a stage
  const getStageVerdictStatus = (stage: string): 'pass' | 'warn' | 'fail' | 'block' | null => {
    const stageVerdicts = complianceVerdicts?.filter(v => v.stage_name === stage) || [];
    if (stageVerdicts.length === 0) return null;
    if (stageVerdicts.some(v => v.verdict === 'block')) return 'block';
    if (stageVerdicts.some(v => v.verdict === 'fail')) return 'fail';
    if (stageVerdicts.some(v => v.verdict === 'warn')) return 'warn';
    return 'pass';
  };

  // Check if a stage is blocked by safety_gate rules
  const isStageBlocked = (stage: string): boolean => {
    const status = getStageVerdictStatus(stage);
    return status === 'block';
  };

  // Get the current stage template
  const stageTemplate = templates?.find(t => t.stage_name === activeStage);
  const checklistItems: ChecklistItem[] = Array.isArray(stageTemplate?.checklist_items) 
    ? (stageTemplate.checklist_items as unknown as ChecklistItem[]) 
    : [];

  // Calculate progress
  const getProgress = useCallback(() => {
    if (!checklistItems.length || !completions) return 0;
    const stageCompletions = completions.filter(c => c.stage_name === activeStage && c.completed);
    return Math.round((stageCompletions.length / checklistItems.length) * 100);
  }, [checklistItems, completions, activeStage]);

  // Get completion for an item
  const getCompletion = (itemId: string): ChecklistCompletion | undefined => {
    return completions?.find(c => c.checklist_item === itemId && c.stage_name === activeStage);
  };

  // Save completion mutation
  const saveCompletionMutation = useMutation({
    mutationFn: async ({
      itemId,
      completed,
      notes,
      measurementValue,
      measurementUnit,
    }: {
      itemId: string;
      completed: boolean;
      notes?: string;
      measurementValue?: number;
      measurementUnit?: string;
    }) => {
      const existing = getCompletion(itemId);

      if (existing) {
        const { error } = await supabase
          .from('job_checklist_completions')
          .update({
            completed,
            notes: notes || existing.notes,
            completed_at: completed ? new Date().toISOString() : null,
            ...(measurementValue !== undefined && { measurement_value: measurementValue }),
            ...(measurementUnit !== undefined && { measurement_unit: measurementUnit }),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('job_checklist_completions')
          .insert({
            job_id: jobId,
            stage_name: activeStage,
            checklist_item: itemId,
            completed,
            notes,
            completed_at: completed ? new Date().toISOString() : null,
            ...(measurementValue !== undefined && { measurement_value: measurementValue }),
            ...(measurementUnit !== undefined && { measurement_unit: measurementUnit }),
          });
        if (error) throw error;
      }

      // Update job checklist progress
      const newProgress = getProgress();
      await supabase
        .from('scheduled_jobs')
        .update({
          checklist_progress: {
            stage: activeStage,
            completed: completions?.filter(c => c.stage_name === activeStage && c.completed).length || 0,
            total: checklistItems.length,
            percentage: newProgress,
          },
          current_stage: activeStage,
        })
        .eq('id', jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-checklist-completions', jobId] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Debounced save for text fields
  const debouncedSave = useCallback(
    debounce((itemId: string, notes: string) => {
      saveCompletionMutation.mutate({ itemId, completed: true, notes });
    }, 2000),
    [saveCompletionMutation]
  );

  // Debounced save for measurement fields (includes typed value + unit)
  const debouncedMeasurementSave = useCallback(
    debounce((itemId: string, notes: string, unit?: string) => {
      const numVal = parseFloat(notes);
      saveCompletionMutation.mutate({
        itemId,
        completed: true,
        notes,
        measurementValue: isNaN(numVal) ? undefined : numVal,
        measurementUnit: unit,
      });
    }, 2000),
    [saveCompletionMutation]
  );

  const handleCheckboxChange = (itemId: string, checked: boolean) => {
    saveCompletionMutation.mutate({ itemId, completed: checked });
  };

  const handlePassFail = (itemId: string, passed: boolean) => {
    saveCompletionMutation.mutate({
      itemId,
      completed: true,
      notes: passed ? 'PASS' : 'FAIL',
    });
  };

  const handleMeasurement = (itemId: string, value: string, unit?: string) => {
    setLocalValues(prev => ({ ...prev, [itemId]: value }));
    debouncedMeasurementSave(itemId, value, unit);
  };

  const handleTextChange = (itemId: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [itemId]: value }));
    debouncedSave(itemId, value);
  };

  // Initialize local values from completions
  useEffect(() => {
    if (completions) {
      const values: Record<string, string> = {};
      completions.forEach(c => {
        if (c.notes) values[c.checklist_item] = c.notes;
      });
      setLocalValues(values);
    }
  }, [completions]);

  const availableStages = ['Startup', 'Service', 'Maintenance', 'Inspection'];
  const styles = stageStyles[activeStage as keyof typeof stageStyles] || stageStyles.Service;

  if (templatesLoading || completionsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {availableStages.map(stage => {
          const sStyle = stageStyles[stage as keyof typeof stageStyles];
          const isActive = stage === activeStage;
          const stageCompletions = completions?.filter(c => c.stage_name === stage && c.completed).length || 0;
          const stageItems = templates?.find(t => t.stage_name === stage)?.checklist_items;
          const stageTotal = Array.isArray(stageItems) ? stageItems.length : 0;
          const verdictStatus = getStageVerdictStatus(stage);
          const blocked = isStageBlocked(stage);

          return (
            <Button
              key={stage}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              disabled={blocked && !isActive}
              className={cn(
                'flex-shrink-0',
                isActive && sStyle.bg,
                isActive && sStyle.text,
                isActive && sStyle.border,
                blocked && !isActive && 'opacity-50'
              )}
              onClick={async () => {
                if (blocked && !isActive) {
                  toast({
                    title: 'Stage Blocked',
                    description: 'This stage is blocked by compliance rules. Resolve required items first.',
                    variant: 'destructive',
                  });
                  return;
                }
                const previousStage = activeStage;
                setActiveStage(stage);
                onStageChange?.(stage);
                // Record stage transition in workflow_state JSONB
                if (stage !== previousStage && user?.id) {
                  try {
                    const { data: jobData } = await supabase
                      .from('scheduled_jobs')
                      .select('workflow_state')
                      .eq('id', jobId)
                      .single();
                    const ws = jobData?.workflow_state || { completed_stages: [], stage_transitions: [] };
                    const completedStages = Array.isArray(ws.completed_stages) ? ws.completed_stages : [];
                    const transitions = Array.isArray(ws.stage_transitions) ? ws.stage_transitions : [];
                    if (previousStage && !completedStages.includes(previousStage)) {
                      completedStages.push(previousStage);
                    }
                    transitions.push({
                      from: previousStage,
                      to: stage,
                      at: new Date().toISOString(),
                      by: user.id,
                    });
                    await supabase
                      .from('scheduled_jobs')
                      .update({
                        workflow_state: {
                          completed_stages: completedStages,
                          current_stage_started_at: new Date().toISOString(),
                          stage_transitions: transitions,
                        },
                        current_stage: stage,
                      })
                      .eq('id', jobId);
                  } catch (err) {
                    console.error('Failed to record stage transition:', err);
                  }
                }
              }}
            >
              {verdictStatus === 'pass' && <ShieldCheck className="h-3.5 w-3.5 mr-1 text-green-600" />}
              {verdictStatus === 'warn' && <AlertTriangle className="h-3.5 w-3.5 mr-1 text-yellow-600" />}
              {(verdictStatus === 'fail' || verdictStatus === 'block') && <ShieldAlert className="h-3.5 w-3.5 mr-1 text-red-600" />}
              {stage}
              {stageTotal > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {stageCompletions}/{stageTotal}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{activeStage} Progress</span>
          <span className="text-muted-foreground">{getProgress()}%</span>
        </div>
        <Progress value={getProgress()} className="h-2" />
      </div>

      {/* Compliance Verdicts for Active Stage */}
      {(() => {
        const activeVerdicts = complianceVerdicts?.filter(v => v.stage_name === activeStage && v.verdict !== 'pass') || [];
        if (activeVerdicts.length === 0) return null;
        return (
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 mt-0.5 text-amber-600 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-sm text-amber-800">Compliance Issues</p>
                  {activeVerdicts.map(v => (
                    <div key={v.id} className="flex items-center gap-2 text-sm">
                      {v.verdict === 'block' && <Badge className="bg-red-500 text-white text-[10px] h-4 px-1">BLOCKED</Badge>}
                      {v.verdict === 'fail' && <Badge className="bg-red-400 text-white text-[10px] h-4 px-1">FAIL</Badge>}
                      {v.verdict === 'warn' && <Badge className="bg-yellow-500 text-white text-[10px] h-4 px-1">WARN</Badge>}
                      <span className="text-amber-900">
                        {v.compliance_rules?.rule_name || 'Unknown rule'}: {v.explanation}
                      </span>
                      {v.compliance_rules?.code_references && v.compliance_rules.code_references.length > 0 && (
                        <span className="text-amber-600 text-xs">
                          ({v.compliance_rules.code_references.join(', ')})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* AI Guidance Banner */}
      <Card className={cn('border-2', styles.border, styles.bg)}>
        <CardContent className="py-3">
          <div className="flex items-start gap-3">
            <Lightbulb className={cn('h-5 w-5 mt-0.5', styles.icon)} />
            <div>
              <p className={cn('font-medium text-sm', styles.text)}>AI Guidance</p>
              <p className="text-sm text-muted-foreground">
                {activeStage === 'Startup' && 'Verify all equipment is properly installed and connections are secure before powering on.'}
                {activeStage === 'Service' && 'Diagnose the issue systematically. Check the most common failure points first.'}
                {activeStage === 'Maintenance' && 'Follow the preventive maintenance schedule. Document any wear or potential issues.'}
                {activeStage === 'Inspection' && 'Thoroughly inspect all components. Document findings with photos when possible.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checklistItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No checklist items for this stage
            </p>
          ) : (
            checklistItems.map((item) => {
              const completion = getCompletion(item.id);
              const isCompleted = completion?.completed || false;
              const notes = localValues[item.id] || completion?.notes || '';
              
              return (
                <div 
                  key={item.id} 
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    isCompleted ? 'bg-green-50 border-green-200' : 'bg-muted/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox type */}
                    {item.type === 'checkbox' && (
                      <Checkbox
                        checked={isCompleted}
                        onCheckedChange={(checked) => handleCheckboxChange(item.id, !!checked)}
                        className="mt-0.5"
                      />
                    )}
                    
                    {/* Status icon for other types */}
                    {item.type !== 'checkbox' && (
                      isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )
                    )}

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm',
                          isCompleted && 'text-muted-foreground line-through'
                        )}>
                          {item.label}
                        </span>
                        {item.required && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1">
                            Required
                          </Badge>
                        )}
                      </div>

                      {/* Measurement input */}
                      {item.type === 'measurement' && (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="Enter value"
                            value={notes}
                            onChange={(e) => handleMeasurement(item.id, e.target.value, item.unit)}
                            className="w-32 h-8"
                          />
                          <span className="text-sm text-muted-foreground">{item.unit}</span>
                        </div>
                      )}

                      {/* Text input */}
                      {item.type === 'text' && (
                        <Textarea
                          placeholder="Enter notes..."
                          value={notes}
                          onChange={(e) => handleTextChange(item.id, e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                      )}

                      {/* Pass/Fail buttons */}
                      {item.type === 'pass_fail' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={notes === 'PASS' ? 'default' : 'outline'}
                            className={notes === 'PASS' ? 'bg-green-500 hover:bg-green-600' : ''}
                            onClick={() => handlePassFail(item.id, true)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Pass
                          </Button>
                          <Button
                            size="sm"
                            variant={notes === 'FAIL' ? 'default' : 'outline'}
                            className={notes === 'FAIL' ? 'bg-red-500 hover:bg-red-600' : ''}
                            onClick={() => handlePassFail(item.id, false)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Fail
                          </Button>
                        </div>
                      )}

                      {/* Step verification evidence */}
                      {verificationEnabled && requiredEvidence[item.id] && (
                        <>
                          {getItemEvidence(jobEvidence, item.id).length > 0 && (
                            <EvidenceStatusBadge
                              status={
                                getItemEvidence(jobEvidence, item.id).every(
                                  (e) => e.verification_status === 'verified'
                                )
                                  ? 'verified'
                                  : getItemEvidence(jobEvidence, item.id).some(
                                      (e) => e.verification_status === 'failed'
                                    )
                                    ? 'failed'
                                    : getItemEvidence(jobEvidence, item.id).some(
                                        (e) => e.verification_status === 'flagged'
                                      )
                                      ? 'flagged'
                                      : 'pending'
                              }
                            />
                          )}
                          <StepEvidenceCapture
                            jobId={jobId}
                            checklistItemId={item.id}
                            stageName={activeStage}
                            requirement={requiredEvidence[item.id]}
                            existingEvidence={getItemEvidence(jobEvidence, item.id)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
