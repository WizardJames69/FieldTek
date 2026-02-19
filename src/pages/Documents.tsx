import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Loader2, HardDrive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useUserRole } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useUsageStats } from '@/hooks/useUsageStats';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { DocumentFilters } from '@/components/documents/DocumentFilters';
import { DocumentUploadDialog } from '@/components/documents/DocumentUploadDialog';
import { UpgradeNudge } from '@/components/billing/UpgradeNudge';

export default function Documents() {
  const { tenant } = useTenant();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const { stats, limits, percentages, thresholds } = useUsageStats();

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Extract file path from URL or return as-is if already a path
  const extractFilePath = (fileUrl: string): string => {
    if (fileUrl.startsWith('http')) {
      try {
        const url = new URL(fileUrl);
        const match = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
        if (match) return match[1];
        return fileUrl;
      } catch {
        return fileUrl;
      }
    }
    return fileUrl;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const doc = documents?.find((d) => d.id === id);
      if (!doc) throw new Error('Document not found');

      // Extract file path (handles both old URLs and new paths)
      const filePath = extractFilePath(doc.file_url);

      // Delete from storage
      await supabase.storage.from('documents').remove([filePath]);

      // Delete from database
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Document deleted' });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch =
      !search ||
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || doc.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout
      title="Documents"
      subtitle="Manuals, guides, and reference materials"
      actions={
        isAdmin ? (
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 md:space-y-6">
        {/* Storage Usage Bar */}
        {limits.storageLimit && stats && (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                Storage Usage
              </div>
              <span className={`text-sm font-medium ${
                thresholds.storage === 'critical' ? 'text-destructive' :
                thresholds.storage === 'warning' ? 'text-warning' : 'text-muted-foreground'
              }`}>
                {formatBytes(stats.storageUsed)} / {formatBytes(limits.storageLimit)}
              </span>
            </div>
            <Progress 
              value={percentages.storage} 
              className={`h-2 ${
                thresholds.storage === 'critical' ? '[&>div]:bg-destructive' :
                thresholds.storage === 'warning' ? '[&>div]:bg-warning' : ''
              }`}
            />
            {thresholds.storage !== 'normal' && (
              <p className={`text-xs ${
                thresholds.storage === 'critical' ? 'text-destructive' : 'text-warning'
              }`}>
                {thresholds.storage === 'critical' 
                  ? 'Storage is almost full. Upgrade your plan to continue uploading documents.'
                  : 'You\'re approaching your storage limit. Consider upgrading for more space.'}
              </p>
            )}
          </div>
        )}

        {/* Storage upgrade nudge */}
        {thresholds.storage === 'critical' && (
          <UpgradeNudge context="general" compact />
        )}

        {/* Filters */}
        <DocumentFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
        />

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDocuments?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No documents found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {documents?.length === 0
                ? 'Upload your first document to get started'
                : 'Try adjusting your filters'}
            </p>
            {isAdmin && documents?.length === 0 && (
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {filteredDocuments?.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </MainLayout>
  );
}
