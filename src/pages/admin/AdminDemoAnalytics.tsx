import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Play, CheckCircle, Clock, UserPlus, Volume2, MousePointerClick, Eye, ArrowRight, Thermometer, Droplet, Zap, Wrench, TrendingUp } from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Json } from "@/integrations/supabase/types";

const INDUSTRY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  hvac: { label: 'HVAC', icon: Thermometer, color: '#ef4444' },
  plumbing: { label: 'Plumbing', icon: Droplet, color: '#3b82f6' },
  electrical: { label: 'Electrical', icon: Zap, color: '#f59e0b' },
  general: { label: 'General', icon: Wrench, color: '#6b7280' },
};

interface DemoSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  completed: boolean;
  lead_captured: boolean;
  duration_seconds: number | null;
  scenes_viewed: string[];
}

interface SandboxSession {
  id: string;
  created_at: string | null;
  last_activity_at: string | null;
  features_explored: Json | null;
  pages_visited: Json | null;
  converted_to_trial: boolean | null;
  email: string | null;
  name: string | null;
  company_name: string | null;
  industry: string | null;
}

interface DemoAnalyticsData {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  avgDuration: number;
  leadsCapturerd: number;
  leadCaptureRate: number;
  dailySessions: { date: string; started: number; completed: number }[];
  sceneEngagement: { name: string; views: number }[];
  durationDistribution: { range: string; count: number }[];
  conversionFunnel: { stage: string; count: number; rate: number }[];
}

interface IndustryStats {
  industry: string;
  label: string;
  sessions: number;
  leads: number;
  conversions: number;
  leadCaptureRate: number;
  conversionRate: number;
}

interface SandboxAnalyticsData {
  totalSessions: number;
  sessionsWithLeads: number;
  leadCaptureRate: number;
  conversions: number;
  conversionRate: number;
  dailySessions: { date: string; sessions: number; leads: number; conversions: number }[];
  featureExploration: { feature: string; count: number; percentage: number }[];
  pageVisits: { page: string; count: number }[];
  industryBreakdown: { industry: string; count: number }[];
  industryConversionStats: IndustryStats[];
  conversionFunnel: { stage: string; count: number; rate: number }[];
}

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const SCENE_NAMES = ['Request', 'Schedule', 'Mobile', 'AI', 'Invoice'];
const FEATURE_NAMES: Record<string, string> = {
  'dashboard': 'Dashboard',
  'jobs': 'Jobs Management',
  'clients': 'Client Database',
  'schedule': 'Scheduling',
  'equipment': 'Equipment Registry',
  'invoices': 'Invoicing',
};

export default function AdminDemoAnalytics() {
  const [voiceData, setVoiceData] = useState<DemoAnalyticsData | null>(null);
  const [sandboxData, setSandboxData] = useState<SandboxAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchVoiceDemoAnalytics(), fetchSandboxAnalytics()]).finally(() => {
      setLoading(false);
    });
  }, []);

  async function fetchVoiceDemoAnalytics() {
    const { data: sessions, error } = await supabase
      .from('demo_sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch demo sessions:', error);
      return;
    }

    const allSessions = (sessions || []) as DemoSession[];
    
    const totalSessions = allSessions.length;
    const completedSessions = allSessions.filter(s => s.completed).length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
    
    const sessionsWithDuration = allSessions.filter(s => s.duration_seconds && s.duration_seconds > 0);
    const avgDuration = sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / sessionsWithDuration.length
      : 0;
    
    const leadsCapturerd = allSessions.filter(s => s.lead_captured).length;
    const leadCaptureRate = totalSessions > 0 ? (leadsCapturerd / totalSessions) * 100 : 0;

    const last14Days = eachDayOfInterval({
      start: subDays(new Date(), 13),
      end: new Date()
    });
    
    const sessionsByDate: Record<string, { started: number; completed: number }> = {};
    allSessions.forEach(s => {
      if (s.started_at) {
        const date = format(new Date(s.started_at), "yyyy-MM-dd");
        if (!sessionsByDate[date]) {
          sessionsByDate[date] = { started: 0, completed: 0 };
        }
        sessionsByDate[date].started++;
        if (s.completed) {
          sessionsByDate[date].completed++;
        }
      }
    });

    const dailySessions = last14Days.map(date => ({
      date: format(date, "MMM d"),
      started: sessionsByDate[format(date, "yyyy-MM-dd")]?.started || 0,
      completed: sessionsByDate[format(date, "yyyy-MM-dd")]?.completed || 0,
    }));

    const sceneCount: Record<string, number> = {};
    allSessions.forEach(s => {
      if (Array.isArray(s.scenes_viewed)) {
        s.scenes_viewed.forEach((scene: string) => {
          const sceneName = SCENE_NAMES[Number(scene)] || scene;
          sceneCount[sceneName] = (sceneCount[sceneName] || 0) + 1;
        });
      }
    });
    const sceneEngagement = SCENE_NAMES.map(name => ({
      name,
      views: sceneCount[name] || 0
    }));

    const durationBuckets = [
      { range: '< 1 min', min: 0, max: 60 },
      { range: '1-3 min', min: 60, max: 180 },
      { range: '3-5 min', min: 180, max: 300 },
      { range: '5-10 min', min: 300, max: 600 },
      { range: '> 10 min', min: 600, max: Infinity },
    ];
    const durationDistribution = durationBuckets.map(bucket => ({
      range: bucket.range,
      count: allSessions.filter(s => {
        const dur = s.duration_seconds || 0;
        return dur >= bucket.min && dur < bucket.max;
      }).length
    }));

    const conversionFunnel = [
      { stage: 'Started Demo', count: totalSessions, rate: 100 },
      { stage: 'Viewed 2+ Scenes', count: allSessions.filter(s => Array.isArray(s.scenes_viewed) && s.scenes_viewed.length >= 2).length, rate: 0 },
      { stage: 'Completed Demo', count: completedSessions, rate: 0 },
      { stage: 'Lead Captured', count: leadsCapturerd, rate: 0 },
    ];
    conversionFunnel.forEach((stage, i) => {
      if (i > 0 && conversionFunnel[0].count > 0) {
        stage.rate = (stage.count / conversionFunnel[0].count) * 100;
      }
    });

    setVoiceData({
      totalSessions,
      completedSessions,
      completionRate,
      avgDuration,
      leadsCapturerd,
      leadCaptureRate,
      dailySessions,
      sceneEngagement,
      durationDistribution,
      conversionFunnel,
    });
  }

  async function fetchSandboxAnalytics() {
    const { data: sessions, error } = await supabase
      .from('demo_sandbox_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch sandbox sessions:', error);
      return;
    }

    const allSessions = (sessions || []) as SandboxSession[];
    
    const totalSessions = allSessions.length;
    const sessionsWithLeads = allSessions.filter(s => s.email).length;
    const leadCaptureRate = totalSessions > 0 ? (sessionsWithLeads / totalSessions) * 100 : 0;
    const conversions = allSessions.filter(s => s.converted_to_trial).length;
    const conversionRate = totalSessions > 0 ? (conversions / totalSessions) * 100 : 0;

    // Daily sessions (last 14 days)
    const last14Days = eachDayOfInterval({
      start: subDays(new Date(), 13),
      end: new Date()
    });
    
    const sessionsByDate: Record<string, { sessions: number; leads: number; conversions: number }> = {};
    allSessions.forEach(s => {
      if (s.created_at) {
        const date = format(new Date(s.created_at), "yyyy-MM-dd");
        if (!sessionsByDate[date]) {
          sessionsByDate[date] = { sessions: 0, leads: 0, conversions: 0 };
        }
        sessionsByDate[date].sessions++;
        if (s.email) sessionsByDate[date].leads++;
        if (s.converted_to_trial) sessionsByDate[date].conversions++;
      }
    });

    const dailySessions = last14Days.map(date => ({
      date: format(date, "MMM d"),
      sessions: sessionsByDate[format(date, "yyyy-MM-dd")]?.sessions || 0,
      leads: sessionsByDate[format(date, "yyyy-MM-dd")]?.leads || 0,
      conversions: sessionsByDate[format(date, "yyyy-MM-dd")]?.conversions || 0,
    }));

    // Feature exploration rates
    const featureCounts: Record<string, number> = {};
    allSessions.forEach(s => {
      if (Array.isArray(s.features_explored)) {
        (s.features_explored as string[]).forEach(feature => {
          featureCounts[feature] = (featureCounts[feature] || 0) + 1;
        });
      }
    });
    
    const featureExploration = Object.entries(FEATURE_NAMES).map(([key, name]) => ({
      feature: name,
      count: featureCounts[key] || 0,
      percentage: totalSessions > 0 ? ((featureCounts[key] || 0) / totalSessions) * 100 : 0,
    })).sort((a, b) => b.count - a.count);

    // Page visits
    const pageCounts: Record<string, number> = {};
    allSessions.forEach(s => {
      if (Array.isArray(s.pages_visited)) {
        (s.pages_visited as string[]).forEach(page => {
          const pageName = page.replace('/demo/', '').replace('/demo', 'Home') || 'Home';
          pageCounts[pageName] = (pageCounts[pageName] || 0) + 1;
        });
      }
    });
    
    const pageVisits = Object.entries(pageCounts)
      .map(([page, count]) => ({ page: page.charAt(0).toUpperCase() + page.slice(1), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Industry breakdown with conversion stats
    const industryData: Record<string, { sessions: number; leads: number; conversions: number }> = {};
    allSessions.forEach(s => {
      if (s.industry) {
        if (!industryData[s.industry]) {
          industryData[s.industry] = { sessions: 0, leads: 0, conversions: 0 };
        }
        industryData[s.industry].sessions++;
        if (s.email) industryData[s.industry].leads++;
        if (s.converted_to_trial) industryData[s.industry].conversions++;
      }
    });
    
    const industryBreakdown = Object.entries(industryData)
      .map(([industry, data]) => ({ industry, count: data.sessions }))
      .sort((a, b) => b.count - a.count);

    const industryConversionStats: IndustryStats[] = Object.entries(industryData)
      .map(([industry, data]) => ({
        industry,
        label: INDUSTRY_CONFIG[industry]?.label || industry,
        sessions: data.sessions,
        leads: data.leads,
        conversions: data.conversions,
        leadCaptureRate: data.sessions > 0 ? (data.leads / data.sessions) * 100 : 0,
        conversionRate: data.sessions > 0 ? (data.conversions / data.sessions) * 100 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    // Conversion funnel
    const withMultipleFeatures = allSessions.filter(s => 
      Array.isArray(s.features_explored) && (s.features_explored as string[]).length >= 2
    ).length;

    const conversionFunnel = [
      { stage: 'Started Sandbox', count: totalSessions, rate: 100 },
      { stage: 'Explored 2+ Features', count: withMultipleFeatures, rate: 0 },
      { stage: 'Provided Contact', count: sessionsWithLeads, rate: 0 },
      { stage: 'Converted to Trial', count: conversions, rate: 0 },
    ];
    conversionFunnel.forEach((stage, i) => {
      if (i > 0 && conversionFunnel[0].count > 0) {
        stage.rate = (stage.count / conversionFunnel[0].count) * 100;
      }
    });

    setSandboxData({
      totalSessions,
      sessionsWithLeads,
      leadCaptureRate,
      conversions,
      conversionRate,
      dailySessions,
      featureExploration,
      pageVisits,
      industryBreakdown,
      industryConversionStats,
      conversionFunnel,
    });
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-80 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Demo Analytics</h1>
        <p className="text-muted-foreground">
          Track engagement and conversions across all demo experiences
        </p>
      </div>

      <Tabs defaultValue="sandbox" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sandbox" className="gap-2">
            <MousePointerClick className="h-4 w-4" />
            Interactive Sandbox
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <Volume2 className="h-4 w-4" />
            AI Voice Demo
          </TabsTrigger>
        </TabsList>

        {/* Sandbox Analytics Tab */}
        <TabsContent value="sandbox" className="space-y-6">
          {sandboxData ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Eye className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{sandboxData.totalSessions}</p>
                        <p className="text-sm text-muted-foreground">Sandbox Sessions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <UserPlus className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{sandboxData.sessionsWithLeads}</p>
                        <p className="text-sm text-muted-foreground">Leads ({sandboxData.leadCaptureRate.toFixed(1)}%)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <ArrowRight className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{sandboxData.conversions}</p>
                        <p className="text-sm text-muted-foreground">Trial Conversions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{sandboxData.conversionRate.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Conversion Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Sessions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Sandbox Sessions Over Time</CardTitle>
                    <CardDescription>Sessions, leads, and conversions (last 14 days)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sandboxData.dailySessions}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }} 
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="sessions" 
                            name="Sessions"
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="leads" 
                            name="Leads"
                            stroke="#8b5cf6" 
                            strokeWidth={2}
                            dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="conversions" 
                            name="Conversions"
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{ fill: "#10b981", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Conversion Funnel */}
                <Card>
                  <CardHeader>
                    <CardTitle>Sandbox Conversion Funnel</CardTitle>
                    <CardDescription>User progression through sandbox</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sandboxData.conversionFunnel.map((stage, index) => (
                        <div key={stage.stage} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{stage.stage}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{stage.count}</span>
                              <Badge variant={index === 0 ? "default" : "secondary"}>
                                {stage.rate.toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${stage.rate}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Feature Exploration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Feature Exploration Rates</CardTitle>
                    <CardDescription>Which features users explore most</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sandboxData.featureExploration} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} domain={[0, 100]} unit="%" />
                          <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} tickLine={false} width={110} />
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Bar dataKey="percentage" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Industry Breakdown Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Industry Distribution</CardTitle>
                    <CardDescription>Demo sessions by industry</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sandboxData.industryBreakdown.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={sandboxData.industryBreakdown.map(item => ({
                                ...item,
                                label: INDUSTRY_CONFIG[item.industry]?.label || item.industry
                              }))}
                              dataKey="count"
                              nameKey="label"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {sandboxData.industryBreakdown.map((item, index) => (
                                <Cell key={`cell-${index}`} fill={INDUSTRY_CONFIG[item.industry]?.color || COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-muted-foreground">
                        No industry data collected yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Industry Conversion Analytics */}
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Industry Conversion Comparison
                    </CardTitle>
                    <CardDescription>Conversion rates by industry - identify highest performing segments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sandboxData.industryConversionStats.length > 0 ? (
                      <div className="space-y-6">
                        {/* Conversion Rate Bar Chart */}
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={sandboxData.industryConversionStats}
                              layout="vertical"
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} tickLine={false} />
                              <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} tickLine={false} width={80} />
                              <Tooltip 
                                formatter={(value: number, name: string) => [
                                  `${value.toFixed(1)}%`, 
                                  name === 'conversionRate' ? 'Trial Conversion' : 'Lead Capture'
                                ]}
                              />
                              <Bar dataKey="leadCaptureRate" name="Lead Capture" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="conversionRate" name="Trial Conversion" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Industry Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {sandboxData.industryConversionStats.map((stat) => {
                            const config = INDUSTRY_CONFIG[stat.industry];
                            const Icon = config?.icon || Wrench;
                            return (
                              <div 
                                key={stat.industry}
                                className="p-4 rounded-lg border bg-card"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <div 
                                    className="p-2 rounded-lg"
                                    style={{ backgroundColor: `${config?.color}20` }}
                                  >
                                    <Icon className="h-4 w-4" style={{ color: config?.color }} />
                                  </div>
                                  <span className="font-medium">{stat.label}</span>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Sessions</span>
                                    <span className="font-medium">{stat.sessions}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Leads</span>
                                    <span className="font-medium">{stat.leads} ({stat.leadCaptureRate.toFixed(0)}%)</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Conversions</span>
                                    <span className="font-medium text-green-600">{stat.conversions} ({stat.conversionRate.toFixed(0)}%)</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-muted-foreground">
                        No industry conversion data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No sandbox session data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Voice Demo Analytics Tab */}
        <TabsContent value="voice" className="space-y-6">
          {voiceData ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Play className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{voiceData.totalSessions}</p>
                        <p className="text-sm text-muted-foreground">Total Demos Started</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{voiceData.completionRate.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Clock className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{formatDuration(voiceData.avgDuration)}</p>
                        <p className="text-sm text-muted-foreground">Avg. Duration</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <UserPlus className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{voiceData.leadsCapturerd}</p>
                        <p className="text-sm text-muted-foreground">Leads ({voiceData.leadCaptureRate.toFixed(1)}%)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Demo Sessions Over Time</CardTitle>
                    <CardDescription>Started vs completed demos (last 14 days)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={voiceData.dailySessions}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }} 
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                          <Tooltip />
                          <Line 
                            type="monotone" 
                            dataKey="started" 
                            name="Started"
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="completed" 
                            name="Completed"
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{ fill: "#10b981", strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Conversion Funnel</CardTitle>
                    <CardDescription>Demo progression stages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {voiceData.conversionFunnel.map((stage, index) => (
                        <div key={stage.stage} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{stage.stage}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{stage.count}</span>
                              <Badge variant={index === 0 ? "default" : "secondary"}>
                                {stage.rate.toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${stage.rate}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Scene Engagement</CardTitle>
                    <CardDescription>Which scenes get the most views</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={voiceData.sceneEngagement} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} width={80} />
                          <Tooltip />
                          <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Session Duration</CardTitle>
                    <CardDescription>How long users engage with the demo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={voiceData.durationDistribution}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="range" tick={{ fontSize: 12 }} tickLine={false} />
                          <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No voice demo data available
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
