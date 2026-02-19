import { Button } from '@/components/ui/button';
import { Play, CheckCircle2, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  status: string | null;
  address: string | null;
  client?: {
    phone: string | null;
    address: string | null;
  } | null;
}

interface JobQuickActionsProps {
  job: Job;
  onAction: (action: 'start' | 'complete') => void;
}

export function JobQuickActions({ job, onAction }: JobQuickActionsProps) {
  const canStart = job.status === 'scheduled' || job.status === 'pending';
  const canComplete = job.status === 'in_progress';
  const isCompleted = job.status === 'completed';
  const isCancelled = job.status === 'cancelled';

  const address = job.address || job.client?.address;

  return (
    <div className="space-y-3">
      {/* Status Actions */}
      <div className="flex gap-2">
        {canStart && (
          <Button
            className="flex-1 gap-2"
            onClick={() => onAction('start')}
          >
            <Play className="h-4 w-4" />
            Start Job
          </Button>
        )}
        {canComplete && (
          <Button
            className="flex-1 gap-2"
            variant="default"
            onClick={() => onAction('complete')}
          >
            <CheckCircle2 className="h-4 w-4" />
            Complete Job
          </Button>
        )}
        {isCompleted && (
          <div className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Job Completed</span>
          </div>
        )}
        {isCancelled && (
          <div className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-destructive/10 text-destructive rounded-md">
            <span className="font-medium">Job Cancelled</span>
          </div>
        )}
      </div>

      {/* Navigation Actions */}
      <div className="flex gap-2">
        {address && (
          <Button
            variant="outline"
            className="flex-1 gap-2"
            asChild
          >
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin className="h-4 w-4" />
              Navigate
            </a>
          </Button>
        )}
        {job.client?.phone && (
          <Button
            variant="outline"
            className="flex-1 gap-2"
            asChild
          >
            <a href={`tel:${job.client.phone}`}>
              <Phone className="h-4 w-4" />
              Call Client
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
