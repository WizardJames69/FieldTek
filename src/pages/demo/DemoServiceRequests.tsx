import { useState } from 'react';
import { format } from 'date-fns';
import {
  Inbox,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Brain,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';
import { toast } from '@/hooks/use-toast';

export default function DemoServiceRequests() {
  const { getDemoServiceRequests, getDemoClients, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const requests = getDemoServiceRequests();
  const clients = getDemoClients();

  const filteredRequests = requests.filter(request => {
    const client = clients.find(c => c.id === request.client_id);
    const matchesSearch = 
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedRequestData = requests.find(r => r.id === selectedRequest);
  const selectedRequestClient = selectedRequestData 
    ? clients.find(c => c.id === selectedRequestData.client_id) 
    : null;

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'new': return 'default';
      case 'reviewed': return 'secondary';
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'converted': return 'default';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Clock className="h-4 w-4" />;
      case 'reviewed': return <CheckCircle className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'converted': return <ArrowRight className="h-4 w-4" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'secondary';
      default: return 'outline';
    }
  };

  const handleConvertToJob = () => {
    toast({
      title: "Demo Mode",
      description: `In the full app, this would create a new ${t('job').toLowerCase()} from this request with all details pre-filled. Sign up to try it!`,
    });
  };

  const handleApprove = () => {
    toast({
      title: "Demo Mode",
      description: "In the full app, this would approve the request and notify the customer. Sign up to try it!",
    });
  };

  // Stats
  const newCount = requests.filter(r => r.status === 'new').length;
  const reviewedCount = requests.filter(r => r.status === 'reviewed').length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Service Requests</h1>
          <p className="text-muted-foreground">Review and process customer requests</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          AI-Powered Analysis
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New Requests</p>
                <p className="text-2xl font-bold text-blue-600">{newCount}</p>
              </div>
              <Inbox className="h-8 w-8 text-blue-600/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reviewed</p>
                <p className="text-2xl font-bold text-green-600">{reviewedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">AI Analyzed</p>
                <p className="text-2xl font-bold text-purple-600">{requests.filter(r => r.ai_analysis).length}</p>
              </div>
              <Brain className="h-8 w-8 text-purple-600/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <div className="space-y-2 sm:space-y-3" data-tour="service-requests-list">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No service requests found
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map(request => {
            const client = clients.find(c => c.id === request.client_id);
            const aiAnalysis = request.ai_analysis as { summary?: string; estimated_priority?: string } | null;
            
            return (
              <Card
                key={request.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedRequest(request.id)}
              >
                <CardContent className="py-3 sm:py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-shrink-0 mt-0.5">{getStatusIcon(request.status)}</div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm sm:text-base break-words">{request.title}</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant={getStatusColor(request.status)} className="capitalize text-[10px] sm:text-xs">
                              {request.status}
                            </Badge>
                            <Badge variant={getPriorityColor(request.priority)} className="capitalize text-[10px] sm:text-xs">
                              {request.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                        {request.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span className="truncate">{client?.name}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{format(new Date(request.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    
                    {aiAnalysis && (
                      <div className="hidden md:block w-64 flex-shrink-0 bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 mb-1">
                          <Brain className="h-3 w-3" />
                          AI Analysis
                        </div>
                        <p className="text-xs text-muted-foreground">{aiAnalysis.summary}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Request Detail Sheet */}
      <Sheet open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedRequestData && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedRequestData.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex gap-2">
                  <Badge variant={getStatusColor(selectedRequestData.status)} className="capitalize">
                    {selectedRequestData.status}
                  </Badge>
                  <Badge variant={getPriorityColor(selectedRequestData.priority)} className="capitalize">
                    {selectedRequestData.priority}
                  </Badge>
                  <Badge variant="outline">{selectedRequestData.request_type}</Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">{t('client')}</h4>
                    <p className="font-medium">{selectedRequestClient?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedRequestClient?.phone}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm">{selectedRequestData.description}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Submitted</h4>
                    <p>{format(new Date(selectedRequestData.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>

                {/* AI Analysis Section */}
                {selectedRequestData.ai_analysis && (
                  <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-300">
                        <Brain className="h-4 w-4" />
                        AI Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      {(() => {
                        const analysis = selectedRequestData.ai_analysis as {
                          summary?: string;
                          suggested_job_type?: string;
                          estimated_priority?: string;
                          recommended_actions?: string[];
                        };
                        return (
                          <>
                            <p>{analysis.summary}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Suggested Type:</span>
                                <Badge variant="outline" className="ml-1">{analysis.suggested_job_type}</Badge>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Priority:</span>
                                <Badge variant="outline" className="ml-1 capitalize">{analysis.estimated_priority}</Badge>
                              </div>
                            </div>
                            {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
                              <div>
                                <p className="text-muted-foreground mb-1">Recommended Actions:</p>
                                <ul className="list-disc list-inside space-y-1">
                                  {analysis.recommended_actions.map((action, i) => (
                                    <li key={i} className="text-xs">{action}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={handleConvertToJob}>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Convert to {t('job')}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleApprove}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
