import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { JobStatus, JobPriority } from '@/types/database';

interface JobFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: JobStatus | 'all';
  onStatusChange: (status: JobStatus | 'all') => void;
  priorityFilter: JobPriority | 'all';
  onPriorityChange: (priority: JobPriority | 'all') => void;
  dateFilter: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  onClearFilters: () => void;
}

const statusOptions: { value: JobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const priorityOptions: { value: JobPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function JobFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  dateFilter,
  onDateChange,
  onClearFilters,
}: JobFiltersProps) {
  const [dateCalendarOpen, setDateCalendarOpen] = useState(false);
  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || dateFilter !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs by title, client, or address..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="jobs-search-input"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(val) => onStatusChange(val as JobStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[160px]" data-testid="jobs-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={(val) => onPriorityChange(val as JobPriority | 'all')}>
          <SelectTrigger className="w-full sm:w-[160px]" data-testid="jobs-priority-filter">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Filter */}
        <Popover open={dateCalendarOpen} onOpenChange={setDateCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full sm:w-[160px] justify-start text-left font-normal',
                !dateFilter && 'text-muted-foreground'
              )}
            >
              {dateFilter ? format(dateFilter, 'MMM d, yyyy') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={(date) => {
                onDateChange(date);
                setDateCalendarOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusFilter.replace('_', ' ')}
              <button onClick={() => onStatusChange('all')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {priorityFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Priority: {priorityFilter}
              <button onClick={() => onPriorityChange('all')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {dateFilter && (
            <Badge variant="secondary" className="gap-1">
              Date: {format(dateFilter, 'MMM d')}
              <button onClick={() => onDateChange(undefined)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-6 px-2 text-xs">
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
