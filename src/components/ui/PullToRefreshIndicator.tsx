import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  isRefreshing: boolean;
  pullProgress: number;
  className?: string;
}

export function PullToRefreshIndicator({
  isRefreshing,
  pullProgress,
  className,
}: PullToRefreshIndicatorProps) {
  const isVisible = pullProgress > 0 || isRefreshing;
  
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-center py-4 md:hidden',
        className
      )}
      style={{
        opacity: Math.min(pullProgress * 1.5, 1),
        transform: `scale(${0.5 + pullProgress * 0.5})`,
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {isRefreshing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Refreshing...</span>
          </>
        ) : pullProgress >= 1 ? (
          <>
            <ArrowDown className="h-5 w-5 text-primary animate-bounce" />
            <span className="text-sm font-medium">Release to refresh</span>
          </>
        ) : (
          <>
            <ArrowDown 
              className="h-5 w-5 transition-transform" 
              style={{ transform: `rotate(${pullProgress * 180}deg)` }}
            />
            <span className="text-sm font-medium">Pull to refresh</span>
          </>
        )}
      </div>
    </div>
  );
}
