import { CheckCircle2, AlertCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateRow, parseDate, parsePriority, parseStatus, parseEquipmentStatus } from '@/lib/csvParser';
import type { ImportType } from './CSVImportDialog';

interface FieldDefinition {
  field: string;
  aliases: string[];
  required?: boolean;
}

interface CSVPreviewStepProps {
  rows: Record<string, string>[];
  mappings: Record<string, string>;
  fieldDefinitions: FieldDefinition[];
  importType: ImportType;
  duplicateIndices?: Set<number>;
  duplicateCount?: number;
  isCheckingDuplicates?: boolean;
}

export function CSVPreviewStep({ rows, mappings, fieldDefinitions, importType, duplicateIndices = new Set(), duplicateCount = 0, isCheckingDuplicates = false }: CSVPreviewStepProps) {
  const requiredFields = fieldDefinitions.filter(f => f.required).map(f => f.field);
  const mappedFields = Object.entries(mappings);
  
  // Validate all rows
  const validationResults = rows.map((row, index) => {
    const error = validateRow(row, mappings, requiredFields);
    return { row, index, error, isValid: !error };
  });
  
  const validCount = validationResults.filter(r => r.isValid).length;
  const invalidCount = validationResults.filter(r => !r.isValid).length;
  
  // Preview up to 10 rows
  const previewRows = validationResults.slice(0, 10);
  
  const getFieldLabel = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatPreviewValue = (value: string, field: string) => {
    if (!value?.trim()) return <span className="text-muted-foreground italic">—</span>;
    
    // Format based on field type
    if (field === 'priority') {
      const priority = parsePriority(value);
      const colors: Record<string, string> = {
        low: 'bg-slate-100 text-slate-700',
        medium: 'bg-blue-100 text-blue-700',
        high: 'bg-orange-100 text-orange-700',
        urgent: 'bg-red-100 text-red-700',
      };
      return <Badge className={colors[priority]}>{priority}</Badge>;
    }
    
    if (field === 'status' && importType === 'jobs') {
      const status = parseStatus(value);
      return <Badge variant="outline">{status.replace('_', ' ')}</Badge>;
    }
    
    if (field === 'status' && importType === 'equipment') {
      const status = parseEquipmentStatus(value);
      return <Badge variant="outline">{status}</Badge>;
    }
    
    if (field.includes('date')) {
      const date = parseDate(value);
      if (date) return date.toLocaleDateString();
    }
    
    // Truncate long values
    if (value.length > 30) {
      return value.substring(0, 30) + '...';
    }
    
    return value;
  };

  const typeLabel = importType === 'clients' ? 'clients' : importType === 'jobs' ? 'jobs' : 'equipment';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-medium">Preview Import Data</h3>
        <p className="text-sm text-muted-foreground">
          Review the data before importing. Showing first 10 of {rows.length} records.
        </p>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>{validCount} valid {typeLabel}</span>
        </div>
        {invalidCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>{invalidCount} with errors</span>
          </div>
        )}
        {isCheckingDuplicates && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking for duplicates…</span>
          </div>
        )}
        {!isCheckingDuplicates && duplicateCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span>{duplicateCount} possible duplicate{duplicateCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {invalidCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {invalidCount} record(s) have validation errors and will be skipped during import.
          </AlertDescription>
        </Alert>
      )}

      {!isCheckingDuplicates && duplicateCount > 0 && (
        <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-300">
            {duplicateCount} record(s) may already exist in your database. They will still be imported unless you remove them from your file.
          </AlertDescription>
        </Alert>
      )}

      {/* Data preview table */}
      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-12">Status</TableHead>
                {mappedFields.map(([csv, field]) => (
                  <TableHead key={csv} className="min-w-[120px]">
                    {getFieldLabel(field)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map(({ row, index, isValid, error }) => {
                const isDuplicate = duplicateIndices.has(index);
                const rowClassName = !isValid
                  ? 'bg-destructive/5'
                  : isDuplicate
                    ? 'bg-yellow-50 dark:bg-yellow-950/20'
                    : undefined;

                return (
                <TableRow 
                  key={index}
                  className={rowClassName}
                >
                  <TableCell className="text-muted-foreground text-xs">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {!isValid ? (
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-destructive" />
                      </div>
                    ) : isDuplicate ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </TableCell>
                  {mappedFields.map(([csvCol, field]) => (
                    <TableCell key={csvCol} className="text-sm">
                      {formatPreviewValue(row[csvCol] || '', field)}
                    </TableCell>
                  ))}
                  {isDuplicate && isValid && (
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">
                        Duplicate
                      </Badge>
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {rows.length > 10 && (
        <p className="text-sm text-muted-foreground text-center">
          ... and {rows.length - 10} more records
        </p>
      )}

      {/* Import summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium">Ready to Import</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• {validCount} {typeLabel} will be created</li>
          {invalidCount > 0 && (
            <li className="text-destructive">• {invalidCount} records will be skipped due to errors</li>
          )}
          {duplicateCount > 0 && (
            <li className="text-yellow-700 dark:text-yellow-400">• {duplicateCount} possible duplicate(s) — will still be imported</li>
          )}
          <li>• {mappedFields.length} fields mapped from {Object.keys(rows[0] || {}).length} CSV columns</li>
        </ul>
      </div>
    </div>
  );
}
