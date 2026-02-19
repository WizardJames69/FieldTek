import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Trash2, Wrench, Receipt, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddPartDialog } from "./AddPartDialog";
import { toast } from "sonner";

interface JobPart {
  id: string;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_cost: number;
  supplier: string | null;
  purchased: boolean;
  added_to_invoice: boolean;
  notes: string | null;
  receipt_url: string | null;
}

interface JobPartsListProps {
  jobId: string;
  readOnly?: boolean;
}

export function JobPartsList({ jobId, readOnly = false }: JobPartsListProps) {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  // Generate signed URL for viewing a receipt securely
  const viewReceipt = useCallback(async (receiptPath: string, partId: string) => {
    if (!receiptPath) return;
    
    setLoadingReceiptId(partId);
    try {
      // Check if it's already a full URL (legacy data) or just a path
      if (receiptPath.startsWith('http')) {
        // Legacy: direct URL - still show it but log warning
        console.warn('[JobPartsList] Legacy public URL detected for receipt');
        setViewingReceipt(receiptPath);
      } else {
        // New format: generate signed URL (valid for 1 hour)
        const { data, error } = await supabase.storage
          .from('part-receipts')
          .createSignedUrl(receiptPath, 3600);
        
        if (error) throw error;
        setViewingReceipt(data.signedUrl);
      }
    } catch (error) {
      console.error('[JobPartsList] Failed to load receipt:', error);
      toast.error('Failed to load receipt');
    } finally {
      setLoadingReceiptId(null);
    }
  }, []);

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ["job-parts", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_parts")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as JobPart[];
    },
    enabled: !!jobId,
  });

  const togglePurchased = useMutation({
    mutationFn: async ({ partId, purchased }: { partId: string; purchased: boolean }) => {
      const { error } = await supabase
        .from("job_parts")
        .update({ purchased })
        .eq("id", partId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-parts", jobId] });
    },
    onError: () => {
      toast.error("Failed to update part status");
    },
  });

  const deletePart = useMutation({
    mutationFn: async (partId: string) => {
      const { error } = await supabase
        .from("job_parts")
        .delete()
        .eq("id", partId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-parts", jobId] });
      toast.success("Part removed");
    },
    onError: () => {
      toast.error("Failed to remove part");
    },
  });

  const totalCost = parts.reduce((sum, part) => sum + part.quantity * part.unit_cost, 0);
  const purchasedCount = parts.filter((p) => p.purchased).length;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Parts List</h4>
            {parts.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {purchasedCount}/{parts.length}
              </Badge>
            )}
          </CollapsibleTrigger>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Part
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-3 space-y-2">
          {parts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No parts added yet. Add parts you need to purchase for this job.
            </p>
          ) : (
            <>
              {parts.map((part) => (
                <div
                  key={part.id}
                  className="flex items-center gap-3 p-2 rounded-lg border bg-card"
                >
                  {!readOnly && (
                    <Checkbox
                      checked={part.purchased}
                      onCheckedChange={(checked) =>
                        togglePurchased.mutate({
                          partId: part.id,
                          purchased: checked as boolean,
                        })
                      }
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          part.purchased ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {part.part_name}
                      </span>
                      {part.added_to_invoice && (
                        <Badge variant="outline" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Invoiced
                        </Badge>
                      )}
                      {part.receipt_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => viewReceipt(part.receipt_url!, part.id)}
                          disabled={loadingReceiptId === part.id}
                        >
                          {loadingReceiptId === part.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Receipt className="h-3 w-3 mr-1" />
                          )}
                          Receipt
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {part.part_number && <span>#{part.part_number}</span>}
                      {part.supplier && <span>• {part.supplier}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {part.quantity} × ${part.unit_cost.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${(part.quantity * part.unit_cost).toFixed(2)}
                    </p>
                  </div>
                  {!readOnly && !part.added_to_invoice && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => deletePart.mutate(part.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm font-medium">Total</span>
                <span className="text-sm font-semibold">${totalCost.toFixed(2)}</span>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <AddPartDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        jobId={jobId}
        tenantId={tenant?.id || ""}
        userId={user?.id || ""}
      />

      {/* Receipt Viewer Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt Photo</DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <img
              src={viewingReceipt}
              alt="Receipt"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
