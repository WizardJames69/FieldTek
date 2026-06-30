import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle,
  Search,
  Eye,
  FileText,
  Shield,
  ShieldOff,
  GraduationCap,
  Ban,
  Slash,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { buildCandidateInsert } from "@/lib/lessonReview";
import {
  classifyAuditOutcome,
  auditOutcomeBadge,
  type AuditOutcome,
  type AuditOutcomeIcon,
} from "@/lib/auditOutcome";

interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_message: string;
  context_type: string | null;
  context_id: string | null;
  equipment_type: string | null;
  ai_response: string | null;
  response_blocked: boolean;
  block_reason: string | null;
  documents_available: number;
  documents_with_content: number;
  document_names: string[] | null;
  validation_patterns_matched: string[] | null;
  had_citations: boolean | null;
  response_time_ms: number | null;
  model_used: string | null;
  correlation_id: string | null;
  created_at: string;
  // Judge evaluation (populated asynchronously; NULL on older / unjudged rows).
  judge_verdict: string | null;
  judge_grounded: boolean | null;
  judge_confidence: number | null;
  judge_contradiction: boolean | null;
  judge_explanation: string | null;
  judge_latency_ms: number | null;
  judge_model: string | null;
  // Abstain / deterministic-escalation signals (already fetched via select("*")).
  abstain_flag: boolean | null;
  human_review_required: boolean | null;
  human_review_reasons: string[] | null;
  enforcement_rules_triggered: string[] | null;
}

// Maps the classifier's stable icon key to a lucide icon component.
const OUTCOME_ICONS: Record<AuditOutcomeIcon, LucideIcon> = {
  check: CheckCircle,
  warn: AlertTriangle,
  block: Ban,
  shield: Shield,
  slash: Slash,
  help: HelpCircle,
  unverified: ShieldOff,
};

function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  const badge = auditOutcomeBadge(outcome);
  const Icon = OUTCOME_ICONS[badge.icon];
  return (
    <Badge variant="outline" className={`gap-1 border-transparent ${badge.className}`}>
      <Icon className="h-3 w-3" />
      {badge.label}
    </Badge>
  );
}

// Renders a nullable judge cell value with an em-dash placeholder.
function nullableText(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function AdminAIAuditLogs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  // Outcome filter value: "all" or one of the AuditOutcome states.
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [contradictionsOnly, setContradictionsOnly] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // ── Lesson candidate intake (PR-2) ──────────────────────────────────────
  // Staff-controlled: an admin curates a pending lesson_candidates row from a
  // real AI interaction. Nothing here makes a lesson citable.
  const [intakeLog, setIntakeLog] = useState<AuditLog | null>(null);
  const [intakeQuestion, setIntakeQuestion] = useState("");
  const [intakeAnswer, setIntakeAnswer] = useState("");
  const [intakeEquipment, setIntakeEquipment] = useState("");

  const openIntake = (log: AuditLog) => {
    setIntakeQuestion(log.user_message ?? "");
    setIntakeAnswer(log.ai_response ?? "");
    setIntakeEquipment(log.equipment_type ?? "");
    setIntakeLog(log);
  };

  const closeIntake = () => {
    setIntakeLog(null);
    setIntakeQuestion("");
    setIntakeAnswer("");
    setIntakeEquipment("");
  };

  // Non-blocking duplicate check: surface (but do not prevent) creating a
  // second candidate from the same audit log.
  const { data: existingCandidateCount } = useQuery({
    queryKey: ["lesson-candidate-dup", intakeLog?.id],
    enabled: !!intakeLog?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lesson_candidates")
        .select("id", { count: "exact", head: true })
        .eq("audit_log_id", intakeLog!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const intakeMutation = useMutation({
    mutationFn: async () => {
      if (!intakeLog) throw new Error("No audit log selected.");
      // buildCandidateInsert validates required fields and shapes the payload;
      // it throws on invalid input so we never insert a bad row.
      const payload = buildCandidateInsert({
        tenantId: intakeLog.tenant_id,
        createdBy: user?.id ?? "",
        question: intakeQuestion,
        proposedAnswer: intakeAnswer,
        sourceType: "ai_interaction",
        equipmentType: intakeEquipment,
        auditLogId: intakeLog.id,
        correlationId: intakeLog.correlation_id,
      });
      const { error } = await supabase.from("lesson_candidates").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Lesson candidate created",
        description: "It is now pending review in Lesson Review.",
      });
      closeIntake();
    },
    onError: (err) => {
      toast({
        title: "Could not create lesson candidate",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  const intakeValid = intakeQuestion.trim().length > 0 && intakeAnswer.trim().length > 0;

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["ai-audit-logs", filterOutcome, contradictionsOnly],
    queryFn: async () => {
      // The 500-row cap remains for general browsing. For gate-critical, rare
      // outcomes (warn_appended / judge_blocked / contradictions) we ALSO push a
      // server-side narrowing predicate so matching rows are not missed if they
      // fall beyond the 500 most-recent rows. Final outcome classification still
      // happens client-side via classifyAuditOutcome.
      let query = supabase
        .from("ai_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filterOutcome === "warn_appended") {
        query = query.eq("judge_verdict", "warn_appended");
      } else if (filterOutcome === "judge_blocked") {
        query = query.eq("judge_verdict", "blocked");
      } else if (filterOutcome === "unjudged_no_verdict") {
        // Fail-open served answers carry a NULL judge verdict. Narrow server-side
        // so these gate-critical rows surface even beyond the 500-row window. The
        // client-side classifier then drops null-verdict abstains / deterministic
        // blocks / empty responses. (Single predicate mirrors the warn/blocked
        // narrowing above; the rarer "none"/empty-string verdicts are caught
        // client-side rather than complicating the query with OR/nullability.)
        query = query.is("judge_verdict", null);
      }
      if (contradictionsOnly) {
        query = query.eq("judge_contradiction", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const filteredLogs = auditLogs?.filter((log) => {
    if (contradictionsOnly && log.judge_contradiction !== true) return false;
    if (filterOutcome !== "all" && classifyAuditOutcome(log) !== filterOutcome) return false;
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      log.user_message?.toLowerCase().includes(search) ||
      log.ai_response?.toLowerCase().includes(search) ||
      log.block_reason?.toLowerCase().includes(search) ||
      log.equipment_type?.toLowerCase().includes(search)
    );
  });

  // Outcome-aware counts over the fetched window. Note: when an outcome filter is
  // active the server-side narrowing changes the fetched set, so these reflect the
  // current view rather than an all-time total.
  const outcomeCount = (outcome: AuditOutcome) =>
    auditLogs?.filter((l) => classifyAuditOutcome(l) === outcome).length || 0;

  const stats = {
    total: auditLogs?.length || 0,
    groundedPass: outcomeCount("grounded_pass"),
    warnAppended: outcomeCount("warn_appended"),
    // Served answers with no judge verdict (fail-open). Counted separately so the
    // Grounded pass total no longer absorbs unverified answers.
    unjudged: outcomeCount("unjudged_no_verdict"),
    judgeBlocked: outcomeCount("judge_blocked"),
    deterministic: outcomeCount("deterministic_block_or_escalation"),
    abstain: outcomeCount("abstain") + outcomeCount("grounded_refusal"),
    contradictions: auditLogs?.filter((l) => l.judge_contradiction === true).length || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Audit Logs</h1>
        <p className="text-muted-foreground">
          Monitor Sentinel AI interactions and blocked responses
        </p>
      </div>

        {/* Stats Cards — outcome-focused counts for the Grounding-Trust telemetry gate.
            data-testid scopes E2E assertions to the stat-card summary so they don't
            collide with identical outcome labels rendered as row badges in the table. */}
        <div data-testid="audit-stat-cards" className="grid gap-4 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grounded pass</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.groundedPass}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warn appended</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.warnAppended}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unjudged</CardTitle>
              <ShieldOff className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">{stats.unjudged}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Judge blocked</CardTitle>
              <Ban className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.judgeBlocked}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Determ. / review</CardTitle>
              <Shield className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.deterministic}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abstain</CardTitle>
              <Slash className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-600">{stats.abstain}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contradictions</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.contradictions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Interaction Log</CardTitle>
            <CardDescription>
              Review all AI interactions with validation status and response details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages, responses, equipment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterOutcome} onValueChange={setFilterOutcome}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Filter by outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  <SelectItem value="grounded_pass">Grounded pass</SelectItem>
                  <SelectItem value="warn_appended">Warn appended</SelectItem>
                  <SelectItem value="unjudged_no_verdict">Unjudged / no verdict</SelectItem>
                  <SelectItem value="judge_blocked">Judge blocked</SelectItem>
                  <SelectItem value="deterministic_block_or_escalation">
                    Deterministic / human review
                  </SelectItem>
                  <SelectItem value="grounded_refusal">Grounded refusal</SelectItem>
                  <SelectItem value="abstain">Abstain</SelectItem>
                  <SelectItem value="degraded_or_retrieval_unavailable">
                    Degraded / retrieval unavailable
                  </SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={contradictionsOnly ? "default" : "outline"}
                className="gap-2 whitespace-nowrap"
                onClick={() => setContradictionsOnly((v) => !v)}
                aria-pressed={contradictionsOnly}
              >
                <AlertTriangle className="h-4 w-4" />
                Contradictions only
              </Button>
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
                      <TableHead className="w-[140px]">Time</TableHead>
                      <TableHead>User Message</TableHead>
                      <TableHead className="w-[220px]">Outcome</TableHead>
                      <TableHead className="w-[120px]">Judge</TableHead>
                      <TableHead className="w-[60px]">Conf</TableHead>
                      <TableHead className="w-[60px]">Grnd</TableHead>
                      <TableHead className="w-[60px]">Contra</TableHead>
                      <TableHead className="w-[80px]">J-lat</TableHead>
                      <TableHead className="w-[90px]">Docs</TableHead>
                      <TableHead className="w-[90px]">Response</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(log.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md truncate text-sm">
                              {log.user_message}
                            </div>
                            {log.equipment_type && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {log.equipment_type}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <OutcomeBadge outcome={classifyAuditOutcome(log)} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {nullableText(log.judge_verdict)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.judge_confidence === null || log.judge_confidence === undefined
                              ? "—"
                              : `${log.judge_confidence}/5`}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.judge_grounded === null || log.judge_grounded === undefined
                              ? "—"
                              : log.judge_grounded
                                ? "✓"
                                : "✗"}
                          </TableCell>
                          <TableCell>
                            {log.judge_contradiction === true ? (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.judge_latency_ms === null || log.judge_latency_ms === undefined
                              ? "—"
                              : `${log.judge_latency_ms}ms`}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {log.documents_with_content}/{log.documents_available}
                            </div>
                            {log.had_citations && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                Cited
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.response_time_ms}ms
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Sheet */}
        <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <SheetContent className="w-[600px] sm:max-w-[600px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                AI Interaction Details
                {selectedLog && <OutcomeBadge outcome={classifyAuditOutcome(selectedLog)} />}
              </SheetTitle>
              <SheetDescription>
                {selectedLog && format(new Date(selectedLog.created_at), "MMMM d, yyyy 'at' HH:mm:ss")}
              </SheetDescription>
            </SheetHeader>
            
            {selectedLog && (
              <ScrollArea className="h-[calc(100vh-140px)] mt-6">
                <div className="space-y-6 pr-4">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">User ID:</span>
                      <p className="font-mono text-xs mt-1">{selectedLog.user_id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tenant ID:</span>
                      <p className="font-mono text-xs mt-1">{selectedLog.tenant_id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Response Time:</span>
                      <p className="font-semibold">{selectedLog.response_time_ms}ms</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Model:</span>
                      <p>{selectedLog.model_used || "Unknown"}</p>
                    </div>
                  </div>

                  {/* Context */}
                  {(selectedLog.context_type || selectedLog.equipment_type) && (
                    <div>
                      <h4 className="font-semibold mb-2">Context</h4>
                      <div className="flex gap-2 flex-wrap">
                        {selectedLog.context_type && (
                          <Badge variant="outline">{selectedLog.context_type}</Badge>
                        )}
                        {selectedLog.equipment_type && (
                          <Badge variant="secondary">{selectedLog.equipment_type}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Documents */}
                  <div>
                    <h4 className="font-semibold mb-2">
                      Documents ({selectedLog.documents_with_content}/{selectedLog.documents_available} with content)
                    </h4>
                    {selectedLog.document_names && selectedLog.document_names.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {selectedLog.document_names.map((name, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No documents available</p>
                    )}
                  </div>

                  {/* Block Reason */}
                  {selectedLog.response_blocked && selectedLog.block_reason && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Block Reason
                      </h4>
                      <p className="text-sm">{selectedLog.block_reason}</p>
                      {selectedLog.validation_patterns_matched && (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Patterns matched:</span>
                          <div className="flex gap-2 flex-wrap mt-1">
                            {selectedLog.validation_patterns_matched.map((pattern, i) => (
                              <Badge key={i} variant="outline" className="text-xs font-mono">
                                {pattern}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Human-review escalation (deterministic, distinct from a judge block) */}
                  {selectedLog.human_review_required && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Human review required
                      </h4>
                      {selectedLog.human_review_reasons && selectedLog.human_review_reasons.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {selectedLog.human_review_reasons.map((reason, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-mono">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enforcement rules (deterministic provenance: escalations, degraded fallback, abstain reason) */}
                  {((selectedLog.enforcement_rules_triggered &&
                    selectedLog.enforcement_rules_triggered.length > 0) ||
                    selectedLog.abstain_flag) && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        Enforcement
                        {selectedLog.abstain_flag && (
                          <Badge variant="secondary" className="text-xs">Abstained</Badge>
                        )}
                      </h4>
                      {selectedLog.enforcement_rules_triggered &&
                      selectedLog.enforcement_rules_triggered.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                          {selectedLog.enforcement_rules_triggered.map((rule, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-mono">
                              {rule}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No enforcement rules recorded.</p>
                      )}
                    </div>
                  )}

                  {/* Unjudged / no verdict: a served answer the grounding judge
                      never returned a result for (fail-open under judge_blocking_mode).
                      Shown explicitly so it is NOT read as a grounded pass. */}
                  {classifyAuditOutcome(selectedLog) === "unjudged_no_verdict" && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-800">
                        <ShieldOff className="h-4 w-4" />
                        Judge Evaluation
                      </h4>
                      <p className="text-sm text-amber-800">
                        No judge verdict was recorded for this served answer. The grounding
                        judge produced no result (fail-open), so the response was delivered
                        without a grounding check — it is <span className="font-semibold">not</span> a
                        confirmed grounded pass.
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        <div>
                          <span className="text-muted-foreground">Verdict:</span>
                          <p className="font-mono text-xs mt-1">{nullableText(selectedLog.judge_verdict)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Grounded:</span>
                          <p className="font-semibold">
                            {selectedLog.judge_grounded === null
                              ? "—"
                              : selectedLog.judge_grounded
                                ? "Yes"
                                : "No"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <p className="font-semibold">
                            {selectedLog.judge_confidence === null
                              ? "—"
                              : `${selectedLog.judge_confidence}/5`}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Latency:</span>
                          <p className="font-semibold">
                            {selectedLog.judge_latency_ms === null
                              ? "—"
                              : `${selectedLog.judge_latency_ms}ms`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Judge Evaluation (LLM-as-judge; async, may be NULL on unjudged rows) */}
                  {classifyAuditOutcome(selectedLog) !== "unjudged_no_verdict" &&
                    (selectedLog.judge_verdict !== null ||
                    selectedLog.judge_grounded !== null ||
                    selectedLog.judge_confidence !== null ||
                    selectedLog.judge_contradiction !== null ||
                    selectedLog.judge_explanation !== null) && (
                    <div className="rounded-lg border p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Judge Evaluation
                        {selectedLog.judge_verdict && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {selectedLog.judge_verdict}
                          </Badge>
                        )}
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Grounded:</span>
                          <p className="font-semibold">
                            {selectedLog.judge_grounded === null
                              ? "—"
                              : selectedLog.judge_grounded
                                ? "Yes"
                                : "No"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <p className="font-semibold">
                            {selectedLog.judge_confidence === null
                              ? "—"
                              : `${selectedLog.judge_confidence}/5`}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contradiction:</span>
                          <p className="font-semibold">
                            {selectedLog.judge_contradiction === null
                              ? "—"
                              : selectedLog.judge_contradiction
                                ? "Yes"
                                : "No"}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Latency:</span>
                          <p className="font-semibold">
                            {selectedLog.judge_latency_ms === null
                              ? "—"
                              : `${selectedLog.judge_latency_ms}ms`}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Model:</span>
                          <p className="font-mono text-xs mt-1">{selectedLog.judge_model || "—"}</p>
                        </div>
                      </div>
                      {selectedLog.judge_explanation && (
                        <div className="mt-3">
                          <span className="text-xs text-muted-foreground">Explanation:</span>
                          <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap mt-1">
                            {selectedLog.judge_explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* User Message */}
                  <div>
                    <h4 className="font-semibold mb-2">User Message</h4>
                    <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                      {selectedLog.user_message}
                    </div>
                  </div>

                  {/* AI Response */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      AI Response
                      {selectedLog.had_citations && (
                        <Badge variant="secondary" className="text-xs">Contains Citations</Badge>
                      )}
                    </h4>
                    <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                      {selectedLog.ai_response || "No response captured"}
                    </div>
                  </div>

                  {/* Lesson candidate intake (PR-2) */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Learning Loop</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Curate this interaction into a pending lesson candidate for human review.
                      Approved lessons are not yet citable.
                    </p>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => openIntake(selectedLog)}
                      data-testid="audit-create-candidate"
                    >
                      <GraduationCap className="h-4 w-4" />
                      Create lesson candidate
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            )}
          </SheetContent>
        </Sheet>

        {/* Lesson candidate intake dialog */}
        <Dialog open={!!intakeLog} onOpenChange={(open) => !open && closeIntake()}>
          <DialogContent className="sm:max-w-[600px]" data-testid="candidate-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Create lesson candidate
              </DialogTitle>
              <DialogDescription>
                Review and edit the curated lesson, then file it as pending. Source provenance
                (audit log, correlation id, tenant) is carried automatically.
              </DialogDescription>
            </DialogHeader>

            {!!existingCandidateCount && existingCandidateCount > 0 && (
              <div
                className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
                data-testid="candidate-duplicate-warning"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {existingCandidateCount} lesson candidate
                  {existingCandidateCount > 1 ? "s" : ""} already exist
                  {existingCandidateCount > 1 ? "" : "s"} for this interaction. You can still create
                  another.
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="candidate-question">Question</Label>
                <Textarea
                  id="candidate-question"
                  value={intakeQuestion}
                  onChange={(e) => setIntakeQuestion(e.target.value)}
                  className="min-h-[70px]"
                  data-testid="candidate-question"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="candidate-answer">Proposed answer</Label>
                <Textarea
                  id="candidate-answer"
                  value={intakeAnswer}
                  onChange={(e) => setIntakeAnswer(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="candidate-proposed-answer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="candidate-equipment">Equipment type (optional)</Label>
                <Input
                  id="candidate-equipment"
                  value={intakeEquipment}
                  onChange={(e) => setIntakeEquipment(e.target.value)}
                  data-testid="candidate-equipment-type"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Link
                to="/admin/lesson-review"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                View Lesson Review
              </Link>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeIntake}>
                  Cancel
                </Button>
                <Button
                  onClick={() => intakeMutation.mutate()}
                  disabled={!intakeValid || intakeMutation.isPending}
                  className="gap-2"
                  data-testid="candidate-submit"
                >
                  <GraduationCap className="h-4 w-4" />
                  Create candidate
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
