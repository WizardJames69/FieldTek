import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Circle, FileText, ClipboardCheck } from 'lucide-react';
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
 * (job_checklist_completions) for the admin/dispatcher job detail drawer.
 *
 * The editable JobStageWorkflow view is stage-template driven: it only
 * surfaces completions whose checklist_item matches a template item id for
 * the currently active stage of an in-progress job. Checklist rows created
 * outside that model (e.g. the technician mobile checklist, seeded jobs)
 * never match, so synced technician work was invisible / hard to find here.
 *
 * This is the clear, always-visible verification section: a high-contrast
 * card (readable in light and dark) showing progress, exactly which items
 * are done, the completion time, and any notes the technician synced.
 * Display only — no writes, no editing from admin.
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
  const allDone = completedCount === rows.length;
  const byStage = rows.reduce((acc, row) => {
    (acc[row.stage_name] ??= []).push(row);
    return acc;
  }, {} as Record<string, CompletionRow[]>);

  return (
    <div data-testid="job-checklist-results">
      <div className="section-divider" />
      <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <h4 className="font-semibold text-sm text-foreground">Checklist Verification</h4>
          </div>
          <span
            className={cn(
              'text-xs font-bold px-2.5 py-1 rounded-full shrink-0',
              allDone ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'
            )}
          >
            {completedCount}/{rows.length} done
          </span>
        </div>

        <div className="space-y-4">
          {Object.entries(byStage).map(([stage, items]) => (
            <div key={stage}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {stage}
              </p>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3',
                      item.completed
                        ? 'border-success/30 bg-success/5'
                        : 'border-border bg-muted/40'
                    )}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground/60" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {item.checklist_item}
                      </p>
                      {item.completed && item.completed_at && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Completed {format(new Date(item.completed_at), 'MMM d, h:mm a')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-2 flex items-start gap-1.5 text-sm text-foreground/90 bg-background rounded-lg border border-border/60 px-2.5 py-2">
                          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="whitespace-pre-wrap break-words">{item.notes}</span>
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
    </div>
  );
}
