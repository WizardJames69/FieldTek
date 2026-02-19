import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Circle,
  Play,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export function CalendarLegend() {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-6">
        {/* Job Types */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Types</h4>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-xs">Service</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-xs">Install</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-purple-500" />
              <span className="text-xs">Warranty</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-500" />
              <span className="text-xs">Maintenance</span>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</h4>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <Circle className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Play className="h-3 w-3 text-blue-500 fill-blue-500" />
              <span className="text-xs">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-xs">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-destructive" />
              <span className="text-xs">Cancelled</span>
            </div>
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-destructive/20 text-destructive text-xs">
              Urgent
            </Badge>
            <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-400 text-xs">
              High
            </Badge>
            <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
              Normal
            </Badge>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
              Low
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}
