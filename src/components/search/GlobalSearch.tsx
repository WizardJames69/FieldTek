import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Briefcase, Users, Receipt, Plus, Loader2 } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useUserRole } from '@/contexts/TenantContext';
import { useTerminology } from '@/hooks/useTerminology';
interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-500',
  in_progress: 'bg-yellow-500/10 text-yellow-500',
  completed: 'bg-green-500/10 text-green-500',
  cancelled: 'bg-muted text-muted-foreground',
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-500',
  paid: 'bg-green-500/10 text-green-500',
  overdue: 'bg-destructive/10 text-destructive',
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const { results, isLoading, totalResults } = useGlobalSearch(query);
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { t } = useTerminology();

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const handleSelect = (type: string, id: string) => {
    onOpenChange(false);
    // Navigate with search params to trigger detail sheet
    navigate(`/${type}s?open=${id}`);
  };

  const handleQuickAction = (route: string) => {
    onOpenChange(false);
    navigate(`/${route}?action=new`);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={`Search ${t('jobs').toLowerCase()}, ${t('clients').toLowerCase()}, invoices, ${t('equipment').toLowerCase()}...`}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && query.length >= 2 && totalResults === 0 && (
          <CommandEmpty>No results found for "{query}"</CommandEmpty>
        )}

        {!query && (
          <>
            {isAdmin && (
              <CommandGroup heading="Quick Actions">
                <CommandItem onSelect={() => handleQuickAction('jobs')}>
                  <Plus className="mr-2 h-4 w-4" />
                  New {t('job')}
                </CommandItem>
                <CommandItem onSelect={() => handleQuickAction('clients')}>
                  <Plus className="mr-2 h-4 w-4" />
                  New {t('client')}
                </CommandItem>
                <CommandItem onSelect={() => handleQuickAction('invoices')}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Invoice
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => { onOpenChange(false); navigate('/dashboard'); }}>
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => { onOpenChange(false); navigate('/jobs'); }}>
                {t('jobs')}
              </CommandItem>
              <CommandItem onSelect={() => { onOpenChange(false); navigate('/clients'); }}>
                {t('clients')}
              </CommandItem>
              <CommandItem onSelect={() => { onOpenChange(false); navigate('/invoices'); }}>
                Invoices
              </CommandItem>
              <CommandItem onSelect={() => { onOpenChange(false); navigate('/equipment'); }}>
                {t('equipment')}
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Jobs Results */}
        {results.jobs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('jobs')}>
              {results.jobs.map((job) => (
                <CommandItem
                  key={job.id}
                  onSelect={() => handleSelect('job', job.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.subtitle}</p>
                    </div>
                  </div>
                  {job.status && (
                    <Badge variant="secondary" className={statusColors[job.status] || ''}>
                      {job.status.replace('_', ' ')}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Clients Results */}
        {results.clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t('clients')}>
              {results.clients.map((client) => (
                <CommandItem
                  key={client.id}
                  onSelect={() => handleSelect('client', client.id)}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{client.title}</p>
                    <p className="text-xs text-muted-foreground">{client.subtitle}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Invoices Results */}
        {results.invoices.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Invoices">
              {results.invoices.map((invoice) => (
                <CommandItem
                  key={invoice.id}
                  onSelect={() => handleSelect('invoice', invoice.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invoice.title}</p>
                      <p className="text-xs text-muted-foreground">{invoice.subtitle}</p>
                    </div>
                  </div>
                  {invoice.status && (
                    <Badge variant="secondary" className={statusColors[invoice.status] || ''}>
                      {invoice.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
