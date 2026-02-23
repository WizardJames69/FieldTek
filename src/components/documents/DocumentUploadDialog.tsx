import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, FileText, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useUsageStats } from '@/hooks/useUsageStats';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  file: z.any().refine((file) => file instanceof File, 'File is required'),
});

type FormData = z.infer<typeof formSchema>;

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DOCUMENT_CATEGORIES = [
  'Manual',
  'Warranty',
  'Service Guide',
  'Parts List',
  'Safety',
  'Training',
  'Compliance',
  'Other',
];

export function DocumentUploadDialog({ open, onOpenChange }: DocumentUploadDialogProps) {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'extracting' | 'done' | 'error'>('idle');
  const { stats, limits } = useUsageStats();

  const storageUsed = stats?.storageUsed || 0;
  const storageLimit = limits.storageLimit;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
    },
  });

  // Read a File as base64 (without the data URI prefix)
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        if (!base64) {
          reject(new Error('Failed to encode file as base64'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Trigger text extraction after upload
  const triggerExtraction = async (documentId: string, file: File) => {
    try {
      setExtractionStatus('extracting');

      const fileBase64 = await readFileAsBase64(file);
      console.log('[DocumentUploadDialog] Extraction starting:', file.name, 'base64Len:', fileBase64.length);

      const { data, error } = await supabase.functions.invoke('extract-document-text', {
        body: {
          fileBase64,
          fileName: file.name,
          mimeType: file.type,
          mode: 'document',
          documentId,
        },
      });

      if (error) {
        console.error('Extraction error:', error);
        setExtractionStatus('error');
        toast({
          title: 'Document uploaded',
          description: 'Text extraction failed, but the document was saved. AI features may be limited.',
          variant: 'default',
        });
      } else if (data?.success) {
        setExtractionStatus('done');
        const textLength = data.extractedText?.length || 0;
        toast({
          title: 'Document ready for AI',
          description: `Extracted ${Math.round(textLength / 1000)}KB of text for AI assistance.`,
        });
      } else {
        setExtractionStatus('error');
        console.error('Extraction returned failure:', data?.error);
      }
    } catch (err) {
      console.error('Extraction trigger error:', err);
      setExtractionStatus('error');
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!tenant?.id) throw new Error('No tenant');

      const file = data.file as File;

      // Check storage quota before uploading
      if (storageLimit && (storageUsed + file.size) > storageLimit) {
        const formatBytes = (b: number) => b >= 1024 * 1024 * 1024
          ? `${(b / (1024 * 1024 * 1024)).toFixed(1)}GB`
          : `${(b / (1024 * 1024)).toFixed(0)}MB`;
        throw new Error(
          `Storage limit exceeded. You've used ${formatBytes(storageUsed)} of ${formatBytes(storageLimit)}. Upgrade your plan for more storage.`
        );
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenant.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Insert document record and get the ID back
      const { data: insertedDoc, error: dbError } = await supabase
        .from('documents')
        .insert({
          tenant_id: tenant.id,
          name: data.name,
          description: data.description || null,
          category: data.category,
          file_url: fileName,
          file_type: file.type,
          file_size: file.size,
          extraction_status: 'pending',
        })
        .select('id')
        .single();

      if (dbError) throw dbError;

      return insertedDoc.id;
    },
    onSuccess: async (documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });

      // Grab file reference BEFORE resetting the form
      const file = form.getValues('file') as File | undefined;
      form.reset();

      const MAX_EXTRACTION_SIZE = 15 * 1024 * 1024; // 15MB

      if (!file || file.size > MAX_EXTRACTION_SIZE) {
        toast({
          title: 'Document uploaded',
          description: file && file.size > MAX_EXTRACTION_SIZE
            ? 'File is too large for AI text extraction. Document saved without AI processing.'
            : 'Document saved successfully.',
        });
        onOpenChange(false);
        return;
      }

      // Trigger extraction in background (fire-and-forget)
      triggerExtraction(documentId, file);

      toast({
        title: 'Document uploaded',
        description: 'Processing document for AI assistance...',
      });

      // Close dialog after a short delay to show the processing state
      setTimeout(() => {
        onOpenChange(false);
        setExtractionStatus('idle');
      }, 1500);
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!validateFileSize(file)) return;
      form.setValue('file', file);
      if (!form.getValues('name')) {
        form.setValue('name', file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const MAX_FILE_SIZE_MB = 250;

  const validateFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!validateFileSize(file)) return;
      form.setValue('file', file);
      if (!form.getValues('name')) {
        form.setValue('name', file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const selectedFile = form.watch('file') as File | undefined;
  const isProcessing = uploadMutation.isPending || extractionStatus === 'extracting';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => uploadMutation.mutate(data))} className="space-y-4">
            {/* Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
                ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${selectedFile ? 'bg-muted/50' : ''}
              `}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => form.setValue('file', undefined as any)}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop a file here, or{' '}
                    <label className="text-primary cursor-pointer hover:underline">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileChange}
                      />
                    </label>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Word, Excel, or images up to 250MB
                  </p>
                </>
              )}
            </div>

            {/* Storage quota warning */}
            {storageLimit && storageUsed / storageLimit >= 0.8 && (
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                storageUsed / storageLimit >= 0.95 
                  ? 'bg-destructive/10 text-destructive' 
                  : 'bg-warning/10 text-warning'
              }`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Storage {storageUsed / storageLimit >= 0.95 ? 'almost full' : 'running low'}: {
                    storageUsed >= 1024 * 1024 * 1024
                      ? `${(storageUsed / (1024 * 1024 * 1024)).toFixed(1)}GB`
                      : `${(storageUsed / (1024 * 1024)).toFixed(0)}MB`
                  } of {
                    storageLimit >= 1024 * 1024 * 1024
                      ? `${(storageLimit / (1024 * 1024 * 1024)).toFixed(0)}GB`
                      : `${(storageLimit / (1024 * 1024)).toFixed(0)}MB`
                  } used
                </span>
              </div>
            )}

            {/* AI Processing Notice */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Documents are automatically processed for AI Field Assistant use</span>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter document name" {...field} disabled={isProcessing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isProcessing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add notes about this document"
                      rows={2}
                      {...field}
                      disabled={isProcessing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button type="submit" disabled={isProcessing}>
                {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {extractionStatus === 'extracting' && <Sparkles className="h-4 w-4 mr-2 animate-pulse" />}
                {uploadMutation.isPending 
                  ? 'Uploading...' 
                  : extractionStatus === 'extracting' 
                    ? 'Processing...' 
                    : 'Upload'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
