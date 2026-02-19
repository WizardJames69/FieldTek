import { useState, useEffect } from 'react';
import { FileText, Download, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useUserRole } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

interface Document {
  id: string;
  name: string;
  description: string | null;
  category: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
}

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/webp': '🖼️',
};

// Extract file path from URL or return as-is if already a path
function extractFilePath(fileUrl: string): string {
  // If it's a full URL, extract the path
  if (fileUrl.startsWith('http')) {
    try {
      const url = new URL(fileUrl);
      // Path format: /storage/v1/object/public/documents/tenant-id/filename
      const match = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
      if (match) return match[1];
      return fileUrl;
    } catch {
      return fileUrl;
    }
  }
  return fileUrl;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const { isAdmin } = useUserRole();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Generate signed URL for private bucket access
  const getSignedUrl = async () => {
    if (signedUrl) return signedUrl;
    
    setIsLoading(true);
    try {
      const filePath = extractFilePath(document.file_url);
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (error) throw error;
      setSignedUrl(data.signedUrl);
      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = async () => {
    const url = await getSignedUrl();
    if (url) window.open(url, '_blank');
  };

  const handleDownload = async () => {
    const url = await getSignedUrl();
    if (url) {
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const fileIcon = FILE_ICONS[document.file_type] || '📎';

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{fileIcon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{document.name}</h3>
            {document.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {document.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {document.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(document.file_size)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Uploaded {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={handleView}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
            )}
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={handleDownload}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1" />
            )}
            Download
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{document.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(document.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
