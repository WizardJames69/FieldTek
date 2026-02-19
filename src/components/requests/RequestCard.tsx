import { formatDistanceToNow } from 'date-fns';
import { Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ServiceRequest {
  id: string;
  title: string;
  description: string | null;
  request_type: string | null;
  status: string;
  priority: string;
  created_at: string;
  ai_analysis: any;
}

interface RequestCardProps {
  request: ServiceRequest;
  onView: (request: ServiceRequest) => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  new: { label: 'New', variant: 'destructive', icon: AlertTriangle },
  reviewed: { label: 'Reviewed', variant: 'secondary', icon: Clock },
  approved: { label: 'Approved', variant: 'default', icon: CheckCircle },
  converted: { label: 'Converted', variant: 'outline', icon: ArrowRight },
  rejected: { label: 'Rejected', variant: 'outline', icon: null },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function RequestCard({ request, onView }: RequestCardProps) {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.new;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(request)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={statusConfig.variant} className="text-xs">
                {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
                {statusConfig.label}
              </Badge>
              {request.request_type && (
                <Badge variant="outline" className="text-xs">
                  {request.request_type}
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-sm truncate">{request.title}</h3>
            {request.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {request.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[request.priority] || PRIORITY_COLORS.medium}`}>
                {request.priority}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0">
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
