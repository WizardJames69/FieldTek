import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Play, CheckCircle, XCircle, ArrowRightCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  usePatternSuggestions,
  useReviewSuggestion,
  useConvertSuggestionToTemplate,
  useTriggerPatternDiscovery,
} from "@/hooks/useWorkflowPatterns";
import type { PatternSuggestionRow, SuggestedStep } from "@/hooks/useWorkflowPatterns";

// ── Status Badge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
    converted: "outline",
    edited: "default",
  };
  return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
}

// ── Step Detail Row ───────────────────────────────────────────

function StepRow({ step }: { step: SuggestedStep }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 border-b last:border-b-0">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
        {step.step_number}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{step.title}</span>
          <Badge variant="outline" className="text-xs">{step.stage_name}</Badge>
          <Badge variant="secondary" className="text-xs">{step.step_type}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{step.instruction}</p>
        {step.safety_warning && (
          <p className="text-xs text-destructive mt-1">⚠ {step.safety_warning}</p>
        )}
      </div>
      {step.estimated_minutes && (
        <span className="text-xs text-muted-foreground flex-shrink-0">~{step.estimated_minutes}m</span>
      )}
    </div>
  );
}

// ── Suggestion Row ────────────────────────────────────────────

function SuggestionRow({
  suggestion,
  onApprove,
  onReject,
  onConvert,
}: {
  suggestion: PatternSuggestionRow;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const successPct = Math.round(suggestion.avg_success_rate * 100);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <TableCell>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <div>
              <p className="font-medium">{suggestion.suggested_name}</p>
              <p className="text-xs text-muted-foreground">{suggestion.suggested_description}</p>
            </div>
          </div>
        </TableCell>
        <TableCell>{suggestion.equipment_type || "Any"}</TableCell>
        <TableCell className="text-center">{suggestion.cluster_score.toFixed(2)}</TableCell>
        <TableCell className="text-center">{successPct}%</TableCell>
        <TableCell className="text-center">{suggestion.total_supporting_jobs}</TableCell>
        <TableCell><StatusBadge status={suggestion.review_status} /></TableCell>
        <TableCell>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {suggestion.review_status === "pending" && (
              <>
                <Button size="sm" variant="outline" onClick={() => onApprove(suggestion.id)}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReject(suggestion.id)}>
                  <XCircle className="h-3 w-3 mr-1" /> Reject
                </Button>
              </>
            )}
            {(suggestion.review_status === "approved" || suggestion.review_status === "edited") && (
              <Button size="sm" onClick={() => onConvert(suggestion.id)}>
                <ArrowRightCircle className="h-3 w-3 mr-1" /> Convert
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-0">
            <div className="px-4 py-3">
              <p className="text-sm font-medium mb-2">Suggested Steps ({suggestion.suggested_steps.length})</p>
              <div className="border rounded-md bg-background">
                {suggestion.suggested_steps.map((step) => (
                  <StepRow key={step.step_number} step={step} />
                ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────

const STATUS_TABS = ["all", "pending", "approved", "rejected", "converted"] as const;

export default function AdminWorkflowDiscovery() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [convertId, setConvertId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: suggestions = [], isLoading } = usePatternSuggestions(statusFilter);
  const reviewMutation = useReviewSuggestion();
  const convertMutation = useConvertSuggestionToTemplate();
  const discoveryMutation = useTriggerPatternDiscovery();

  const handleRunDiscovery = () => {
    discoveryMutation.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          `Discovery complete: ${result.clusters_found} clusters, ${result.suggestions_created} new suggestions (${result.latency_ms}ms)`,
        );
      },
      onError: (err) => {
        toast.error(`Discovery failed: ${err.message}`);
      },
    });
  };

  const handleApprove = (id: string) => {
    reviewMutation.mutate(
      { suggestionId: id, reviewStatus: "approved" },
      {
        onSuccess: () => toast.success("Suggestion approved"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleReject = () => {
    if (!rejectId) return;
    reviewMutation.mutate(
      { suggestionId: rejectId, reviewStatus: "rejected", reviewNotes: rejectNotes },
      {
        onSuccess: () => {
          toast.success("Suggestion rejected");
          setRejectId(null);
          setRejectNotes("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleConvert = () => {
    if (!convertId) return;
    convertMutation.mutate(convertId, {
      onSuccess: () => {
        toast.success("Suggestion converted to workflow template (unpublished)");
        setConvertId(null);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" /> AI Workflow Discovery
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-detected repair patterns from historical data, suggested as new workflow templates.
          </p>
        </div>
        <Button onClick={handleRunDiscovery} disabled={discoveryMutation.isPending}>
          {discoveryMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run Discovery
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Pattern Suggestions</CardTitle>
          <CardDescription>
            Review AI-generated workflow suggestions. Approve and convert to create new templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="capitalize">
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No suggestions found. Run discovery to detect patterns from historical data.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Success</TableHead>
                    <TableHead className="text-center">Jobs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s) => (
                    <SuggestionRow
                      key={s.id}
                      suggestion={s}
                      onApprove={handleApprove}
                      onReject={(id) => setRejectId(id)}
                      onConvert={(id) => setConvertId(id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Suggestion</DialogTitle>
            <DialogDescription>Provide optional notes explaining why this suggestion was rejected.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Rejection reason (optional)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectNotes(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Confirmation */}
      <AlertDialog open={!!convertId} onOpenChange={(open) => { if (!open) setConvertId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new workflow template from this suggestion. The template will be created as unpublished — you can review and publish it from the Workflow Templates page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert} disabled={convertMutation.isPending}>
              {convertMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Convert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
