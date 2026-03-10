import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ListChecks, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { usePublishedTemplates, useStartExecution } from '@/hooks/useWorkflowExecution';

interface WorkflowAssignDialogProps {
  jobId: string;
  jobType: string | null;
  equipmentType: string | null;
  technicianId: string | null;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (executionId: string) => void;
}

const categoryColors: Record<string, string> = {
  installation: 'bg-blue-100 text-blue-800',
  repair: 'bg-red-100 text-red-800',
  maintenance: 'bg-green-100 text-green-800',
  inspection: 'bg-purple-100 text-purple-800',
  diagnostic: 'bg-amber-100 text-amber-800',
};

export function WorkflowAssignDialog({
  jobId,
  jobType,
  equipmentType,
  technicianId,
  tenantId,
  open,
  onOpenChange,
  onAssigned,
}: WorkflowAssignDialogProps) {
  const { data: templates, isLoading } = usePublishedTemplates(equipmentType);
  const startExecution = useStartExecution();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAssign = async () => {
    if (!selectedId || !technicianId) return;

    try {
      const { executionId } = await startExecution.mutateAsync({
        jobId,
        workflowId: selectedId,
        technicianId,
        tenantId,
      });
      toast.success('Workflow assigned');
      onAssigned?.(executionId);
      onOpenChange(false);
      setSelectedId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign workflow');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Workflow Template</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No published workflow templates available.
            {equipmentType && <span> Try removing the equipment type filter.</span>}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {templates.map((t: any) => {
              const stepCount = t.workflow_template_steps?.[0]?.count ?? 0;
              const isSelected = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.name}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[t.category] || ''}`}>
                      {t.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3 w-3" /> {stepCount} steps
                    </span>
                    {t.estimated_duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {t.estimated_duration_minutes} min
                      </span>
                    )}
                    {t.equipment_type && <span>{t.equipment_type}</span>}
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!technicianId && (
          <p className="text-xs text-amber-600">
            A technician must be assigned to the job before a workflow can be started.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedId || !technicianId || startExecution.isPending}
          >
            {startExecution.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Assign Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
