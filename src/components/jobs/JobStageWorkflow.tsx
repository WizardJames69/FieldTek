import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Lightbulb,
  Check,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeStage, setActiveStage] = useState(currentStage || 'Service');
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

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
      notes 
    }: { 
      itemId: string; 
      completed: boolean; 
      notes?: string;
    }) => {
      const existing = getCompletion(itemId);
      
      if (existing) {
        const { error } = await supabase
          .from('job_checklist_completions')
          .update({
            completed,
            notes: notes || existing.notes,
            completed_at: completed ? new Date().toISOString() : null,
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

  const handleCheckboxChange = (itemId: string, checked: boolean) => {
    saveCompletionMutation.mutate({ itemId, completed: checked });
  };

  const handlePassFail = (itemId: string, passed: boolean) => {
    saveCompletionMutation.mutate({ 
      itemId, 
      completed: true, 
      notes: passed ? 'PASS' : 'FAIL' 
    });
  };

  const handleMeasurement = (itemId: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [itemId]: value }));
    debouncedSave(itemId, value);
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
          
          return (
            <Button
              key={stage}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'flex-shrink-0',
                isActive && sStyle.bg,
                isActive && sStyle.text,
                isActive && sStyle.border
              )}
              onClick={() => {
                setActiveStage(stage);
                onStageChange?.(stage);
              }}
            >
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
                            onChange={(e) => handleMeasurement(item.id, e.target.value)}
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
