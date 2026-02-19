import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBranding, useUserRole } from '@/contexts/TenantContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { OfflineIndicator } from '@/components/offline/OfflineIndicator';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onMenuToggle?: () => void;
}

export function Header({ title, subtitle, actions, onMenuToggle }: HeaderProps) {
  const branding = useBranding();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <header 
        className="page-header-glass h-14 md:h-16 border-b border-border/30 bg-background/60 backdrop-blur-xl sticky top-0 z-10 relative overflow-hidden"
        role="banner"
      >
        {/* Subtle gradient accent line at bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{ 
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.3) 50%, transparent 100%)' 
          }}
          aria-hidden="true"
        />
        
        <div className="h-full px-4 md:px-6 flex items-center justify-between gap-3 md:gap-4 relative z-10">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 touch-native"
            onClick={onMenuToggle}
            aria-label="Open navigation menu"
            aria-expanded="false"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Title Section */}
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-lg md:text-xl text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>
            )}
          </div>

          {/* Actions */}
          <nav className="flex items-center gap-2 md:gap-3" aria-label="Header actions">
            {/* Search Trigger - Icon only on mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden touch-native"
              onClick={() => setSearchOpen(true)}
              aria-label="Open search"
              aria-keyshortcuts="Control+K Meta+K"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Button>
            
            {/* Search Trigger - Full on desktop with glass styling */}
            <Button
              variant="outline"
              className="hidden md:flex w-64 justify-start text-muted-foreground gap-2 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/80 hover:border-primary/30 transition-all duration-200"
              onClick={() => setSearchOpen(true)}
              aria-label="Search jobs, clients, invoices, equipment. Keyboard shortcut: Command K"
              aria-keyshortcuts="Control+K Meta+K"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Search...</span>
              <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground" aria-hidden="true">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            {/* Quick Actions */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-2 h-9 btn-shimmer touch-native" aria-label="Quick actions menu">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">New</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 glass-surface">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="touch-native" onClick={() => navigate('/jobs?action=new')}>New Job</DropdownMenuItem>
                  <DropdownMenuItem className="touch-native" onClick={() => navigate('/clients?action=new')}>New Client</DropdownMenuItem>
                  <DropdownMenuItem className="touch-native" onClick={() => navigate('/invoices?action=new')}>New Invoice</DropdownMenuItem>
                  <DropdownMenuItem className="touch-native" onClick={() => navigate('/documents?action=new')}>Upload Document</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Offline Status Indicator */}
            <OfflineIndicator compact className="hidden sm:flex" />
            <OfflineIndicator compact showPendingCount={false} className="sm:hidden" />

            {/* Notifications */}
            <NotificationBell />

            {/* Custom Actions */}
            {actions}
          </nav>
        </div>
      </header>
    </>
  );
}
