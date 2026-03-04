import { useState, useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  Activity, ShieldCheck, Search, Brain, TrendingUp, AlertTriangle,
} from "lucide-react";
import { format, subDays } from "date-fns";

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const DATE_RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, description }: {
  title: string; value: string | number; icon: React.ElementType; description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs md:text-sm text-muted-foreground">{title}</p>
            <p className="text-xl md:text-2xl font-bold mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <Icon className="h-5 w-5 text-primary flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Memoized Charts ───────────────────────────────────────────

const DailyTrendsChart = memo(function DailyTrendsChart({ data }: { data: { date: string; queries: number; groundedPct: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily Trends</CardTitle>
        <CardDescription>Queries and grounding rate over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} className="text-xs" />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="queries" stroke="#2563eb" name="Queries" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="groundedPct" stroke="#10b981" name="Grounded %" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

const DistributionPieChart = memo(function DistributionPieChart({ data, title, description }: {
  data: { name: string; value: number }[]; title: string; description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

const BarDistributionChart = memo(function BarDistributionChart({ data, title, description, dataKey }: {
  data: { name: string; value: number }[]; title: string; description: string; dataKey?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey={dataKey || "value"} fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

// ── Main Page ─────────────────────────────────────────────────

export default function AdminRAGQuality() {
  const [dateRange, setDateRange] = useState(30);
  const startDate = useMemo(() => subDays(new Date(), dateRange).toISOString(), [dateRange]);

  // Fetch audit logs for the selected period
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["rag-quality-audit", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_audit_logs")
        .select("created_at, response_blocked, response_time_ms, semantic_search_count, avg_similarity, max_similarity, judge_grounded, judge_confidence, judge_contradiction, judge_verdict, rerank_model, graph_expansion_count, compliance_rules_evaluated, abstain_flag, human_review_required")
        .gte("created_at", startDate)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Computed Metrics ────────────────────────────────────────

  const overviewStats = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return null;
    const total = auditLogs.length;
    const blocked = auditLogs.filter(l => l.response_blocked).length;
    const judgeEvaluated = auditLogs.filter(l => l.judge_grounded !== null);
    const grounded = judgeEvaluated.filter(l => l.judge_grounded === true).length;
    const groundedPct = judgeEvaluated.length > 0 ? Math.round((grounded / judgeEvaluated.length) * 100) : 0;
    const avgConfidence = judgeEvaluated.length > 0
      ? (judgeEvaluated.reduce((s, l) => s + (l.judge_confidence || 0), 0) / judgeEvaluated.length).toFixed(1)
      : "N/A";
    const contradictions = judgeEvaluated.filter(l => l.judge_contradiction === true).length;
    const contradictionPct = judgeEvaluated.length > 0 ? Math.round((contradictions / judgeEvaluated.length) * 100) : 0;
    const avgResponseTime = Math.round(auditLogs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / total);

    return { total, blocked, groundedPct, avgConfidence, contradictionPct, avgResponseTime, judgeEvaluated: judgeEvaluated.length };
  }, [auditLogs]);

  const dailyTrends = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return [];
    const byDay: Record<string, { queries: number; grounded: number; judged: number }> = {};
    for (const log of auditLogs) {
      const day = format(new Date(log.created_at), "MM/dd");
      if (!byDay[day]) byDay[day] = { queries: 0, grounded: 0, judged: 0 };
      byDay[day].queries++;
      if (log.judge_grounded !== null) {
        byDay[day].judged++;
        if (log.judge_grounded) byDay[day].grounded++;
      }
    }
    return Object.entries(byDay).map(([date, d]) => ({
      date,
      queries: d.queries,
      groundedPct: d.judged > 0 ? Math.round((d.grounded / d.judged) * 100) : 0,
    }));
  }, [auditLogs]);

  const outcomeDistribution = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return [];
    const blocked = auditLogs.filter(l => l.response_blocked).length;
    const humanReview = auditLogs.filter(l => l.human_review_required && !l.response_blocked).length;
    const abstained = auditLogs.filter(l => l.abstain_flag && !l.response_blocked).length;
    const passed = auditLogs.length - blocked - humanReview - abstained;
    return [
      { name: "Passed", value: Math.max(0, passed) },
      { name: "Blocked", value: blocked },
      { name: "Human Review", value: humanReview },
      { name: "Abstained", value: abstained },
    ].filter(d => d.value > 0);
  }, [auditLogs]);

  // ── Retrieval Metrics ──────────────────────────────────────

  const retrievalStats = useMemo(() => {
    if (!auditLogs || auditLogs.length === 0) return null;
    const withSearch = auditLogs.filter(l => l.semantic_search_count !== null && l.semantic_search_count > 0);
    const avgSim = withSearch.length > 0
      ? (withSearch.reduce((s, l) => s + (l.avg_similarity || 0), 0) / withSearch.length).toFixed(3)
      : "N/A";
    const avgChunks = withSearch.length > 0
      ? (withSearch.reduce((s, l) => s + (l.semantic_search_count || 0), 0) / withSearch.length).toFixed(1)
      : "N/A";
    const abstainRate = auditLogs.length > 0
      ? Math.round((auditLogs.filter(l => l.abstain_flag).length / auditLogs.length) * 100)
      : 0;
    const withGraph = auditLogs.filter(l => (l.graph_expansion_count || 0) > 0).length;
    const graphRate = auditLogs.length > 0 ? Math.round((withGraph / auditLogs.length) * 100) : 0;

    return { avgSim, avgChunks, abstainRate, graphRate, withGraph };
  }, [auditLogs]);

  const chunkDistribution = useMemo(() => {
    if (!auditLogs) return [];
    const buckets: Record<string, number> = { "0": 0, "1-3": 0, "4-7": 0, "8+": 0 };
    for (const l of auditLogs) {
      const count = l.semantic_search_count || 0;
      if (count === 0) buckets["0"]++;
      else if (count <= 3) buckets["1-3"]++;
      else if (count <= 7) buckets["4-7"]++;
      else buckets["8+"]++;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [auditLogs]);

  // ── Judge Metrics ──────────────────────────────────────────

  const judgeStats = useMemo(() => {
    if (!auditLogs) return null;
    const evaluated = auditLogs.filter(l => l.judge_grounded !== null);
    if (evaluated.length === 0) return null;
    const grounded = evaluated.filter(l => l.judge_grounded === true).length;
    const ungrounded = evaluated.filter(l => l.judge_grounded === false).length;
    const contradictions = evaluated.filter(l => l.judge_contradiction === true).length;
    const warnAppended = auditLogs.filter(l => l.judge_verdict === "warn_appended").length;
    return {
      evaluated: evaluated.length,
      groundedPct: Math.round((grounded / evaluated.length) * 100),
      ungroundedPct: Math.round((ungrounded / evaluated.length) * 100),
      contradictionPct: Math.round((contradictions / evaluated.length) * 100),
      warnAppended,
    };
  }, [auditLogs]);

  const confidenceDistribution = useMemo(() => {
    if (!auditLogs) return [];
    const buckets: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const l of auditLogs) {
      if (l.judge_confidence !== null) {
        const key = String(Math.min(5, Math.max(1, Math.round(l.judge_confidence))));
        buckets[key] = (buckets[key] || 0) + 1;
      }
    }
    return Object.entries(buckets).map(([name, value]) => ({ name: `Score ${name}`, value }));
  }, [auditLogs]);

  // ── Compliance Metrics ─────────────────────────────────────

  const complianceStats = useMemo(() => {
    if (!auditLogs) return null;
    const withRules = auditLogs.filter(l => l.compliance_rules_evaluated && l.compliance_rules_evaluated.length > 0);
    if (withRules.length === 0) return null;
    const totalRules = withRules.reduce((s, l) => s + (l.compliance_rules_evaluated?.length || 0), 0);
    return { evaluatedQueries: withRules.length, totalRules };
  }, [auditLogs]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">RAG Quality Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">RAG Quality Dashboard</h1>
        <Tabs value={String(dateRange)} onValueChange={(v) => setDateRange(Number(v))}>
          <TabsList>
            {DATE_RANGES.map(r => (
              <TabsTrigger key={r.days} value={String(r.days)}>{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
          <TabsTrigger value="judge">Judge</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Total Queries" value={overviewStats?.total || 0} icon={Activity} />
            <StatCard title="Grounding Rate" value={overviewStats ? `${overviewStats.groundedPct}%` : "N/A"} icon={ShieldCheck} description={`${overviewStats?.judgeEvaluated || 0} evaluated`} />
            <StatCard title="Avg Confidence" value={overviewStats?.avgConfidence || "N/A"} icon={Brain} />
            <StatCard title="Avg Response Time" value={overviewStats ? `${overviewStats.avgResponseTime}ms` : "N/A"} icon={TrendingUp} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DailyTrendsChart data={dailyTrends} />
            <DistributionPieChart data={outcomeDistribution} title="Response Outcomes" description="Distribution of response outcomes" />
          </div>
        </TabsContent>

        {/* ── Retrieval Tab ─────────────────────────────────────── */}
        <TabsContent value="retrieval" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Avg Similarity" value={retrievalStats?.avgSim || "N/A"} icon={Search} />
            <StatCard title="Avg Chunks" value={retrievalStats?.avgChunks || "N/A"} icon={Activity} />
            <StatCard title="Abstain Rate" value={retrievalStats ? `${retrievalStats.abstainRate}%` : "N/A"} icon={AlertTriangle} />
            <StatCard title="Graph Expansion" value={retrievalStats ? `${retrievalStats.graphRate}%` : "N/A"} icon={TrendingUp} description={`${retrievalStats?.withGraph || 0} queries enriched`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarDistributionChart data={chunkDistribution} title="Chunk Count Distribution" description="Number of chunks retrieved per query" />
          </div>
        </TabsContent>

        {/* ── Judge Tab ─────────────────────────────────────────── */}
        <TabsContent value="judge" className="space-y-4">
          {judgeStats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="Evaluated" value={judgeStats.evaluated} icon={Brain} />
                <StatCard title="Grounded" value={`${judgeStats.groundedPct}%`} icon={ShieldCheck} />
                <StatCard title="Contradiction Rate" value={`${judgeStats.contradictionPct}%`} icon={AlertTriangle} />
                <StatCard title="Warnings Appended" value={judgeStats.warnAppended} icon={AlertTriangle} description="Judge blocking mode" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BarDistributionChart data={confidenceDistribution} title="Confidence Score Distribution" description="Judge confidence scores (1-5)" />
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No judge evaluations found in this period. Enable the <code>rag_judge</code> feature flag to start collecting grounding data.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Compliance Tab ────────────────────────────────────── */}
        <TabsContent value="compliance" className="space-y-4">
          {complianceStats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard title="Queries with Rules" value={complianceStats.evaluatedQueries} icon={ShieldCheck} />
              <StatCard title="Total Rules Evaluated" value={complianceStats.totalRules} icon={Activity} />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No compliance evaluations found in this period. Enable the <code>compliance_engine</code> feature flag to start collecting compliance data.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
