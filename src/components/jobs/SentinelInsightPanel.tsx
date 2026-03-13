import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, CircleCheck, Wrench } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDiagnosticSuggestions, type DiagnosticSuggestion } from '@/hooks/useDiagnosticSuggestions';
import { getSymptomLabel } from '@/lib/symptomDetection';

interface SentinelInsightPanelProps {
  jobId: string;
  jobDescription: string | null;
  jobNotes: string | null;
  jobType: string | null;
  equipmentId: string | null;
  equipmentModel: string | null;
  defaultExpanded?: boolean;
}

const confidenceColors = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  moderate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
} as const;

const progressBarColors = {
  high: 'bg-emerald-500',
  moderate: 'bg-amber-500',
  low: 'bg-gray-400',
} as const;

export function SentinelInsightPanel({
  jobDescription,
  jobNotes,
  jobType,
  equipmentId,
  equipmentModel,
  defaultExpanded = false,
}: SentinelInsightPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { data, isLoading } = useDiagnosticSuggestions(
    jobDescription,
    jobNotes,
    jobType,
    equipmentId,
    equipmentModel,
    expanded,
  );

  const hasCauses = data && data.causes.length > 0;
  const hasChecks = data && data.checks.length > 0;
  const hasRepairs = data && data.repairs.length > 0;
  const hasAnyData = hasCauses || hasChecks || hasRepairs;
  const hasSymptoms = data && data.symptomsDetected.length > 0;

  return (
    <Card className="border-primary/20">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 min-h-[48px] text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">Sentinel Insights</span>
          {data && data.dataQuality !== 'none' && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Based on {data.totalOccurrences} similar jobs
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data && data.dataQuality !== 'none' && (
            <Badge variant="outline" className={`text-xs ${confidenceColors[data.dataQuality]}`}>
              {data.dataQuality}
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !hasAnyData && (
            <p className="text-xs text-muted-foreground py-2">
              {hasSymptoms
                ? 'No diagnostic patterns found for the detected symptoms yet.'
                : 'No diagnostic patterns found for this job type yet.'}
            </p>
          )}

          {/* Observed Symptoms */}
          {!isLoading && hasSymptoms && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Observed Symptoms
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data!.symptomsDetected.map((key) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {getSymptomLabel(key)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Possible Causes */}
          {!isLoading && hasCauses && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Possible Causes
              </h4>
              <div className="space-y-2.5">
                {data!.causes.map((cause, idx) => (
                  <CauseRow key={idx} cause={cause} rank={idx + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Suggested Checks */}
          {!isLoading && hasChecks && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Suggested Checks
              </h4>
              <ul className="space-y-1.5">
                {data!.checks.map((check, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs">
                    <CircleCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1">{check.label}</span>
                    {check.successRate > 0 && (
                      <span className="text-muted-foreground">
                        {Math.round(check.successRate)}% success
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Common Repairs */}
          {!isLoading && hasRepairs && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Common Repairs
              </h4>
              <ul className="space-y-1.5">
                {data!.repairs.map((repair, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span>{repair.repairs.join(', ')}</span>
                      <span className="text-muted-foreground ml-1.5">
                        ({repair.successRate}% success · {repair.occurrences} jobs)
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function CauseRow({ cause, rank }: { cause: DiagnosticSuggestion; rank: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
          {rank}
        </span>
        <span className="text-sm flex-1 min-w-0 truncate">
          {cause.failureComponent ?? cause.repairAction}
        </span>
        <span className="text-sm font-medium tabular-nums shrink-0">{cause.likelihood}%</span>
        <Badge variant="outline" className={`text-xs shrink-0 ${confidenceColors[cause.confidence]}`}>
          {cause.confidence}
        </Badge>
      </div>
      {/* Progress bar */}
      <div className="ml-7 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressBarColors[cause.confidence]}`}
          style={{ width: `${Math.min(cause.likelihood, 100)}%` }}
        />
      </div>
      {/* Best repair highlight */}
      {cause.bestRepair && (
        <p className="ml-7 text-xs text-primary">
          Best repair: {cause.bestRepair}
        </p>
      )}
    </div>
  );
}
