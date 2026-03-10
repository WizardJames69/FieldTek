import { Check, Circle, Minus } from 'lucide-react';
import type { EnrichedStep } from '@/hooks/useWorkflowExecution';

interface WorkflowProgressBarProps {
  steps: EnrichedStep[];
  currentStepNumber: number;
  onStepClick?: (stepNumber: number) => void;
}

const statusColors = {
  completed: 'bg-emerald-500 text-white',
  in_progress: 'bg-primary text-primary-foreground ring-2 ring-primary/30',
  pending: 'bg-muted text-muted-foreground',
  skipped: 'bg-amber-500 text-white',
};

const lineColors = {
  completed: 'bg-emerald-500',
  skipped: 'bg-amber-500',
  default: 'bg-border',
};

export function WorkflowProgressBar({ steps, currentStepNumber, onStepClick }: WorkflowProgressBarProps) {
  if (steps.length === 0) return null;

  // Compact mode for many steps
  const compact = steps.length > 8;

  if (compact) {
    const completed = steps.filter(
      (s) => s.stepExecution.status === 'completed' || s.stepExecution.status === 'skipped'
    ).length;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Step {currentStepNumber} of {steps.length}</span>
          <span className="text-muted-foreground">{completed} completed</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
        {/* Mini dots */}
        <div className="flex items-center gap-1 justify-center flex-wrap">
          {steps.map((step) => {
            const status = step.stepExecution.status;
            const isActive = step.stepExecution.step_number === currentStepNumber;
            return (
              <button
                key={step.stepExecution.id}
                type="button"
                onClick={() => onStepClick?.(step.stepExecution.step_number)}
                className={`h-2 rounded-full transition-all ${
                  isActive ? 'w-4 bg-primary' :
                  status === 'completed' ? 'w-2 bg-emerald-500' :
                  status === 'skipped' ? 'w-2 bg-amber-500' :
                  'w-2 bg-muted-foreground/30'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Step {currentStepNumber} of {steps.length}</span>
      </div>
      <div className="flex items-center">
        {steps.map((step, idx) => {
          const status = step.stepExecution.status;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.stepExecution.id} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <button
                type="button"
                onClick={() => onStepClick?.(step.stepExecution.step_number)}
                className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium transition-all ${statusColors[status]}`}
                title={`Step ${step.stepExecution.step_number}: ${step.templateStep.title}`}
              >
                {status === 'completed' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : status === 'skipped' ? (
                  <Minus className="h-3.5 w-3.5" />
                ) : status === 'in_progress' ? (
                  <Circle className="h-3 w-3 fill-current" />
                ) : (
                  step.stepExecution.step_number
                )}
              </button>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                    status === 'completed' ? lineColors.completed :
                    status === 'skipped' ? lineColors.skipped :
                    lineColors.default
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
