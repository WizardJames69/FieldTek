import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users, TrendingUp, Building2, Download, RefreshCw } from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import { toast } from "sonner";

interface WaitlistSignup {
  id: string;
  email: string;
  company_name: string | null;
  technician_count: string | null;
  industry: string | null;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
}

export default function AdminWaitlist() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: signups, isLoading, refetch } = useQuery({
    queryKey: ["admin-waitlist-signups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist_signups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WaitlistSignup[];
    },
  });

  const filteredSignups = signups?.filter((signup) => {
    const query = searchQuery.toLowerCase();
    return (
      signup.email.toLowerCase().includes(query) ||
      signup.company_name?.toLowerCase().includes(query) ||
      signup.industry?.toLowerCase().includes(query)
    );
  });

  // Calculate statistics
  const totalSignups = signups?.length || 0;
  const signupsThisWeek = signups?.filter((s) =>
    isAfter(new Date(s.created_at), subDays(new Date(), 7))
  ).length || 0;

  const industryCount = signups?.reduce((acc, s) => {
    if (s.industry) {
      acc[s.industry] = (acc[s.industry] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const topIndustry = Object.entries(industryCount).sort((a, b) => b[1] - a[1])[0];

  // Traffic source breakdown
  const sourceCount = signups?.reduce((acc, s) => {
    const source = s.utm_source || "direct";
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const sortedSources = Object.entries(sourceCount).sort((a, b) => b[1] - a[1]);

  const handleExportCSV = () => {
    if (!signups || signups.length === 0) {
      toast.error("No signups to export");
      return;
    }

    const headers = ["Email", "Company", "Team Size", "Industry", "Source", "Signed Up"];
    const rows = signups.map((s) => [
      s.email,
      s.company_name || "",
      s.technician_count || "",
      s.industry || "",
      s.source || "",
      format(new Date(s.created_at), "yyyy-MM-dd HH:mm"),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fieldtek-waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Waitlist exported successfully");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Waitlist Signups</h1>
        <p className="text-muted-foreground">
          Track and manage early access requests
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Signups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSignups}</div>
            <p className="text-xs text-muted-foreground">
              All time waitlist signups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{signupsThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              New signups in the last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Industry</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {topIndustry ? topIndustry[0] : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {topIndustry
                ? `${topIndustry[1]} signups (${Math.round((topIndustry[1] / totalSignups) * 100)}%)`
                : "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Traffic Sources</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {sortedSources.slice(0, 3).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between text-xs">
                  <span className="capitalize truncate">{source}</span>
                  <Badge variant="secondary" className="ml-1">{count}</Badge>
                </div>
              ))}
              {sortedSources.length === 0 && (
                <p className="text-xs text-muted-foreground">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All Signups</CardTitle>
              <CardDescription>
                {filteredSignups?.length || 0} signup{filteredSignups?.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email, company, or industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredSignups && filteredSignups.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Team Size</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>UTM Source</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Signed Up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSignups.map((signup) => (
                    <TableRow key={signup.id}>
                      <TableCell className="font-medium">{signup.email}</TableCell>
                      <TableCell>{signup.company_name || "—"}</TableCell>
                      <TableCell>{signup.technician_count || "—"}</TableCell>
                      <TableCell>
                        {signup.industry ? (
                          <Badge variant="secondary" className="capitalize">{signup.industry}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {signup.utm_source || "direct"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {signup.utm_campaign ? (
                          <Badge variant="secondary" className="text-xs">{signup.utm_campaign}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(signup.created_at), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No signups yet</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No signups match your search criteria"
                  : "Waitlist signups will appear here"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
