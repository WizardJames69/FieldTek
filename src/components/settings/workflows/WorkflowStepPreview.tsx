import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Camera, Ruler, MapPin, Barcode, Clock } from 'lucide-react';
import type { StepDraft } from './WorkflowStepEditor';

interface WorkflowStepPreviewProps {
  step: StepDraft;
  index: number;
}

const stepTypeColors: Record<string, string> = {
  action: 'bg-blue-100 text-blue-800',
  inspection: 'bg-green-100 text-green-800',
  measurement: 'bg-purple-100 text-purple-800',
  decision: 'bg-amber-100 text-amber-800',
};

export function WorkflowStepPreview({ step, index }: WorkflowStepPreviewProps) {
  const ev = step.evidence_requirements;
  const hasEvidence = ev.photo || ev.measurement || ev.gps_required || ev.serial_scan;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">{step.title || 'Untitled Step'}</h4>
            <Badge variant="outline" className="text-xs">{step.stage_name}</Badge>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stepTypeColors[step.step_type] || ''}`}>
              {step.step_type}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{step.instruction || 'No instruction provided'}</p>

          {step.instruction_detail && (
            <p className="text-xs text-muted-foreground mt-1 italic">{step.instruction_detail}</p>
          )}

          {step.safety_warning && (
            <div className="flex items-center gap-1.5 mt-2 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{step.safety_warning}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {step.estimated_minutes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {step.estimated_minutes} min
              </span>
            )}
            {hasEvidence && (
              <div className="flex items-center gap-2">
                {ev.photo && <Camera className="h-3.5 w-3.5 text-muted-foreground" />}
                {ev.measurement && <Ruler className="h-3.5 w-3.5 text-muted-foreground" />}
                {ev.gps_required && <MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                {ev.serial_scan && <Barcode className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
