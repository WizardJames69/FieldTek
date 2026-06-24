import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Search, Eye, CheckCircle, XCircle, Archive, GraduationCap, Inbox, BookOpen, RefreshCw, Trash2 } from "lucide-react";
import {
  buildReviewUpdate,
  canApprove,
  canReject,
  canArchive,
  statusBadge,
  sourceTypeLabel,
  type LessonStatus,
  type ReviewAction,
} from "@/lib/lessonReview";
import { isFeatureFlagEnabledForTenant } from "@/lib/featureFlagClient";
import type { FeatureFlag } from "@/hooks/useFeatureFlags";

interface LessonCandidate {
  id: string;
  tenant_id: string;
  source_type: string;
  correlation_id: string | null;
  audit_log_id: string | null;
  question: string;
  proposed_answer: string;
  equipment_type: string | null;
  status: LessonStatus;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  published_document_id: string | null;
}

export default function AdminLessonReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [selected, setSelected] = useState<LessonCandidate | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [unpublishOpen, setUnpublishOpen] = useState(false);

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["lesson-candidates", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("lesson_candidates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LessonCandidate[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ candidate, action }: { candidate: LessonCandidate; action: ReviewAction }) => {
      // buildReviewUpdate enforces the transition rules and the required-notes
      // rule; it throws on an invalid review so we never persist a bad state.
      const update = buildReviewUpdate({
        currentStatus: candidate.status,
        action,
        reviewerId: user?.id ?? "",
        reviewNotes,
        nowIso: new Date().toISOString(),
      });
      const { error } = await supabase
        .from("lesson_candidates")
        .update(update)
        .eq("id", candidate.id);
      if (error) throw error;
    },
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-candidates"] });
      const pastTense = { approve: "approved", reject: "rejected", archive: "archived" } as const;
      toast({ title: `Lesson candidate ${pastTense[action]}` });
      setSelected(null);
      setReviewNotes("");
    },
    onError: (err) => {
      toast({
        title: "Review failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  // The lesson_citations flag gates the Publish action. This admin page is
  // cross-tenant and has no TenantProvider, so we fetch the flag row directly
  // and evaluate it against the selected lesson's tenant (not the admin's).
  // The server (promote-lesson) re-checks the flag authoritatively.
  const { data: lessonFlag } = useQuery({
    queryKey: ["feature-flag", "lesson_citations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("*")
        .eq("key", "lesson_citations")
        .maybeSingle();
      if (error) throw error;
      return (data as FeatureFlag | null) ?? null;
    },
    staleTime: 60_000,
  });

  const publishMutation = useMutation({
    mutationFn: async (candidate: LessonCandidate) => {
      const { data, error } = await supabase.functions.invoke("promote-lesson", {
        body: { lessonId: candidate.id },
      });
      if (error) {
        // Surface the function's typed error (flag_disabled / not_approved /
        // permission) instead of a generic "non-2xx" message.
        let message = error instanceof Error ? error.message : "Publish failed";
        try {
          const ctx = (error as { context?: Response }).context;
          const body = ctx ? await ctx.json() : null;
          if (body?.code === "flag_disabled") {
            message = "Lesson citations are not enabled for this tenant.";
          } else if (body?.code === "not_approved") {
            message = "Only approved lessons can be published.";
          } else if (body?.error) {
            message = body.error;
          }
        } catch {
          /* keep the default message */
        }
        throw new Error(message);
      }
      return data as { document_id?: string } | null;
    },
    onSuccess: (data, candidate) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-candidates"] });
      // Reflect the published state immediately in the open sheet.
      setSelected((prev) =>
        prev && prev.id === candidate.id
          ? { ...prev, published_document_id: data?.document_id ?? prev.published_document_id ?? "published" }
          : prev,
      );
      toast({ title: "Lesson published to knowledge base" });
    },
    onError: (err) => {
      toast({
        title: "Publish failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  // Unpublish removes the lesson's published document from the knowledge base.
  // Unlike Publish/Republish it is intentionally NOT gated by lesson_citations:
  // it is a rollback/cleanup action that must work when the flag is off. The
  // server (unpublish-lesson) authoritatively checks platform-admin auth and
  // that the document is this lesson's own lesson document.
  const unpublishMutation = useMutation({
    mutationFn: async (candidate: LessonCandidate) => {
      const { data, error } = await supabase.functions.invoke("unpublish-lesson", {
        body: { lessonId: candidate.id },
      });
      if (error) {
        let message = error instanceof Error ? error.message : "Unpublish failed";
        try {
          const ctx = (error as { context?: Response }).context;
          const body = ctx ? await ctx.json() : null;
          if (body?.code === "mismatch") {
            message = "The published document does not match this lesson; it was not removed.";
          } else if (body?.error) {
            message = body.error;
          }
        } catch {
          /* keep the default message */
        }
        throw new Error(message);
      }
      return data as { unpublished?: boolean } | null;
    },
    onSuccess: (_data, candidate) => {
      queryClient.invalidateQueries({ queryKey: ["lesson-candidates"] });
      // Reflect the unpublished state immediately in the open sheet.
      setSelected((prev) =>
        prev && prev.id === candidate.id ? { ...prev, published_document_id: null } : prev,
      );
      toast({ title: "Lesson removed from knowledge base" });
    },
    onError: (err) => {
      toast({
        title: "Unpublish failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  const openDetail = (candidate: LessonCandidate) => {
    setSelected(candidate);
    setReviewNotes("");
  };

  const filtered = candidates?.filter((c) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      c.question?.toLowerCase().includes(search) ||
      c.proposed_answer?.toLowerCase().includes(search) ||
      c.equipment_type?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: candidates?.length || 0,
    pending: candidates?.filter((c) => c.status === "pending").length || 0,
    approved: candidates?.filter((c) => c.status === "approved").length || 0,
    rejected: candidates?.filter((c) => c.status === "rejected").length || 0,
  };

  const notesRequired = !!selected && (selected.status === "pending");
  const notesMissing = reviewNotes.trim().length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-7 w-7" />
          Lesson Review
        </h1>
        <p className="text-muted-foreground">
          Review and approve human-curated lesson candidates. Approved lessons are not yet citable —
          this queue only captures and curates knowledge for a later, gated retrieval step.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Eye className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader>
          <CardTitle>Candidate Queue</CardTitle>
          <CardDescription>Human-in-the-loop review of field-learned lesson candidates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search question, proposed answer, equipment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="lesson-search"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]" data-testid="lesson-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Created</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-[140px]">Source</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No lesson candidates found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered?.map((c) => {
                      const badge = statusBadge(c.status);
                      return (
                        <TableRow key={c.id} data-testid="lesson-row">
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(c.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md truncate text-sm">{c.question}</div>
                            {c.equipment_type && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {c.equipment_type}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {sourceTypeLabel(c.source_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn("text-xs", badge.className)}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDetail(c)}
                              data-testid="lesson-view"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail + review sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Lesson Candidate
              {selected && (
                <Badge variant="secondary" className={statusBadge(selected.status).className}>
                  {statusBadge(selected.status).label}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {selected && format(new Date(selected.created_at), "MMMM d, yyyy 'at' HH:mm:ss")}
            </SheetDescription>
          </SheetHeader>

          {selected && (
            <ScrollArea className="h-[calc(100vh-140px)] mt-6">
              <div className="space-y-6 pr-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <p className="mt-1">{sourceTypeLabel(selected.source_type)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equipment:</span>
                    <p className="mt-1">{selected.equipment_type || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tenant ID:</span>
                    <p className="font-mono text-xs mt-1">{selected.tenant_id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created By:</span>
                    <p className="font-mono text-xs mt-1">{selected.created_by}</p>
                  </div>
                </div>

                {/* Audit traceability */}
                {(selected.correlation_id || selected.audit_log_id) && (
                  <div className="rounded-lg border p-4 text-sm">
                    <h4 className="font-semibold mb-2">Audit Traceability</h4>
                    {selected.correlation_id && (
                      <div className="mb-1">
                        <span className="text-muted-foreground">correlation_id:</span>{" "}
                        <span className="font-mono text-xs">{selected.correlation_id}</span>
                      </div>
                    )}
                    {selected.audit_log_id && (
                      <div>
                        <span className="text-muted-foreground">audit_log_id:</span>{" "}
                        <span className="font-mono text-xs">{selected.audit_log_id}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Question */}
                <div>
                  <h4 className="font-semibold mb-2">Question</h4>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {selected.question}
                  </div>
                </div>

                {/* Proposed answer */}
                <div>
                  <h4 className="font-semibold mb-2">Proposed Answer</h4>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                    {selected.proposed_answer}
                  </div>
                </div>

                {/* Existing review record */}
                {selected.reviewed_at && (
                  <div className="rounded-lg border p-4 text-sm">
                    <h4 className="font-semibold mb-2">Review</h4>
                    <div className="text-muted-foreground">
                      Reviewed {format(new Date(selected.reviewed_at), "MMM d, yyyy HH:mm")}
                      {selected.reviewed_by && (
                        <> by <span className="font-mono text-xs">{selected.reviewed_by}</span></>
                      )}
                    </div>
                    {selected.review_notes && (
                      <p className="mt-2 whitespace-pre-wrap">{selected.review_notes}</p>
                    )}
                  </div>
                )}

                {/* Review actions */}
                {(canApprove(selected.status) || canReject(selected.status) || canArchive(selected.status)) && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Review Actions</h4>
                    {notesRequired && (
                      <Textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Review notes (required to approve or reject)..."
                        className="min-h-[80px]"
                        data-testid="lesson-review-notes"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {canApprove(selected.status) && (
                        <Button
                          onClick={() => reviewMutation.mutate({ candidate: selected, action: "approve" })}
                          disabled={reviewMutation.isPending || notesMissing}
                          className="gap-2 bg-green-600 hover:bg-green-700"
                          data-testid="lesson-approve"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </Button>
                      )}
                      {canReject(selected.status) && (
                        <Button
                          variant="destructive"
                          onClick={() => reviewMutation.mutate({ candidate: selected, action: "reject" })}
                          disabled={reviewMutation.isPending || notesMissing}
                          className="gap-2"
                          data-testid="lesson-reject"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      )}
                      {canArchive(selected.status) && (
                        <Button
                          variant="outline"
                          onClick={() => reviewMutation.mutate({ candidate: selected, action: "archive" })}
                          disabled={reviewMutation.isPending}
                          className="gap-2"
                          data-testid="lesson-archive"
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Knowledge Base — publish an approved lesson into the document
                    pipeline so Sentinel can cite it. Gated by the
                    lesson_citations flag (evaluated for the lesson's tenant);
                    the server re-checks it authoritatively. */}
                {selected.status === "approved" && (
                  <div className="space-y-3" data-testid="lesson-publish-section">
                    <h4 className="font-semibold">Knowledge Base</h4>
                    {selected.published_document_id ? (
                      <div className="rounded-lg border p-4 text-sm space-y-2">
                        <div className="flex items-center gap-2 text-green-700">
                          <BookOpen className="h-4 w-4" />
                          <span data-testid="lesson-published-state">Published to knowledge base</span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground break-all">
                          document_id: {selected.published_document_id}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {/* Republish stays flag-gated. */}
                          {isFeatureFlagEnabledForTenant(lessonFlag, selected.tenant_id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => publishMutation.mutate(selected)}
                              disabled={publishMutation.isPending}
                              className="gap-2"
                              data-testid="lesson-republish"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Republish
                            </Button>
                          )}
                          {/* Unpublish is a removal/cleanup action and is NOT
                              flag-gated — it must work during a rollback when
                              lesson_citations is already off. */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUnpublishOpen(true)}
                            disabled={unpublishMutation.isPending}
                            className="gap-2 text-destructive hover:text-destructive"
                            data-testid="lesson-unpublish"
                          >
                            <Trash2 className="h-4 w-4" />
                            Unpublish
                          </Button>
                        </div>
                      </div>
                    ) : isFeatureFlagEnabledForTenant(lessonFlag, selected.tenant_id) ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Publishing makes this approved lesson retrievable and citable by Sentinel,
                          like an uploaded document.
                        </p>
                        <Button
                          onClick={() => publishMutation.mutate(selected)}
                          disabled={publishMutation.isPending}
                          className="gap-2"
                          data-testid="lesson-publish"
                        >
                          <BookOpen className="h-4 w-4" />
                          Publish to knowledge base
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground" data-testid="lesson-publish-disabled">
                        Lesson citations are disabled for this tenant. Enable the{" "}
                        <code className="font-mono text-xs">lesson_citations</code> flag to publish.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Unpublish confirmation. Removing deletes the lesson's knowledge-base
          document and its chunks so Sentinel can no longer cite it. */}
      <AlertDialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <AlertDialogContent data-testid="lesson-unpublish-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove lesson from knowledge base?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the published lesson document and its embeddings, so Sentinel will stop
              retrieving and citing it. The lesson candidate itself is kept and can be published
              again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selected) unpublishMutation.mutate(selected);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="lesson-unpublish-confirm"
            >
              Unpublish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
