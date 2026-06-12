import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
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

interface ComplianceOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names of the blocking rules being overridden, shown for context. */
  ruleNames?: string[];
  /** True while the override RPC is in flight. */
  isSubmitting?: boolean;
  onConfirm: (reason: string) => void;
}

const MIN_REASON_LENGTH = 10;

export function ComplianceOverrideDialog({
  open,
  onOpenChange,
  ruleNames,
  isSubmitting = false,
  onConfirm,
}: ComplianceOverrideDialogProps) {
  const [reason, setReason] = useState('');
  const isValid = reason.trim().length >= MIN_REASON_LENGTH;

  const handleConfirm = () => {
    if (!isValid || isSubmitting) return;
    onConfirm(reason.trim());
    // Parent closes the dialog on success; reset for the next open.
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Override Compliance Block
          </AlertDialogTitle>
          <AlertDialogDescription>
            {ruleNames && ruleNames.length > 0
              ? `You are overriding a compliance block on this stage (${ruleNames.join(', ')}). `
              : 'You are overriding a compliance block on this stage. '}
            This is recorded against your account with the reason below. The block stays
            overridden for this rule and stage until conditions change.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="override-reason">Reason for override</Label>
          <Textarea
            id="override-reason"
            placeholder="Explain why this block is being overridden (e.g. verified out-of-band, documented exception)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            {reason.trim().length < MIN_REASON_LENGTH
              ? `Minimum ${MIN_REASON_LENGTH} characters required (${reason.trim().length}/${MIN_REASON_LENGTH})`
              : `${reason.trim().length} characters`}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog open on invalid/in-flight so the user can correct it.
              if (!isValid || isSubmitting) {
                e.preventDefault();
                return;
              }
              handleConfirm();
            }}
            disabled={!isValid || isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
          >
            {isSubmitting ? 'Overriding…' : 'Override block'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
