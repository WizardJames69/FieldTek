import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Users, CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface RevenueData {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  tierBreakdown: {
    starter: { count: number; revenue: number };
    growth: { count: number; revenue: number };
    professional: { count: number; revenue: number };
  };
  paymentHistory: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: string;
    customerEmail: string;
    description: string;
  }>;
  revenueTrend: Array<{
    month: string;
    revenue: number;
  }>;
}

const TIER_COLORS = {
  starter: "#22c55e",
  growth: "#3b82f6",
  professional: "#a855f7",
};

const TIER_LABELS = {
  starter: "Starter",
  growth: "Growth",
  professional: "Professional",
};

export default function AdminRevenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRevenueData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: result, error } = await supabase.functions.invoke("admin-revenue", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      setData(result);
    } catch (err) {
      console.error("Failed to fetch revenue data:", err);
      toast.error("Failed to load revenue data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRevenueData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const pieData = data
    ? Object.entries(data.tierBreakdown).map(([tier, info]) => ({
        name: TIER_LABELS[tier as keyof typeof TIER_LABELS],
        value: info.count,
        revenue: info.revenue,
        color: TIER_COLORS[tier as keyof typeof TIER_COLORS],
      }))
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
          <p className="text-muted-foreground">Monitor your subscription revenue and payment activity</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Recurring Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.mrr || 0)}</div>
            <p className="text-xs text-muted-foreground">MRR from active subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Annual Recurring Revenue
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.arr || 0)}</div>
            <p className="text-xs text-muted-foreground">Projected yearly revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeSubscriptions || 0}</div>
            <p className="text-xs text-muted-foreground">Paying customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Revenue Per User
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                data?.activeSubscriptions
                  ? data.mrr / data.activeSubscriptions
                  : 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">ARPU per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {data?.revenueTrend && data.revenueTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="month"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No revenue data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Tier Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Tier Breakdown</CardTitle>
            <CardDescription>Distribution of customers by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {pieData.some((d) => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string, props) => [
                        `${value} customers (${formatCurrency(props.payload.revenue)}/mo)`,
                        name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No subscription data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(data?.tierBreakdown || {}).map(([tier, info]) => (
          <Card key={tier}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {TIER_LABELS[tier as keyof typeof TIER_LABELS]}
                  </p>
                  <p className="text-2xl font-bold">{formatCurrency(info.revenue)}</p>
                </div>
                <Badge
                  style={{ backgroundColor: TIER_COLORS[tier as keyof typeof TIER_COLORS] }}
                  className="text-white"
                >
                  {info.count} {info.count === 1 ? "sub" : "subs"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Last 50 payment transactions from Stripe</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.paymentHistory && data.paymentHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.paymentHistory.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{formatDate(payment.created)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{payment.customerEmail}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {payment.description}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={payment.status === "succeeded" ? "default" : "secondary"}
                        className={payment.status === "succeeded" ? "bg-green-500" : ""}
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No payment history available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
