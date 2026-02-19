import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, ArrowRight, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIAnalysisCard } from './AIAnalysisCard';
import { CustomerEquipmentHistory } from '@/components/equipment/CustomerEquipmentHistory';

interface ServiceRequest {
  id: string;
  title: string;
  description: string | null;
  request_type: string | null;
  status: string;
  priority: string;
  created_at: string;
  ai_analysis: any;
  ai_analyzed_at?: string | null;
  client_id?: string | null;
  clients?: {
    id: string;
    name: string;
  } | null;
}

interface RequestDetailSheetProps {
  request: ServiceRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestDetailSheet({ request, open, onOpenChange }: RequestDetailSheetProps) {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [priority, setPriority] = useState(request?.priority || 'medium');

  const updateMutation = useMutation({
    mutationFn: async ({ status, priority }: { status?: string; priority?: string }) => {
      if (!request) return;

      const updates: any = {};
      if (status) updates.status = status;
      if (priority) updates.priority = priority;

      const { error } = await supabase
        .from('service_requests')
        .update(updates)
        .eq('id', request.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Request updated' });
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const convertToJobMutation = useMutation({
    mutationFn: async () => {
      if (!request || !tenant?.id) return;

      // Create the job
      const { data: job, error: jobError } = await supabase
        .from('scheduled_jobs')
        .insert({
          tenant_id: tenant.id,
          title: request.title,
          description: request.description,
          job_type: request.request_type || 'Service',
          priority: request.priority as any,
          status: 'pending',
          client_id: request.client_id || null,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Update the request
      const { error: updateError } = await supabase
        .from('service_requests')
        .update({
          status: 'converted',
          converted_job_id: job.id,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      return job;
    },
    onSuccess: () => {
      toast({ title: 'Request converted to job' });
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Conversion failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!request) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader>
              <SheetTitle>{request.title}</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Status & Priority */}
              <div className="flex items-center gap-3">
                <Badge variant={request.status === 'new' ? 'destructive' : 'secondary'}>
                  {request.status}
                </Badge>
                <Select
                  value={priority}
                  onValueChange={(value) => {
                    setPriority(value);
                    updateMutation.mutate({ priority: value });
                  }}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI Analysis Card */}
              <AIAnalysisCard
                requestId={request.id}
                title={request.title}
                description={request.description}
                requestType={request.request_type}
                existingAnalysis={request.ai_analysis}
                analyzedAt={request.ai_analyzed_at || null}
              />

              <Separator />

              {/* Customer Equipment History */}
              {request.client_id && (
                <>
                  <CustomerEquipmentHistory
                    clientId={request.client_id}
                    clientName={request.clients?.name}
                  />
                  <Separator />
                </>
              )}

              {/* Details */}
              <div>
                <h4 className="text-sm font-medium mb-2">Details</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {request.description || 'No details provided'}
                </p>
              </div>

              <Separator />

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">{request.request_type || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted</span>
                  <p className="font-medium">{format(new Date(request.created_at), 'PPp')}</p>
                </div>
                {request.clients && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Client</span>
                    <p className="font-medium">{request.clients.name}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              {request.status !== 'converted' && request.status !== 'rejected' && (
                <div className="flex gap-2">
                  {request.status === 'new' && (
                    <Button
                      variant="outline"
                      onClick={() => updateMutation.mutate({ status: 'reviewed' })}
                      disabled={updateMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Mark Reviewed
                    </Button>
                  )}
                  <Button
                    onClick={() => convertToJobMutation.mutate()}
                    disabled={convertToJobMutation.isPending}
                  >
                    {convertToJobMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Convert to Job
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => updateMutation.mutate({ status: 'rejected' })}
                    disabled={updateMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}

              {request.status === 'converted' && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-400">
                  This request has been converted to a job.
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
