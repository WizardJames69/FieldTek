import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useJobEvidence } from '@/hooks/useStepEvidence';
import {
  useWorkflowExecution,
  useAdvanceStep,
  useSkipStep,
  useCompleteExecution,
  useAbortExecution,
  type StepCompletionData,
} from '@/hooks/useWorkflowExecution';
import { WorkflowProgressBar } from './WorkflowProgressBar';
import { WorkflowStepCard } from './WorkflowStepCard';

interface WorkflowExecutionViewProps {
  jobId: string;
  executionId: string;
  variant?: 'mobile' | 'desktop';
}

export function WorkflowExecutionView({ jobId, executionId, variant = 'mobile' }: WorkflowExecutionViewProps) {
  const { data, isLoading, error } = useWorkflowExecution(executionId);
  const { data: allEvidence = [] } = useJobEvidence(jobId);
  const advanceStep = useAdvanceStep();
  const skipStep = useSkipStep();
  const completeExecution = useCompleteExecution();
  const abortExecution = useAbortExecution();

  const [viewingStepNumber, setViewingStepNumber] = useState<number | null>(null);
  const [abortDialogOpen, setAbortDialogOpen] = useState(false);
  const [selectedAbortReason, setSelectedAbortReason] = useState('');
  const [customAbortReason, setCustomAbortReason] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {error ? 'Failed to load workflow execution' : 'Execution not found'}
      </div>
    );
  }

  const { execution, steps, templateName, totalSteps, completedSteps, currentStep } = data;
  const isAborted = execution.status === 'aborted';
  const isCompleted = execution.status === 'completed';
  const isActive = !isAborted && !isCompleted;

  // Determine which step to display
  const displayStepNumber = viewingStepNumber ?? execution.current_step_number;
  const displayStep = steps.find((s) => s.stepExecution.step_number === displayStepNumber);
  const isViewingCurrent = displayStepNumber === execution.current_step_number;
  const allStepsDone = completedSteps === totalSteps;

  const handleComplete = async (stepData: StepCompletionData) => {
    if (!currentStep) return;
    try {
      await advanceStep.mutateAsync({
        executionId,
        stepExecutionId: currentStep.stepExecution.id,
        data: stepData,
      });
      setViewingStepNumber(null); // Reset to follow current step
      toast.success('Step completed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete step');
    }
  };

  const handleSkip = async (reason: string) => {
    if (!currentStep) return;
    try {
      await skipStep.mutateAsync({
        executionId,
        stepExecutionId: currentStep.stepExecution.id,
        reason,
      });
      setViewingStepNumber(null);
      toast.success('Step skipped');
    } catch (err: any) {
      toast.error(err.message || 'Failed to skip step');
    }
  };

  const handleCompleteExecution = async () => {
    try {
      await completeExecution.mutateAsync({ executionId });
      toast.success('Workflow completed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete workflow');
    }
  };

  const effectiveAbortReason = selectedAbortReason === 'Other'
    ? customAbortReason.trim()
    : selectedAbortReason;

  const handleAbort = async () => {
    if (!effectiveAbortReason) return;
    try {
      await abortExecution.mutateAsync({ executionId, reason: effectiveAbortReason });
      setAbortDialogOpen(false);
      setSelectedAbortReason('');
      setCustomAbortReason('');
      toast.success('Workflow aborted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to abort workflow');
    }
  };

  const navigateStep = (direction: 'prev' | 'next') => {
    const current = displayStepNumber;
    const target = direction === 'prev' ? current - 1 : current + 1;
    if (target >= 1 && target <= totalSteps) {
      setViewingStepNumber(target);
    }
  };

  const isMutating = advanceStep.isPending || skipStep.isPending || completeExecution.isPending || abortExecution.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{templateName}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {isCompleted && (
              <Badge variant="default" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </Badge>
            )}
            {isAborted && (
              <Badge variant="destructive" className="text-xs gap-1">
                <XCircle className="h-3 w-3" /> Aborted
              </Badge>
            )}
            {isActive && (
              <span className="text-xs text-muted-foreground">
                {completedSteps}/{totalSteps} steps done
              </span>
            )}
          </div>
        </div>
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive shrink-0"
            onClick={() => setAbortDialogOpen(true)}
          >
            Abort
          </Button>
        )}
      </div>

      {/* Abort reason display */}
      {isAborted && execution.abort_reason && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          <span className="font-medium">Reason:</span> {execution.abort_reason}
        </div>
      )}

      {/* Progress */}
      <WorkflowProgressBar
        steps={steps}
        currentStepNumber={displayStepNumber}
        onStepClick={setViewingStepNumber}
      />

      {/* Navigation */}
      {totalSteps > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateStep('prev')}
            disabled={displayStepNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {!isViewingCurrent && isActive && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setViewingStepNumber(null)}
            >
              Go to current step
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateStep('next')}
            disabled={displayStepNumber >= totalSteps}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Current step card */}
      {displayStep && (
        <WorkflowStepCard
          step={displayStep}
          jobId={jobId}
          isCurrentStep={isViewingCurrent && isActive && displayStep.stepExecution.status === 'in_progress'}
          allEvidence={allEvidence}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      )}

      {/* Complete Workflow button */}
      {isActive && allStepsDone && (
        <Button
          onClick={handleCompleteExecution}
          disabled={isMutating}
          className="w-full"
          size="lg"
        >
          {completeExecution.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Complete Workflow
        </Button>
      )}

      {/* Abort Dialog */}
      <AlertDialog open={abortDialogOpen} onOpenChange={(open) => {
        setAbortDialogOpen(open);
        if (!open) {
          setSelectedAbortReason('');
          setCustomAbortReason('');
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abort Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the current workflow execution. The workflow record will be preserved for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Select value={selectedAbortReason} onValueChange={(v) => { setSelectedAbortReason(v); setCustomAbortReason(''); }}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Client cancelled">Client cancelled</SelectItem>
                <SelectItem value="Reschedule required">Reschedule required</SelectItem>
                <SelectItem value="Parts needed">Parts needed</SelectItem>
                <SelectItem value="Escalated">Escalated</SelectItem>
                <SelectItem value="Safety issue">Safety issue</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {selectedAbortReason === 'Other' && (
              <Textarea
                placeholder="Describe reason..."
                value={customAbortReason}
                onChange={(e) => setCustomAbortReason(e.target.value)}
                className="min-h-[60px]"
              />
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAbort}
              disabled={!effectiveAbortReason || abortExecution.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {abortExecution.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Abort Workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
