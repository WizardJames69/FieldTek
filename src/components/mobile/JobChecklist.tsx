import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Camera, Loader2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useJobEvidence, useRequiredEvidence, getItemEvidence } from '@/hooks/useStepEvidence';
import type { RequiredEvidenceMap } from '@/hooks/useStepEvidence';
import { StepEvidenceCapture } from '@/components/mobile/StepEvidenceCapture';
import { EvidenceStatusBadge } from '@/components/mobile/EvidenceStatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  job_id: string;
  stage_name: string;
  checklist_item: string;
  completed: boolean;
  notes: string | null;
  photos: any;
}

interface JobChecklistProps {
  jobId: string;
  items: ChecklistItem[];
}

export function JobChecklist({ jobId, items }: JobChecklistProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Step verification
  const { isEnabled } = useFeatureFlags();
  const verificationEnabled = isEnabled('workflow_step_verification');
  const { data: jobEvidence = [] } = useJobEvidence(verificationEnabled ? jobId : undefined);

  // Get unique stage names from items to load required evidence
  const stageNames = [...new Set(items.map((i) => i.stage_name))];
  // Load required evidence for the first stage (simplified — in practice, load per stage)
  const { data: requiredEvidence = {} as RequiredEvidenceMap } = useRequiredEvidence(
    verificationEnabled && stageNames.length > 0 ? stageNames[0] : undefined
  );

  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('job_checklist_completions')
        .update({
          completed,
          completed_by: completed ? user?.id : null,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-checklist', jobId] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const { error } = await supabase
        .from('job_checklist_completions')
        .update({ notes })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Notes saved' });
      queryClient.invalidateQueries({ queryKey: ['job-checklist', jobId] });
    },
  });

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.stage_name]) acc[item.stage_name] = [];
    acc[item.stage_name].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // Calculate completion progress
  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="p-4 rounded-2xl glass-morphism border border-border/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-muted-foreground">Progress</span>
          <span className="text-sm font-bold text-foreground">{completedCount}/{totalCount}</span>
        </div>
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {Object.entries(groupedItems).map(([stageName, stageItems]) => {
        const stageCompleted = stageItems.filter(i => i.completed).length;
        const stageTotal = stageItems.length;
        
        return (
          <div key={stageName}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest">
                {stageName}
              </h3>
              <span className="text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {stageCompleted}/{stageTotal}
              </span>
            </div>
            <div className="space-y-3">
              {stageItems.map((item) => {
                const isExpanded = expandedItem === item.id;
                
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-2xl border transition-all duration-200',
                      item.completed 
                        ? 'bg-success/10 border-success/30 ring-1 ring-success/20' 
                        : 'bg-card/95 backdrop-blur-sm border-border/40 hover:border-border/60'
                    )}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          onClick={() => toggleMutation.mutate({ itemId: item.id, completed: !item.completed })}
                          disabled={toggleMutation.isPending}
                          className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-all touch-native",
                            item.completed
                              ? 'bg-success/20 ring-1 ring-success/40'
                              : 'bg-muted/50 ring-1 ring-border/50'
                          )}
                        >
                          <Checkbox
                            checked={item.completed}
                            tabIndex={-1}
                            className="h-6 w-6 border-0 pointer-events-none"
                            disabled={toggleMutation.isPending}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                            className="text-left w-full group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className={cn(
                                'font-medium text-sm leading-relaxed',
                                item.completed && 'line-through text-muted-foreground'
                              )}>
                                {item.checklist_item}
                              </p>
                              <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                                isExpanded ? 'bg-primary/10' : 'bg-muted/50 group-hover:bg-muted'
                              )}>
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-primary" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                            {item.notes && !isExpanded && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                                <FileText className="h-3 w-3" />
                                <span className="truncate">{item.notes}</span>
                              </div>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-4 space-y-4 animate-fade-in">
                              <Textarea
                                placeholder="Add notes for this step..."
                                value={notes[item.id] ?? item.notes ?? ''}
                                onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                                rows={3}
                                aria-label={`Notes for ${item.checklist_item}`}
                                className="bg-muted/30 border-border/40 focus:border-primary/50 resize-none"
                              />
                              <div className="flex gap-3">
                                <Button
                                  size="default"
                                  variant="outline"
                                  className="flex-1 touch-native h-11 font-semibold"
                                  onClick={() =>
                                    saveNotesMutation.mutate({
                                      itemId: item.id,
                                      notes: notes[item.id] ?? '',
                                    })
                                  }
                                  disabled={saveNotesMutation.isPending}
                                >
                                  {saveNotesMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Save Notes'
                                  )}
                                </Button>
                                {/* Photo capture - planned for post-beta */}
                              </div>

                              {/* Step verification evidence */}
                              {verificationEnabled && requiredEvidence[item.checklist_item] && (
                                <div className="pt-2">
                                  {getItemEvidence(jobEvidence, item.checklist_item).length > 0 && (
                                    <div className="mb-2">
                                      <EvidenceStatusBadge
                                        status={
                                          getItemEvidence(jobEvidence, item.checklist_item).every(
                                            (e) => e.verification_status === 'verified'
                                          )
                                            ? 'verified'
                                            : getItemEvidence(jobEvidence, item.checklist_item).some(
                                                (e) => e.verification_status === 'failed'
                                              )
                                              ? 'failed'
                                              : 'pending'
                                        }
                                      />
                                    </div>
                                  )}
                                  <StepEvidenceCapture
                                    jobId={jobId}
                                    checklistItemId={item.checklist_item}
                                    stageName={item.stage_name}
                                    requirement={requiredEvidence[item.checklist_item]}
                                    existingEvidence={getItemEvidence(jobEvidence, item.checklist_item)}
                                  />
                                </div>
                              )}

                              {item.photos?.length > 0 && (
                                <div className="flex gap-2 flex-wrap pt-2" role="list" aria-label="Attached photos">
                                  {item.photos.map((photo: string, i: number) => (
                                    <img
                                      key={i}
                                      src={photo}
                                      alt={`Photo ${i + 1} for ${item.checklist_item}`}
                                      className="h-20 w-20 object-cover rounded-xl ring-1 ring-border/50"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {item.completed && !isExpanded && (
                          <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center ring-1 ring-success/40 shrink-0">
                            <Check className="h-5 w-5 text-success" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
