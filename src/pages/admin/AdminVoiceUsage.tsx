import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Volume2, Mic, MessageCircle, TrendingUp } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { cn } from "@/lib/utils";

interface VoiceLog {
  id: string;
  tenant_id: string | null;
  user_id: string;
  function_name: string;
  character_count: number;
  duration_seconds: number;
  model_id: string | null;
  voice_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const FUNCTION_COLORS: Record<string, string> = {
  tts: "hsl(var(--primary))",
  scribe: "hsl(var(--info))",
  conversation: "hsl(var(--warning))",
};

const FUNCTION_ICONS: Record<string, typeof Volume2> = {
  tts: Volume2,
  scribe: Mic,
  conversation: MessageCircle,
};

const FUNCTION_LABELS: Record<string, string> = {
  tts: "Text-to-Speech",
  scribe: "Transcription",
  conversation: "Voice Agent",
};

export default function AdminVoiceUsage() {
  const [period, setPeriod] = useState("30");

  const startDate = useMemo(() => startOfDay(subDays(new Date(), parseInt(period))).toISOString(), [period]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-voice-usage", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_usage_logs")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as VoiceLog[];
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["admin-tenants-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name");
      if (error) throw error;
      return new Map(data.map((t) => [t.id, t.name]));
    },
  });

  // Aggregate stats
  const stats = useMemo(() => {
    if (!logs) return null;

    const totalCalls = logs.length;
    const totalChars = logs.reduce((s, l) => s + (l.character_count || 0), 0);
    const byFunction: Record<string, number> = {};
    const byTenant: Record<string, { calls: number; chars: number; name: string }> = {};
    const byDay: Record<string, Record<string, number>> = {};

    for (const log of logs) {
      // By function
      byFunction[log.function_name] = (byFunction[log.function_name] || 0) + 1;

      // By tenant
      const tid = log.tenant_id || "unknown";
      if (!byTenant[tid]) byTenant[tid] = { calls: 0, chars: 0, name: tenants?.get(tid) || "Unknown" };
      byTenant[tid].calls++;
      byTenant[tid].chars += log.character_count || 0;

      // By day
      const day = format(new Date(log.created_at), "MM/dd");
      if (!byDay[day]) byDay[day] = {};
      byDay[day][log.function_name] = (byDay[day][log.function_name] || 0) + 1;
    }

    // Sort tenants by calls desc
    const topTenants = Object.entries(byTenant)
      .sort((a, b) => b[1].calls - a[1].calls)
      .slice(0, 10);

    // Build daily chart data
    const dailyData = Object.entries(byDay)
      .map(([day, funcs]) => ({ day, tts: funcs.tts || 0, scribe: funcs.scribe || 0, conversation: funcs.conversation || 0 }))
      .reverse();

    // Pie data
    const pieData = Object.entries(byFunction).map(([name, value]) => ({
      name: FUNCTION_LABELS[name] || name,
      value,
      color: FUNCTION_COLORS[name] || "hsl(var(--muted))",
    }));

    return { totalCalls, totalChars, byFunction, topTenants, dailyData, pieData };
  }, [logs, tenants]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Voice Usage</h1>
          <p className="text-muted-foreground text-sm">ElevenLabs TTS, Scribe & Conversation usage across tenants</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{stats?.totalCalls || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {(["tts", "scribe", "conversation"] as const).map((fn) => {
          const Icon = FUNCTION_ICONS[fn];
          return (
            <Card key={fn}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${FUNCTION_COLORS[fn]}20` }}>
                    <Icon className="h-5 w-5" style={{ color: FUNCTION_COLORS[fn] }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{FUNCTION_LABELS[fn]}</p>
                    <p className="text-2xl font-bold">{stats?.byFunction[fn] || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Usage Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily Usage</CardTitle>
            <CardDescription>API calls by type over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.dailyData || []}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="tts" name="TTS" fill={FUNCTION_COLORS.tts} stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="scribe" name="Scribe" fill={FUNCTION_COLORS.scribe} stackId="a" />
                  <Bar dataKey="conversation" name="Voice Agent" fill={FUNCTION_COLORS.conversation} stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown</CardTitle>
            <CardDescription>Usage by function type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.pieData || []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {stats?.pieData?.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Tenants by Voice Usage</CardTitle>
          <CardDescription>Tenants consuming the most voice API calls</CardDescription>
        </CardHeader>
        <CardContent>
          {!stats?.topTenants?.length ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No voice usage data yet</p>
          ) : (
            <div className="space-y-3">
              {stats.topTenants.map(([tenantId, data], index) => (
                <div
                  key={tenantId}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 ? "bg-warning/20 text-warning" :
                      index === 1 ? "bg-muted text-muted-foreground" :
                      index === 2 ? "bg-warning/10 text-warning/70" :
                      "bg-muted/50 text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{data.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {data.chars > 0 ? `${(data.chars / 1000).toFixed(1)}k characters` : "Token-based"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {data.calls} calls
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
