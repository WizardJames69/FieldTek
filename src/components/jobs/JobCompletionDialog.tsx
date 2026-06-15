import { useState, useEffect } from 'react';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VoiceInput } from '@/components/assistant/VoiceInput';

interface JobCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle?: string;
  onConfirm: (resolutionNotes: string) => void;
  /**
   * When true the completion is in flight: the action shows a spinner, inputs
   * lock, and the dialog can't be dismissed — so a failed submit (the parent
   * keeps `open` true) leaves the typed notes intact for a retry.
   */
  isSubmitting?: boolean;
}

const MIN_RESOLUTION_LENGTH = 10;

const RESOLUTION_TEMPLATES = [
  'Replaced capacitor and tested system',
  'Cleaned unit and verified operation',
  'Adjusted thermostat settings',
  'No issues found during inspection',
  'Repaired wiring and restored power',
  'Performed inspection and system operating normally',
] as const;

export function JobCompletionDialog({
  open,
  onOpenChange,
  jobTitle,
  onConfirm,
  isSubmitting = false,
}: JobCompletionDialogProps) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const isValid = resolutionNotes.trim().length >= MIN_RESOLUTION_LENGTH;

  // Reset only when the dialog actually closes. We intentionally do NOT clear on
  // confirm: if the submit fails the parent keeps the dialog open, and the typed
  // notes must survive for a retry.
  useEffect(() => {
    if (!open) {
      setResolutionNotes('');
      setSelectedTemplate(null);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!isValid || isSubmitting) return;
    onConfirm(resolutionNotes.trim());
  };

  const handleCancel = () => {
    setResolutionNotes('');
    setSelectedTemplate(null);
    onOpenChange(false);
  };

  const handleSelectTemplate = (tpl: string) => {
    setResolutionNotes(tpl);
    setSelectedTemplate(tpl);
  };

  const handleTextChange = (value: string) => {
    setResolutionNotes(value);
    if (selectedTemplate && value !== selectedTemplate) {
      setSelectedTemplate(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Complete Job
          </AlertDialogTitle>
          <AlertDialogDescription>
            {jobTitle
              ? `Please describe what was done to resolve "${jobTitle}".`
              : 'Please describe what was done to resolve this job.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="resolution-notes" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              Resolution Notes
            </Label>
            <VoiceInput
              maxDurationMs={15000}
              onTranscript={(text) => {
                setResolutionNotes((prev) => (prev ? prev + ' ' + text : text));
                setSelectedTemplate(null);
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {RESOLUTION_TEMPLATES.map((tpl) => (
              <Button
                key={tpl}
                type="button"
                variant={selectedTemplate === tpl ? 'secondary' : 'outline'}
                className="text-xs h-7 px-2.5"
                onClick={() => handleSelectTemplate(tpl)}
                disabled={isSubmitting}
              >
                {tpl}
              </Button>
            ))}
          </div>

          <Textarea
            id="resolution-notes"
            placeholder="Describe the repair actions taken, parts replaced, and final outcome..."
            value={resolutionNotes}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={4}
            className="resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            {resolutionNotes.trim().length < MIN_RESOLUTION_LENGTH
              ? `Minimum ${MIN_RESOLUTION_LENGTH} characters required (${resolutionNotes.trim().length}/${MIN_RESOLUTION_LENGTH})`
              : `${resolutionNotes.trim().length} characters`}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={!isValid || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Completing…
              </>
            ) : (
              'Complete Job'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
