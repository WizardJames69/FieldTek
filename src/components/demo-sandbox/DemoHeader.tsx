import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, Menu, Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { toast } from '@/hooks/use-toast';
import { useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';

interface DemoHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onMenuToggle?: () => void;
}

function usePageTitle(): { title: string; subtitle?: string } {
  const location = useLocation();
  const { industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);

  const path = location.pathname;
  if (path.includes('/demo/schedule')) return { title: t('schedule') };
  if (path.includes('/demo/jobs')) return { title: t('jobs'), subtitle: `Manage your ${t('jobs').toLowerCase()}` };
  if (path.includes('/demo/clients')) return { title: t('clients') };
  if (path.includes('/demo/equipment')) return { title: t('equipment') };
  if (path.includes('/demo/invoices')) return { title: 'Invoices' };
  if (path.includes('/demo/requests')) return { title: t('serviceRequests') };
  if (path.includes('/demo/assistant')) return { title: 'AI Assistant' };
  return { title: 'Dashboard' };
}

function useDemoNotifications() {
  const { getDemoClients, getDemoJobs, industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const clients = getDemoClients();
  const jobs = getDemoJobs();

  const clientName = clients[0]?.name || 'Customer';
  const jobTitle = jobs.find(j => j.status === 'completed')?.title || `${t('job')} completed`;

  return [
    { id: '1', title: `New ${t('serviceRequest')}`, message: `${clientName} submitted a repair request`, time: '5m ago', unread: true },
    { id: '2', title: `${t('job')} Completed`, message: `${jobTitle}`, time: '15m ago', unread: true },
    { id: '3', title: 'Payment Received', message: `$450 payment received`, time: '1h ago', unread: false },
  ];
}

function useDemoSearchResults() {
  const { getDemoClients, getDemoJobs, getDemoEquipment, industry } = useDemoSandbox();
  const clients = getDemoClients();
  const jobs = getDemoJobs();
  const equipment = getDemoEquipment();

  return [
    ...jobs.slice(0, 2).map(j => ({ type: 'job', name: j.title, path: '/demo/jobs' })),
    ...clients.slice(0, 2).map(c => ({ type: 'client', name: c.name, path: '/demo/clients' })),
    ...equipment.slice(0, 2).map(e => ({ type: 'equipment', name: `${e.brand} ${e.model}`, path: '/demo/equipment' })),
  ];
}

export function DemoHeader({ title: titleOverride, subtitle: subtitleOverride, actions, onMenuToggle }: DemoHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const { industry } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  const { title: routeTitle, subtitle: routeSubtitle } = usePageTitle();
  const notifications = useDemoNotifications();
  const searchResults = useDemoSearchResults();

  const title = titleOverride || routeTitle;
  const subtitle = subtitleOverride || routeSubtitle;

  const handleSearchSelect = () => {
    setShowSearch(false);
    toast({
      title: "Demo Mode",
      description: "In the full app, this would navigate to the selected item. Sign up to try it!",
    });
  };

  const handleQuickAction = (label: string) => {
    toast({
      title: "Demo Mode",
      description: `In the full app, you would create a new ${label.toLowerCase()} here. Sign up to try it!`,
    });
  };

  return (
    <header 
      className="h-14 sm:h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10"
      data-demo-header
    >
      <div className="h-full px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden flex-shrink-0 h-9 w-9"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="font-display font-semibold text-base sm:text-lg md:text-xl text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Button
            variant="outline"
            className="hidden sm:flex w-9 h-9 sm:w-auto sm:h-9 p-0 sm:px-3 justify-center sm:justify-start text-muted-foreground gap-2"
            onClick={() => setShowSearch(true)}
            data-tour="global-search"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="pointer-events-none ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative h-9 w-9"
                data-tour="notification-bell"
              >
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  2
                </Badge>
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <Badge variant="secondary" className="text-xs">2 new</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem 
                  key={notification.id} 
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  onClick={() => toast({
                    title: "Demo Mode",
                    description: "In the full app, this would open the notification details. Sign up to try it!",
                  })}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium text-sm">{notification.title}</span>
                    {notification.unread && (
                      <span className="h-2 w-2 rounded-full bg-primary ml-auto" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{notification.message}</span>
                  <span className="text-xs text-muted-foreground">{notification.time}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-center justify-center text-sm text-primary">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="hidden sm:inline-flex gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleQuickAction(t('job'))}>New {t('job')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleQuickAction(t('client'))}>New {t('client')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleQuickAction('Invoice')}>New Invoice</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleQuickAction('Document')}>Upload Document</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {actions}
        </div>
      </div>

      <Dialog open={showSearch} onOpenChange={setShowSearch}>
        <DialogContent className="sm:max-w-lg p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <Command className="rounded-lg border-0">
            <CommandInput placeholder={`Search ${t('jobs').toLowerCase()}, ${t('clients').toLowerCase()}, ${t('equipment').toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading={t('jobs')}>
                {searchResults.filter(r => r.type === 'job').map((result) => (
                  <CommandItem key={result.name} onSelect={handleSearchSelect}>
                    <span>{result.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading={t('clients')}>
                {searchResults.filter(r => r.type === 'client').map((result) => (
                  <CommandItem key={result.name} onSelect={handleSearchSelect}>
                    <span>{result.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading={t('equipment')}>
                {searchResults.filter(r => r.type === 'equipment').map((result) => (
                  <CommandItem key={result.name} onSelect={handleSearchSelect}>
                    <span>{result.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </header>
  );
}
