import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Mail, Phone, Building2, Calendar, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface DemoRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  industry: string | null;
  team_size: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  message: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  scheduled_at: string | null;
}

const statusOptions = [
  { value: "pending", label: "Pending", color: "bg-amber-100 text-amber-700" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-700" },
  { value: "scheduled", label: "Scheduled", color: "bg-purple-100 text-purple-700" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

export default function AdminDemoRequests() {
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<DemoRequest | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from("demo_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching demo requests:", error);
      toast.error("Failed to load demo requests");
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (request.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    const { error } = await supabase
      .from("demo_requests")
      .update({ status: newStatus })
      .eq("id", requestId);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
      setRequests(requests.map(r => 
        r.id === requestId ? { ...r, status: newStatus } : r
      ));
      if (selectedRequest?.id === requestId) {
        setSelectedRequest({ ...selectedRequest, status: newStatus });
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedRequest) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("demo_requests")
      .update({ notes: editNotes })
      .eq("id", selectedRequest.id);

    if (error) {
      toast.error("Failed to save notes");
    } else {
      toast.success("Notes saved");
      setRequests(requests.map(r => 
        r.id === selectedRequest.id ? { ...r, notes: editNotes } : r
      ));
      setSelectedRequest({ ...selectedRequest, notes: editNotes });
    }
    setSaving(false);
  };

  const getStatusBadge = (status: string | null) => {
    const option = statusOptions.find(o => o.value === status) || statusOptions[0];
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${option.color}`}>
        {option.label}
      </span>
    );
  };

  const openDetail = (request: DemoRequest) => {
    setSelectedRequest(request);
    setEditNotes(request.notes || "");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Demo Requests</h1>
        <p className="text-muted-foreground mt-1">
          Manage and respond to demo requests from potential customers
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              {searchQuery || statusFilter !== "all" 
                ? "No demo requests match your filters" 
                : "No demo requests yet"}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Preferred Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id} className="cursor-pointer" onClick={() => openDetail(request)}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.name}</p>
                          <p className="text-sm text-muted-foreground">{request.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{request.company_name || "-"}</p>
                          {request.industry && (
                            <p className="text-sm text-muted-foreground">{request.industry}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.preferred_date ? (
                          <div>
                            <p>{format(new Date(request.preferred_date), "MMM d, yyyy")}</p>
                            {request.preferred_time && (
                              <p className="text-sm text-muted-foreground">{request.preferred_time}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={request.status || "pending"}
                          onValueChange={(value) => handleStatusChange(request.id, value)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {request.created_at 
                          ? format(new Date(request.created_at), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedRequest && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedRequest.name}</SheetTitle>
                <SheetDescription>
                  Submitted {selectedRequest.created_at 
                    ? format(new Date(selectedRequest.created_at), "MMMM d, yyyy 'at' h:mm a")
                    : "unknown date"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Contact Information
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${selectedRequest.email}`} className="text-primary hover:underline">
                        {selectedRequest.email}
                      </a>
                    </div>
                    {selectedRequest.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedRequest.phone}`} className="text-primary hover:underline">
                          {selectedRequest.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Company Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Company Details
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedRequest.company_name || "Not provided"}</span>
                    </div>
                    {selectedRequest.industry && (
                      <div className="flex items-center gap-3">
                        <span className="w-4" />
                        <Badge variant="secondary">{selectedRequest.industry}</Badge>
                      </div>
                    )}
                    {selectedRequest.team_size && (
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedRequest.team_size}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scheduling */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Scheduling Preference
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {selectedRequest.preferred_date 
                          ? format(new Date(selectedRequest.preferred_date), "EEEE, MMMM d, yyyy")
                          : "No preference"}
                      </span>
                    </div>
                    {selectedRequest.preferred_time && (
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedRequest.preferred_time}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Message */}
                {selectedRequest.message && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Message
                    </h3>
                    <p className="text-sm bg-muted p-4 rounded-lg">{selectedRequest.message}</p>
                  </div>
                )}

                {/* Status */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Status
                  </h3>
                  <Select
                    value={selectedRequest.status || "pending"}
                    onValueChange={(value) => handleStatusChange(selectedRequest.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Admin Notes */}
                <div className="space-y-3">
                  <Label>Admin Notes</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add internal notes about this request..."
                    rows={4}
                  />
                  <Button onClick={handleSaveNotes} disabled={saving}>
                    {saving ? "Saving..." : "Save Notes"}
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="pt-4 border-t space-y-2">
                  <Button className="w-full" asChild>
                    <a href={`mailto:${selectedRequest.email}?subject=FieldTek Demo Follow-up`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </a>
                  </Button>
                  {selectedRequest.phone && (
                    <Button variant="outline" className="w-full" asChild>
                      <a href={`tel:${selectedRequest.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
