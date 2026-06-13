import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Circle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CompletionRow {
  id: string;
  stage_name: string;
  checklist_item: string;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
}

/**
 * Read-only view of a job's raw checklist completion rows
 * (job_checklist_completions) for the admin/dispatcher job detail sheet.
 *
 * The editable JobStageWorkflow view is stage-template driven: it only
 * surfaces completions whose checklist_item matches a template item id for
 * the currently active stage of an in-progress job. Checklist rows created
 * outside that model (e.g. the technician mobile checklist, seeded jobs)
 * never match, so synced technician work was invisible here. This section
 * lists what is actually stored, so an admin can verify a technician's
 * synced checklist state and notes at a glance. Display only — no writes.
 */
export function JobChecklistResults({ jobId }: { jobId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ['job-checklist-results', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_checklist_completions')
        .select('id, stage_name, checklist_item, completed, completed_at, notes')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CompletionRow[];
    },
    enabled: !!jobId,
  });

  if (rows.length === 0) return null;

  const completedCount = rows.filter((r) => r.completed).length;
  const byStage = rows.reduce((acc, row) => {
    (acc[row.stage_name] ??= []).push(row);
    return acc;
  }, {} as Record<string, CompletionRow[]>);

  return (
    <div data-testid="job-checklist-results">
      <div className="section-divider" />
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">
          Checklist Results
        </h4>
        <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
          {completedCount}/{rows.length} done
        </span>
      </div>
      <div className="space-y-4">
        {Object.entries(byStage).map(([stage, items]) => (
          <div key={stage} className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {stage}
            </p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 text-sm">
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('leading-snug', item.completed && 'text-muted-foreground')}>
                      {item.checklist_item}
                      {item.completed && item.completed_at && (
                        <span className="ml-2 text-xs text-muted-foreground/80">
                          {format(new Date(item.completed_at), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </p>
                    {item.notes && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5">
                        <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{item.notes}</span>
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
