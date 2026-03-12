import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ChevronDown, ChevronUp, Check, SkipForward } from 'lucide-react';
import { StepEvidenceCapture } from '@/components/mobile/StepEvidenceCapture';
import {
  type EvidenceRequirement,
  type StepEvidence,
  getItemEvidence,
  isEvidenceComplete,
} from '@/hooks/useStepEvidence';
import type { EnrichedStep, StepCompletionData } from '@/hooks/useWorkflowExecution';

interface WorkflowStepCardProps {
  step: EnrichedStep;
  jobId: string;
  isCurrentStep: boolean;
  allEvidence: StepEvidence[];
  onComplete: (data: StepCompletionData) => void;
  onSkip: (reason: string) => void;
}

const stepTypeColors: Record<string, string> = {
  action: 'bg-blue-100 text-blue-800',
  inspection: 'bg-green-100 text-green-800',
  measurement: 'bg-purple-100 text-purple-800',
  decision: 'bg-amber-100 text-amber-800',
};

const stageColors: Record<string, string> = {
  Startup: 'bg-sky-100 text-sky-800',
  Service: 'bg-indigo-100 text-indigo-800',
  Maintenance: 'bg-teal-100 text-teal-800',
  Inspection: 'bg-orange-100 text-orange-800',
};

/**
 * Convert workflow template evidence_requirements + validation_rules + required_inputs
 * into the EvidenceRequirement shape that StepEvidenceCapture expects.
 */
function toEvidenceRequirement(step: EnrichedStep): EvidenceRequirement | null {
  const ev = step.templateStep.evidence_requirements;
  const vr = step.templateStep.validation_rules;
  const ri = step.templateStep.required_inputs;

  const hasAny = ev.photo || ev.measurement || ev.gps_required || ev.serial_scan;
  if (!hasAny) return null;

  const req: EvidenceRequirement = {};

  if (ev.photo) req.photo = true;
  if (ev.gps_required) req.gps_required = true;
  if (ev.serial_scan) req.serial_scan = true;
  if (ev.measurement) {
    req.measurement = {
      unit: ri.measurement_unit || 'units',
      min: vr.measurement_min,
      max: vr.measurement_max,
    };
  }

  return req;
}

export function WorkflowStepCard({
  step,
  jobId,
  isCurrentStep,
  allEvidence,
  onComplete,
  onSkip,
}: WorkflowStepCardProps) {
  const [notes, setNotes] = useState(step.stepExecution.technician_notes || '');
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [selectedSkipReason, setSelectedSkipReason] = useState('');
  const [customSkipReason, setCustomSkipReason] = useState('');

  const status = step.stepExecution.status;
  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';
  const isReadOnly = !isCurrentStep || isCompleted || isSkipped;

  const evidenceReq = toEvidenceRequirement(step);
  const stepEvidence = getItemEvidence(allEvidence, step.stepExecution.id);
  const evidenceSatisfied = !evidenceReq || isEvidenceComplete(stepEvidence, evidenceReq);

  const handleComplete = () => {
    onComplete({ technician_notes: notes || undefined });
  };

  const effectiveSkipReason = selectedSkipReason === 'Other'
    ? customSkipReason.trim()
    : selectedSkipReason;

  const handleSkip = () => {
    if (effectiveSkipReason) {
      onSkip(effectiveSkipReason);
      setSkipDialogOpen(false);
      setSelectedSkipReason('');
      setCustomSkipReason('');
    }
  };

  return (
    <Card className={`transition-all ${
      isCurrentStep ? 'ring-2 ring-primary/50 shadow-md' :
      isCompleted ? 'opacity-80' :
      isSkipped ? 'opacity-60' : ''
    }`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${
              isCompleted ? 'bg-emerald-500 text-white' :
              isSkipped ? 'bg-amber-500 text-white' :
              isCurrentStep ? 'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground'
            }`}>
              {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.stepExecution.step_number}
            </span>
            <h4 className="font-medium text-sm">{step.templateStep.title}</h4>
            <Badge variant="outline" className={`text-xs ${stageColors[step.templateStep.stage_name] || ''}`}>
              {step.templateStep.stage_name}
            </Badge>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stepTypeColors[step.templateStep.step_type] || ''}`}>
              {step.templateStep.step_type}
            </span>
          </div>
          {isCompleted && <Badge variant="default" className="text-xs shrink-0">Completed</Badge>}
          {isSkipped && <Badge variant="secondary" className="text-xs shrink-0">Skipped</Badge>}
        </div>

        {/* Safety Warning */}
        {step.templateStep.safety_warning && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{step.templateStep.safety_warning}</span>
          </div>
        )}

        {/* Instruction */}
        <p className="text-sm text-muted-foreground">{step.templateStep.instruction}</p>

        {/* Extended guidance */}
        {step.templateStep.instruction_detail && (
          <div>
            <button
              type="button"
              onClick={() => setDetailExpanded(!detailExpanded)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {detailExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {detailExpanded ? 'Hide details' : 'Show details'}
            </button>
            {detailExpanded && (
              <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded italic">
                {step.templateStep.instruction_detail}
              </p>
            )}
          </div>
        )}

        {/* Media */}
        {step.templateStep.media_urls && step.templateStep.media_urls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {step.templateStep.media_urls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`Reference ${idx + 1}`}
                className="h-20 w-20 object-cover rounded-lg border shrink-0"
              />
            ))}
          </div>
        )}

        {/* Evidence Capture */}
        {evidenceReq && !isReadOnly && (
          <StepEvidenceCapture
            jobId={jobId}
            checklistItemId={step.stepExecution.id}
            stageName={step.templateStep.stage_name}
            requirement={evidenceReq}
            existingEvidence={stepEvidence}
          />
        )}

        {/* Completed evidence summary */}
        {evidenceReq && isReadOnly && stepEvidence.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <span className="font-medium">Evidence captured:</span>
            <div className="flex gap-2 flex-wrap">
              {stepEvidence.map((e) => (
                <Badge key={e.id} variant="outline" className="text-xs">
                  {e.evidence_type} — {e.verification_status}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Technician Notes */}
        {!isReadOnly ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
            <Textarea
              placeholder="Add notes about this step..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[50px] text-sm"
            />
          </div>
        ) : step.stepExecution.technician_notes ? (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Notes:</span> {step.stepExecution.technician_notes}
          </div>
        ) : null}

        {/* Skipped reason */}
        {isSkipped && step.stepExecution.skipped_reason && (
          <div className="text-xs text-amber-600">
            <span className="font-medium">Skip reason:</span> {step.stepExecution.skipped_reason}
          </div>
        )}

        {/* Actions */}
        {isCurrentStep && !isCompleted && !isSkipped && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              onClick={handleComplete}
              disabled={!evidenceSatisfied}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-1" />
              Complete Step
            </Button>
            {!skipDialogOpen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSkipDialogOpen(true)}
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={selectedSkipReason} onValueChange={(v) => { setSelectedSkipReason(v); setCustomSkipReason(''); }}>
                    <SelectTrigger className="w-48 h-10 text-sm">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Not applicable">Not applicable</SelectItem>
                      <SelectItem value="Already completed">Already completed</SelectItem>
                      <SelectItem value="Client declined">Client declined</SelectItem>
                      <SelectItem value="Part unavailable">Part unavailable</SelectItem>
                      <SelectItem value="Access blocked">Access blocked</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleSkip} disabled={!effectiveSkipReason}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setSkipDialogOpen(false); setSelectedSkipReason(''); setCustomSkipReason(''); }}>
                    Cancel
                  </Button>
                </div>
                {selectedSkipReason === 'Other' && (
                  <Textarea
                    placeholder="Describe reason..."
                    value={customSkipReason}
                    onChange={(e) => setCustomSkipReason(e.target.value)}
                    className="min-h-[40px] text-sm"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Duration info */}
        {step.templateStep.estimated_minutes && (
          <div className="text-xs text-muted-foreground">
            Est. {step.templateStep.estimated_minutes} min
          </div>
        )}
      </CardContent>
    </Card>
  );
}
