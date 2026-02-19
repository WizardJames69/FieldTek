import { ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { ImportType } from './CSVImportDialog';

interface FieldDefinition {
  field: string;
  aliases: string[];
  required?: boolean;
}

interface CSVMappingStepProps {
  headers: string[];
  mappings: Record<string, string>;
  onMappingsChange: (mappings: Record<string, string>) => void;
  fieldDefinitions: FieldDefinition[];
  importType: ImportType;
}

export function CSVMappingStep({ 
  headers, 
  mappings, 
  onMappingsChange,
  fieldDefinitions,
  importType 
}: CSVMappingStepProps) {
  const requiredFields = fieldDefinitions.filter(f => f.required).map(f => f.field);
  const mappedFields = Object.values(mappings);
  const missingRequired = requiredFields.filter(f => !mappedFields.includes(f));

  const handleMappingChange = (csvColumn: string, targetField: string) => {
    const newMappings = { ...mappings };
    
    if (targetField === 'skip') {
      delete newMappings[csvColumn];
    } else {
      // Remove any existing mapping to this target field
      Object.keys(newMappings).forEach(key => {
        if (newMappings[key] === targetField) {
          delete newMappings[key];
        }
      });
      newMappings[csvColumn] = targetField;
    }
    
    onMappingsChange(newMappings);
  };

  const getFieldLabel = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const typeLabel = importType === 'clients' ? 'Client' : importType === 'jobs' ? 'Job' : 'Equipment';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-medium">Map CSV Columns to {typeLabel} Fields</h3>
        <p className="text-sm text-muted-foreground">
          Match your CSV columns to the corresponding {typeLabel.toLowerCase()} fields. 
          We've auto-detected some mappings for you.
        </p>
      </div>

      {missingRequired.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Missing required mappings: {missingRequired.map(getFieldLabel).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Mapping table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 p-3 bg-muted/50 border-b font-medium text-sm">
          <div>CSV Column</div>
          <div></div>
          <div>{typeLabel} Field</div>
        </div>
        
        <div className="divide-y">
          {headers.map((header) => {
            const currentMapping = mappings[header];
            const isRequired = requiredFields.includes(currentMapping);
            const isMapped = !!currentMapping;
            
            return (
              <div 
                key={header}
                className={cn(
                  'grid grid-cols-[1fr,auto,1fr] gap-4 p-3 items-center',
                  isMapped && 'bg-primary/5'
                )}
              >
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {header}
                  </code>
                </div>
                
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                
                <div className="flex items-center gap-2">
                  <Select
                    value={currentMapping || 'skip'}
                    onValueChange={(value) => handleMappingChange(header, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Skip this column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">
                        <span className="text-muted-foreground">Skip this column</span>
                      </SelectItem>
                      {fieldDefinitions.map((field) => {
                        const isAlreadyMapped = mappedFields.includes(field.field) && currentMapping !== field.field;
                        return (
                          <SelectItem 
                            key={field.field} 
                            value={field.field}
                            disabled={isAlreadyMapped}
                          >
                            <span className="flex items-center gap-2">
                              {getFieldLabel(field.field)}
                              {field.required && (
                                <Badge variant="outline" className="text-[10px] px-1">
                                  Required
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  
                  {isMapped && (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>{Object.keys(mappings).length} columns mapped</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>{headers.length - Object.keys(mappings).length} columns skipped</span>
        </div>
      </div>
    </div>
  );
}
