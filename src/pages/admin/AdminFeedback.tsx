import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Bug,
  Lightbulb,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type FeedbackType = 'bug' | 'feature' | 'feedback' | 'question';
type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';
type Urgency = 'low' | 'medium' | 'high';

interface FeedbackItem {
  id: string;
  tenant_id: string;
  user_id: string;
  feedback_type: FeedbackType;
  title: string;
  description: string;
  urgency: Urgency;
  page_context: string | null;
  screenshot_url: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const feedbackTypeConfig = {
  bug: { icon: Bug, label: 'Bug', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  feedback: { icon: MessageSquare, label: 'General', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  question: { icon: HelpCircle, label: 'Question', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

const statusConfig: Record<FeedbackStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  reviewed: { label: 'Reviewed', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700' },
};

const urgencyConfig: Record<Urgency, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'High', color: 'bg-red-100 text-red-700' },
};

export default function AdminFeedback() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);

  const { data: feedback, isLoading, refetch } = useQuery({
    queryKey: ['admin-feedback', filterType, filterStatus, filterUrgency],
    queryFn: async () => {
      let query = supabase
        .from('beta_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('feedback_type', filterType);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (filterUrgency !== 'all') {
        query = query.eq('urgency', filterUrgency);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FeedbackItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FeedbackItem> }) => {
      const { error } = await supabase
        .from('beta_feedback')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      toast({ title: 'Feedback updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update', variant: 'destructive' });
    },
  });

  const handleStatusChange = (id: string, status: FeedbackStatus) => {
    updateMutation.mutate({ id, updates: { status } });
  };

  const handleSaveNotes = () => {
    if (!editingNotes) return;
    updateMutation.mutate({
      id: editingNotes.id,
      updates: { admin_notes: editingNotes.notes },
    });
    setEditingNotes(null);
  };

  const handleExportCSV = () => {
    if (!feedback?.length) return;
    
    const headers = ['Type', 'Title', 'Description', 'Status', 'Urgency', 'Page', 'Date', 'Admin Notes'];
    const rows = feedback.map(f => [
      f.feedback_type,
      f.title,
      f.description.replace(/"/g, '""'),
      f.status,
      f.urgency,
      f.page_context || '',
      format(new Date(f.created_at), 'yyyy-MM-dd HH:mm'),
      f.admin_notes?.replace(/"/g, '""') || '',
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(',')),
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beta-feedback-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: feedback?.length || 0,
    new: feedback?.filter(f => f.status === 'new').length || 0,
    bugs: feedback?.filter(f => f.feedback_type === 'bug').length || 0,
    high: feedback?.filter(f => f.urgency === 'high' && f.status !== 'resolved' && f.status !== 'closed').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Beta Feedback</h1>
          <p className="text-muted-foreground">Review and manage user feedback submissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!feedback?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bugs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.bugs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.high}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="feedback">General</SelectItem>
                <SelectItem value="question">Question</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterUrgency} onValueChange={setFilterUrgency}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !feedback?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              No feedback found matching your filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedback.map((item) => {
                  const typeConfig = feedbackTypeConfig[item.feedback_type];
                  const TypeIcon = typeConfig.icon;
                  const isExpanded = expandedId === item.id;

                  return (
                    <Collapsible key={item.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : item.id)}>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn('gap-1', typeConfig.color)}>
                            <TypeIcon className="h-3 w-3" />
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {item.title}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.status}
                            onValueChange={(value) => handleStatusChange(item.id, value as FeedbackStatus)}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <Badge variant="secondary" className={statusConfig[item.status].color}>
                                {statusConfig[item.status].label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([value, config]) => (
                                <SelectItem key={value} value={value}>
                                  {config.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={urgencyConfig[item.urgency].color}>
                            {urgencyConfig[item.urgency].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(item.created_at), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell>
                          {item.page_context && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                              <ExternalLink className="h-3 w-3" />
                              {item.page_context}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-4">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2">Description</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {item.description}
                                </p>
                              </div>
                              
                              {item.screenshot_url && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Screenshot</h4>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      const { data } = await supabase.storage
                                        .from('feedback-screenshots')
                                        .createSignedUrl(item.screenshot_url!, 3600);
                                      if (data?.signedUrl) {
                                        window.open(data.signedUrl, '_blank');
                                      }
                                    }}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Screenshot
                                  </Button>
                                </div>
                              )}

                              <div>
                                <h4 className="text-sm font-medium mb-2">Admin Notes</h4>
                                {editingNotes?.id === item.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editingNotes.notes}
                                      onChange={(e) => setEditingNotes({ ...editingNotes, notes: e.target.value })}
                                      placeholder="Add internal notes..."
                                      className="min-h-[80px]"
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={handleSaveNotes}>
                                        Save
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingNotes(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="text-sm text-muted-foreground p-3 bg-background rounded border cursor-pointer hover:border-primary/50"
                                    onClick={() => setEditingNotes({ id: item.id, notes: item.admin_notes || '' })}
                                  >
                                    {item.admin_notes || 'Click to add notes...'}
                                  </div>
                                )}
                              </div>

                              <div className="text-xs text-muted-foreground">
                                User ID: {item.user_id} • Tenant ID: {item.tenant_id}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}