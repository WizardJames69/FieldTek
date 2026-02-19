import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, Search, Eye, FileText, Clock, Shield } from "lucide-react";

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
  created_at: string;
}

export default function AdminAIAuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBlocked, setFilterBlocked] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["ai-audit-logs", filterBlocked],
    queryFn: async () => {
      let query = supabase
        .from("ai_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filterBlocked === "blocked") {
        query = query.eq("response_blocked", true);
      } else if (filterBlocked === "passed") {
        query = query.eq("response_blocked", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const filteredLogs = auditLogs?.filter((log) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      log.user_message?.toLowerCase().includes(search) ||
      log.ai_response?.toLowerCase().includes(search) ||
      log.block_reason?.toLowerCase().includes(search) ||
      log.equipment_type?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: auditLogs?.length || 0,
    blocked: auditLogs?.filter((l) => l.response_blocked).length || 0,
    passed: auditLogs?.filter((l) => !l.response_blocked).length || 0,
    withCitations: auditLogs?.filter((l) => l.had_citations).length || 0,
    avgResponseTime: auditLogs?.length
      ? Math.round(
          auditLogs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) /
            auditLogs.length
        )
      : 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Audit Logs</h1>
        <p className="text-muted-foreground">
          Monitor AI Field Assistant interactions and blocked responses
        </p>
      </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.blocked}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? ((stats.blocked / stats.total) * 100).toFixed(1) : 0}% of total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Passed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Citations</CardTitle>
              <Shield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.withCitations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgResponseTime}ms</div>
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
              <Select value={filterBlocked} onValueChange={setFilterBlocked}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Interactions</SelectItem>
                  <SelectItem value="blocked">Blocked Only</SelectItem>
                  <SelectItem value="passed">Passed Only</SelectItem>
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
                      <TableHead className="w-[140px]">Time</TableHead>
                      <TableHead>User Message</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[100px]">Docs</TableHead>
                      <TableHead className="w-[100px]">Response</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                            {log.response_blocked ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Blocked
                              </Badge>
                            ) : (
                              <Badge variant="default" className="gap-1 bg-green-600">
                                <CheckCircle className="h-3 w-3" />
                                Passed
                              </Badge>
                            )}
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
                {selectedLog?.response_blocked ? (
                  <Badge variant="destructive">Blocked</Badge>
                ) : (
                  <Badge variant="default" className="bg-green-600">Passed</Badge>
                )}
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
                </div>
              </ScrollArea>
            )}
          </SheetContent>
        </Sheet>
      </div>
  );
}
