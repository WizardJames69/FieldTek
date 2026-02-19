import { CheckCircle2, XCircle, AlertCircle, PartyPopper } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ImportResult } from '@/lib/csvParser';
import type { ImportType } from './CSVImportDialog';

interface CSVResultStepProps {
  result: ImportResult;
  importType: ImportType;
}

export function CSVResultStep({ result, importType }: CSVResultStepProps) {
  const { success, failed, errors } = result;
  const total = success + failed;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
  
  const typeLabel = importType === 'clients' ? 'clients' : importType === 'jobs' ? 'jobs' : 'equipment';
  const typeLabelSingular = importType === 'clients' ? 'client' : importType === 'jobs' ? 'job' : 'equipment';

  return (
    <div className="space-y-6">
      {/* Success header */}
      {success > 0 && (
        <div className="text-center space-y-4 py-6">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <PartyPopper className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold">Import Complete!</h3>
            <p className="text-muted-foreground">
              Successfully imported {success} {success === 1 ? typeLabelSingular : typeLabel}
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold">{total}</div>
          <div className="text-sm text-muted-foreground">Total Records</div>
        </div>
        <div className="border rounded-lg p-4 text-center bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {success}
          </div>
          <div className="text-sm text-green-600/80 dark:text-green-400/80">Imported</div>
        </div>
        <div className={cn(
          'border rounded-lg p-4 text-center',
          failed > 0 
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
            : 'bg-muted/50'
        )}>
          <div className={cn(
            'text-3xl font-bold',
            failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
          )}>
            {failed}
          </div>
          <div className={cn(
            'text-sm',
            failed > 0 ? 'text-red-600/80 dark:text-red-400/80' : 'text-muted-foreground'
          )}>Failed</div>
        </div>
      </div>

      {/* Success rate */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Success Rate</span>
          <span className="font-medium">{successRate}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>

      {/* Errors list */}
      {errors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h4 className="font-medium">Failed Records</h4>
          </div>
          
          <ScrollArea className="h-[200px] border rounded-lg">
            <div className="p-3 space-y-2">
              {errors.map(({ row, error }, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-2 text-sm p-2 bg-destructive/5 rounded"
                >
                  <Badge variant="outline" className="shrink-0">
                    Row {row}
                  </Badge>
                  <span className="text-destructive">{error}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Success message */}
      {success > 0 && failed === 0 && (
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            All records were imported successfully! You can now view your {typeLabel} in the application.
          </AlertDescription>
        </Alert>
      )}

      {/* Partial success message */}
      {success > 0 && failed > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {success} {success === 1 ? typeLabelSingular : typeLabel} imported successfully. 
            {failed} record(s) failed due to validation errors.
          </AlertDescription>
        </Alert>
      )}

      {/* Complete failure message */}
      {success === 0 && failed > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            No records could be imported. Please check your CSV file and column mappings, then try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
