import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { ImportType } from './CSVImportDialog';

interface CSVUploadStepProps {
  importType: ImportType;
  onFileSelect: (content: string) => void;
}

const TEMPLATE_DATA: Record<ImportType, { headers: string[]; sample: string[] }> = {
  clients: {
    headers: ['name', 'email', 'phone', 'address', 'city', 'state', 'zip_code', 'notes'],
    sample: ['Acme Corporation', 'contact@acme.com', '555-123-4567', '123 Main St', 'New York', 'NY', '10001', 'VIP customer'],
  },
  jobs: {
    headers: ['title', 'description', 'client_name', 'job_type', 'priority', 'status', 'scheduled_date', 'address'],
    sample: ['HVAC Maintenance', 'Annual inspection', 'Acme Corporation', 'Maintenance', 'medium', 'pending', '2025-02-15', '123 Main St'],
  },
  equipment: {
    headers: ['equipment_type', 'brand', 'model', 'serial_number', 'client_name', 'install_date', 'warranty_expiry', 'status'],
    sample: ['Air Conditioner', 'Carrier', 'XR15', 'AC-2024-001', 'Acme Corporation', '2024-03-15', '2029-03-15', 'active'],
  },
};

export function CSVUploadStep({ importType, onFileSelect }: CSVUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File size must be less than 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onFileSelect(content);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const { headers, sample } = TEMPLATE_DATA[importType];
    const csvContent = [
      headers.join(','),
      sample.join(','),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}_import_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeLabel = importType === 'clients' ? 'Clients' : importType === 'jobs' ? 'Jobs' : 'Equipment';

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          'hover:border-primary/50 hover:bg-muted/30',
          isDragging && 'border-primary bg-primary/5',
          error && 'border-destructive'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <p className="text-lg font-medium">
              Drop your CSV file here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Choose File
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Template download */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="font-medium">Need a template?</h4>
        <p className="text-sm text-muted-foreground">
          Download our CSV template for {typeLabel.toLowerCase()} with all supported columns pre-configured.
        </p>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download {typeLabel} Template
        </Button>
      </div>

      {/* Import limits note */}
      <p className="text-xs text-muted-foreground">
        Maximum 1,000 rows per import. Fields longer than 1,000 characters will be truncated.
      </p>

      {/* Column hints */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Expected Columns</h4>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_DATA[importType].headers.map((col, i) => (
            <span 
              key={col}
              className={cn(
                'px-2 py-1 text-xs rounded-full',
                i === 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {col}{i === 0 && ' *'}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">* Required field</p>
      </div>
    </div>
  );
}
