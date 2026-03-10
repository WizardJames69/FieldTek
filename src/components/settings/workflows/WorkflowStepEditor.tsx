import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import {
  STEP_TYPES,
  STAGE_NAMES,
  type WorkflowTemplateStep,
  type StepType,
  type StageName,
  type EvidenceRequirements,
  type ValidationRules,
  type RequiredInputs,
} from '@/hooks/useWorkflowTemplates';

export interface StepDraft {
  localId: string;
  step_number: number;
  stage_name: StageName;
  title: string;
  instruction: string;
  instruction_detail: string | null;
  media_urls: string[] | null;
  step_type: StepType;
  required_inputs: RequiredInputs;
  evidence_requirements: EvidenceRequirements;
  validation_rules: ValidationRules;
  estimated_minutes: number | null;
  safety_warning: string | null;
}

interface WorkflowStepEditorProps {
  step: StepDraft;
  index: number;
  total: number;
  onUpdate: (localId: string, partial: Partial<StepDraft>) => void;
  onDelete: (localId: string) => void;
  onMove: (localId: string, direction: 'up' | 'down') => void;
}

export function WorkflowStepEditor({ step, index, total, onUpdate, onDelete, onMove }: WorkflowStepEditorProps) {
  const [expanded, setExpanded] = useState(false);

  const updateEvidence = (partial: Partial<EvidenceRequirements>) => {
    onUpdate(step.localId, { evidence_requirements: { ...step.evidence_requirements, ...partial } });
  };

  const updateValidation = (partial: Partial<ValidationRules>) => {
    onUpdate(step.localId, { validation_rules: { ...step.validation_rules, ...partial } });
  };

  const updateInputs = (partial: Partial<RequiredInputs>) => {
    onUpdate(step.localId, { required_inputs: { ...step.required_inputs, ...partial } });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5 shrink-0 pt-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove(step.localId, 'up')} disabled={index === 0}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove(step.localId, 'down')} disabled={index === total - 1}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Step number badge */}
        <span className="shrink-0 mt-2 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {index + 1}
        </span>

        {/* Main fields */}
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Step title"
              value={step.title}
              onChange={(e) => onUpdate(step.localId, { title: e.target.value })}
              className="flex-1"
            />
            <Select value={step.stage_name} onValueChange={(val) => onUpdate(step.localId, { stage_name: val as StageName })}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_NAMES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={step.step_type} onValueChange={(val) => onUpdate(step.localId, { step_type: val as StepType })}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Step instruction (shown to technician)"
            value={step.instruction}
            onChange={(e) => onUpdate(step.localId, { instruction: e.target.value })}
            className="min-h-[60px]"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(step.localId)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="pl-14 space-y-4 border-t pt-3">
          {/* Extended instruction */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Extended Guidance (optional)</label>
            <Textarea
              placeholder="Additional details, tips, or reference information"
              value={step.instruction_detail || ''}
              onChange={(e) => onUpdate(step.localId, { instruction_detail: e.target.value || null })}
              className="min-h-[50px]"
            />
          </div>

          {/* Duration + Safety */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Est. Minutes</label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 15"
                value={step.estimated_minutes ?? ''}
                onChange={(e) => onUpdate(step.localId, { estimated_minutes: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" /> Safety Warning
              </label>
              <Input
                placeholder="Displayed prominently to technician"
                value={step.safety_warning || ''}
                onChange={(e) => onUpdate(step.localId, { safety_warning: e.target.value || null })}
              />
            </div>
          </div>

          {/* Evidence Requirements */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Evidence Requirements</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={step.evidence_requirements.photo ?? false} onCheckedChange={(v) => updateEvidence({ photo: v })} />
                <span className="text-sm">Photo</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={step.evidence_requirements.measurement ?? false} onCheckedChange={(v) => updateEvidence({ measurement: v })} />
                <span className="text-sm">Measurement</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={step.evidence_requirements.gps_required ?? false} onCheckedChange={(v) => updateEvidence({ gps_required: v })} />
                <span className="text-sm">GPS</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={step.evidence_requirements.serial_scan ?? false} onCheckedChange={(v) => updateEvidence({ serial_scan: v })} />
                <span className="text-sm">Serial Scan</span>
              </div>
            </div>
          </div>

          {/* Measurement validation (shown when measurement evidence is required) */}
          {step.evidence_requirements.measurement && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Measurement Validation</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Unit</label>
                  <Input
                    placeholder="e.g. PSI"
                    value={step.required_inputs.measurement_unit || ''}
                    onChange={(e) => updateInputs({ measurement_unit: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Min Value</label>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={step.validation_rules.measurement_min ?? ''}
                    onChange={(e) => updateValidation({ measurement_min: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Value</label>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={step.validation_rules.measurement_max ?? ''}
                    onChange={(e) => updateValidation({ measurement_max: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Photo count validation (shown when photo evidence is required) */}
          {step.evidence_requirements.photo && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-muted-foreground">Required Photos</label>
              <Input
                type="number"
                min={1}
                className="w-20"
                placeholder="1"
                value={step.validation_rules.required_photos_count ?? ''}
                onChange={(e) => updateValidation({ required_photos_count: e.target.value ? parseInt(e.target.value) : undefined })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function createEmptyStep(stepNumber: number): StepDraft {
  return {
    localId: crypto.randomUUID(),
    step_number: stepNumber,
    stage_name: 'Service',
    title: '',
    instruction: '',
    instruction_detail: null,
    media_urls: null,
    step_type: 'action',
    required_inputs: {},
    evidence_requirements: {},
    validation_rules: {},
    estimated_minutes: null,
    safety_warning: null,
  };
}

export function stepFromDb(step: WorkflowTemplateStep): StepDraft {
  return {
    localId: step.id,
    step_number: step.step_number,
    stage_name: step.stage_name,
    title: step.title,
    instruction: step.instruction,
    instruction_detail: step.instruction_detail,
    media_urls: step.media_urls,
    step_type: step.step_type,
    required_inputs: step.required_inputs,
    evidence_requirements: step.evidence_requirements,
    validation_rules: step.validation_rules,
    estimated_minutes: step.estimated_minutes,
    safety_warning: step.safety_warning,
  };
}
