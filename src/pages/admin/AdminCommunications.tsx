import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Users, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CampaignTargetAudience {
  type: "all" | "tier" | "industry";
  value?: string;
}

interface Campaign {
  id: string;
  subject: string;
  content: string;
  target_audience: CampaignTargetAudience;
  status: string;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
}

const SUBSCRIPTION_TIERS = ["trial", "starter", "growth", "professional", "enterprise"];
const INDUSTRIES = ["hvac", "plumbing", "electrical", "mechanical", "general"];

export default function AdminCommunications() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "tier" | "industry">("all");
  const [audienceValue, setAudienceValue] = useState("");

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      // Map the data to ensure proper typing
      const mappedCampaigns: Campaign[] = (data || []).map((item) => ({
        id: item.id,
        subject: item.subject,
        content: item.content,
        target_audience: item.target_audience as unknown as CampaignTargetAudience,
        status: item.status,
        sent_at: item.sent_at,
        recipient_count: item.recipient_count ?? 0,
        created_at: item.created_at,
      }));
      setCampaigns(mappedCampaigns);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      toast.error("Failed to load campaign history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSendCampaign = async () => {
    if (!subject.trim() || !content.trim()) {
      toast.error("Please enter a subject and message content");
      return;
    }

    if (audienceType !== "all" && !audienceValue) {
      toast.error("Please select a target audience");
      return;
    }

    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: {
          subject,
          content,
          targetAudience: {
            type: audienceType,
            value: audienceType !== "all" ? audienceValue : undefined,
          },
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`Campaign sent to ${data.successCount} recipients!`);
      
      // Reset form
      setSubject("");
      setContent("");
      setAudienceType("all");
      setAudienceValue("");

      // Refresh campaigns
      fetchCampaigns();
    } catch (err) {
      console.error("Failed to send campaign:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
      case "sending":
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Sending</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAudienceLabel = (audience: Campaign["target_audience"]) => {
    if (audience.type === "all") return "All Tenants";
    if (audience.type === "tier") return `Tier: ${audience.value}`;
    if (audience.type === "industry") return `Industry: ${audience.value}`;
    return "Unknown";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Communication Hub</h1>
        <p className="text-muted-foreground">Send announcements and email campaigns to tenants</p>
      </div>

      {/* Compose Campaign */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Campaign
          </CardTitle>
          <CardDescription>Create and send an email campaign to your tenants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                placeholder="Enter email subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <div className="flex gap-2">
                <Select value={audienceType} onValueChange={(v: "all" | "tier" | "industry") => {
                  setAudienceType(v);
                  setAudienceValue("");
                }}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenants</SelectItem>
                    <SelectItem value="tier">By Tier</SelectItem>
                    <SelectItem value="industry">By Industry</SelectItem>
                  </SelectContent>
                </Select>
                {audienceType === "tier" && (
                  <Select value={audienceValue} onValueChange={setAudienceValue}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select tier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier} className="capitalize">
                          {tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {audienceType === "industry" && (
                  <Select value={audienceValue} onValueChange={setAudienceValue}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select industry..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry} value={industry} className="capitalize">
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Message Content</Label>
            <Textarea
              id="content"
              placeholder="Write your message here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              Plain text only. Line breaks will be preserved.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSendCampaign} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Campaign
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaign History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Campaign History
          </CardTitle>
          <CardDescription>Previously sent email campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {campaign.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {getAudienceLabel(campaign.target_audience)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {campaign.recipient_count}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(campaign.sent_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No campaigns sent yet. Compose your first campaign above!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
