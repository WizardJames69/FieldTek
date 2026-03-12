import { useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
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

interface JobCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle?: string;
  onConfirm: (resolutionNotes: string) => void;
}

const MIN_RESOLUTION_LENGTH = 10;

export function JobCompletionDialog({
  open,
  onOpenChange,
  jobTitle,
  onConfirm,
}: JobCompletionDialogProps) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const isValid = resolutionNotes.trim().length >= MIN_RESOLUTION_LENGTH;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(resolutionNotes.trim());
    setResolutionNotes('');
  };

  const handleCancel = () => {
    setResolutionNotes('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
          <Label htmlFor="resolution-notes" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Resolution Notes
          </Label>
          <Textarea
            id="resolution-notes"
            placeholder="Describe the repair actions taken, parts replaced, and final outcome..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {resolutionNotes.trim().length < MIN_RESOLUTION_LENGTH
              ? `Minimum ${MIN_RESOLUTION_LENGTH} characters required (${resolutionNotes.trim().length}/${MIN_RESOLUTION_LENGTH})`
              : `${resolutionNotes.trim().length} characters`}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!isValid}>
            Complete Job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
