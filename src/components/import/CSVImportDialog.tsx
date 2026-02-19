import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CSVUploadStep } from './CSVUploadStep';
import { CSVMappingStep } from './CSVMappingStep';
import { CSVPreviewStep } from './CSVPreviewStep';
import { CSVResultStep } from './CSVResultStep';
import { 
  parseCSV, 
  autoDetectMappings,
  CLIENT_FIELDS,
  JOB_FIELDS,
  EQUIPMENT_FIELDS,
  type ParsedCSV,
  type ImportResult 
} from '@/lib/csvParser';
import { useCSVImport } from '@/hooks/useCSVImport';
import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';

export type ImportType = 'clients' | 'jobs' | 'equipment';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const STEPS = ['Upload', 'Map Columns', 'Preview', 'Results'] as const;
type Step = typeof STEPS[number];

export function CSVImportDialog({ open, onOpenChange, onSuccess }: CSVImportDialogProps) {
  const [importType, setImportType] = useState<ImportType>('clients');
  const [step, setStep] = useState<Step>('Upload');
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const { importClients, importJobs, importEquipment } = useCSVImport();
  const { duplicateIndices, duplicateCount, isChecking: isCheckingDuplicates } = useDuplicateDetection(
    importType,
    parsedCSV?.rows ?? null,
    mappings,
    step === 'Preview'
  );

  const getFieldDefinitions = () => {
    switch (importType) {
      case 'clients': return CLIENT_FIELDS;
      case 'jobs': return JOB_FIELDS;
      case 'equipment': return EQUIPMENT_FIELDS;
    }
  };

  const handleFileSelect = useCallback((content: string) => {
    const parsed = parseCSV(content);
    setParsedCSV(parsed);
    
    // Auto-detect mappings
    const detected = autoDetectMappings(parsed.headers, getFieldDefinitions());
    setMappings(detected);
    
    setStep('Map Columns');
  }, [importType]);

  const handleMappingConfirm = () => {
    setStep('Preview');
  };

  const handleImport = async () => {
    if (!parsedCSV) return;
    
    setIsImporting(true);
    try {
      let result: ImportResult;
      
      switch (importType) {
        case 'clients':
          result = await importClients(parsedCSV.rows, mappings);
          break;
        case 'jobs':
          result = await importJobs(parsedCSV.rows, mappings);
          break;
        case 'equipment':
          result = await importEquipment(parsedCSV.rows, mappings);
          break;
      }
      
      setImportResult(result);
      setStep('Results');
      
      if (result.success > 0) {
        onSuccess?.();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setStep('Upload');
    setParsedCSV(null);
    setMappings({});
    setImportResult(null);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleTypeChange = (type: string) => {
    setImportType(type as ImportType);
    handleReset();
  };

  const currentStepIndex = STEPS.indexOf(step);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Data from CSV
          </DialogTitle>
          <DialogDescription>
            Bulk import clients, jobs, or equipment from a spreadsheet file
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            {STEPS.map((s, i) => (
              <span 
                key={s} 
                className={i <= currentStepIndex ? 'text-primary font-medium' : ''}
              >
                {s}
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Import type selector (only on first step) */}
        {step === 'Upload' && (
          <Tabs value={importType} onValueChange={handleTypeChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clients">Clients</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Step content */}
        <ScrollArea className="flex-1 pr-4">
          <div className="py-4">
            {step === 'Upload' && (
              <CSVUploadStep 
                importType={importType}
                onFileSelect={handleFileSelect}
              />
            )}
            
            {step === 'Map Columns' && parsedCSV && (
              <CSVMappingStep
                headers={parsedCSV.headers}
                mappings={mappings}
                onMappingsChange={setMappings}
                fieldDefinitions={getFieldDefinitions()}
                importType={importType}
              />
            )}
            
            {step === 'Preview' && parsedCSV && (
              <CSVPreviewStep
                rows={parsedCSV.rows}
                mappings={mappings}
                fieldDefinitions={getFieldDefinitions()}
                importType={importType}
                duplicateIndices={duplicateIndices}
                duplicateCount={duplicateCount}
                isCheckingDuplicates={isCheckingDuplicates}
              />
            )}
            
            {step === 'Results' && importResult && (
              <CSVResultStep result={importResult} importType={importType} />
            )}
          </div>
        </ScrollArea>

        {/* Footer actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {step !== 'Upload' && step !== 'Results' && (
              <Button 
                variant="outline" 
                onClick={() => setStep(STEPS[currentStepIndex - 1])}
              >
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>
              {step === 'Results' ? 'Close' : 'Cancel'}
            </Button>
            
            {step === 'Map Columns' && (
              <Button onClick={handleMappingConfirm}>
                Continue to Preview
              </Button>
            )}
            
            {step === 'Preview' && (
              <Button 
                onClick={handleImport} 
                disabled={isImporting}
                className="min-w-[120px]"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import {parsedCSV?.rows.length} Records</>
                )}
              </Button>
            )}
            
            {step === 'Results' && (
              <Button onClick={handleReset}>
                Import More
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
