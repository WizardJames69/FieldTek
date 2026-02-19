import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RecurringJobBadgeProps {
  className?: string;
}

export function RecurringJobBadge({ className }: RecurringJobBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`text-xs gap-1 border-primary/30 text-primary ${className}`}
          >
            <RefreshCw className="h-3 w-3" />
            Recurring
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>This job was auto-generated from a recurring template</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
