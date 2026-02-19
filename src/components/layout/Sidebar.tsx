import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Clipboard, 
  Users, 
  FileText, 
  Settings, 
  MessageSquare,
  Wrench,
  ClipboardList,
  Receipt,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BarChart3,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useBranding, useUserRole } from '@/contexts/TenantContext';
import { useBrandingAssets } from '@/hooks/useBrandingAssets';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFeatureAccess, FeatureKey } from '@/hooks/useFeatureAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useTerminology } from '@/hooks/useTerminology';

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  roles: string[];
  feature?: FeatureKey;
  terminologyKey?: string;
};

// Base nav items with terminology keys for dynamic labels
const baseMainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', roles: ['owner', 'admin', 'dispatcher'] },
  { icon: CalendarDays, label: 'Schedule', href: '/schedule', roles: ['owner', 'admin', 'dispatcher'], terminologyKey: 'schedule' },
  { icon: Clipboard, label: 'Jobs', href: '/jobs', roles: ['owner', 'admin', 'dispatcher'], terminologyKey: 'jobs' },
  { icon: ClipboardList, label: 'My Jobs', href: '/my-jobs', roles: ['technician'], terminologyKey: 'myJobs' },
  { icon: CalendarDays, label: 'My Calendar', href: '/my-calendar', roles: ['technician'], terminologyKey: 'myCalendar' },
  { icon: Users, label: 'Clients', href: '/clients', roles: ['owner', 'admin', 'dispatcher'], terminologyKey: 'clients' },
  { icon: Wrench, label: 'Equipment', href: '/equipment', roles: ['owner', 'admin', 'dispatcher', 'technician'], feature: 'equipment_tracking', terminologyKey: 'equipment' },
  { icon: Receipt, label: 'Invoices', href: '/invoices', roles: ['owner', 'admin'], feature: 'invoicing_full' },
  { icon: ClipboardList, label: 'Requests', href: '/requests', roles: ['owner', 'admin', 'dispatcher'], terminologyKey: 'serviceRequests' },
  { icon: FileText, label: 'Documents', href: '/documents', roles: ['owner', 'admin', 'dispatcher', 'technician'] },
  { icon: MessageSquare, label: 'AI Assistant', href: '/assistant', roles: ['owner', 'admin', 'dispatcher', 'technician'], feature: 'ai_assistant' },
];

const baseBottomNavItems: NavItem[] = [
  { icon: BarChart3, label: 'Reports', href: '/reports', roles: ['owner', 'admin'], feature: 'advanced_analytics' },
  { icon: Users, label: 'Team', href: '/team', roles: ['owner', 'admin'] },
  { icon: Settings, label: 'Settings', href: '/settings', roles: ['owner', 'admin'] },
];

// Minimal safe navigation for when role is not yet loaded
const fallbackNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', roles: ['owner', 'admin', 'dispatcher', 'technician'] },
  { icon: Settings, label: 'Settings', href: '/settings', roles: ['owner', 'admin', 'dispatcher', 'technician'] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { tenant, loading: tenantLoading, refreshTenant } = useTenant();
  const { role } = useUserRole();
  const branding = useBranding();
  const { logoUrl } = useBrandingAssets();
  const { toast } = useToast();
  const { t } = useTerminology();

  // Build nav items with dynamic terminology
  const mainNavItems = useMemo(() => 
    baseMainNavItems.map(item => ({
      ...item,
      label: item.terminologyKey ? t(item.terminologyKey as any) : item.label
    })), [t]
  );

  const bottomNavItems = useMemo(() => 
    baseBottomNavItems.map(item => ({
      ...item,
      label: item.terminologyKey ? t(item.terminologyKey as any) : item.label
    })), [t]
  );

  // If loading takes too long, show content anyway
  useEffect(() => {
    if (!tenantLoading) {
      setLoadingTimeout(false);
      return;
    }
    
    const timer = setTimeout(() => {
      if (tenantLoading) {
        setLoadingTimeout(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [tenantLoading]);

  const filterByRole = (items: typeof baseMainNavItems) => {
    // If tenant is loaded but role is temporarily unavailable, show owner/admin items
    // This handles the brief moment where tenantUser is loading
    if (!role && tenant) {
      return items.filter(item => 
        item.roles.includes('owner') || item.roles.includes('admin')
      );
    }
    // If loading timed out, show owner/admin items as fallback
    if (!role && loadingTimeout) {
      return items.filter(item => 
        item.roles.includes('owner') || item.roles.includes('admin')
      );
    }
    // If user exists but no role and no tenant, show minimal fallback nav
    if (!role && user && !tenant) {
      return fallbackNavItems;
    }
    if (!role) return [];
    return items.filter(item => item.roles.includes(role));
  };

  const { hasAccess, getUpgradeTier } = useFeatureAccess();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
      toast({ 
        title: 'Sign out failed', 
        description: 'Please try again',
        variant: 'destructive' 
      });
    } finally {
      // Always reset state and redirect, regardless of error
      setIsSigningOut(false);
      // Use replace to prevent back button from returning to authenticated page
      window.location.replace('/');
    }
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    const isLocked = item.feature && !hasAccess(item.feature);
    const upgradeTier = item.feature ? getUpgradeTier(item.feature) : null;

    const linkContent = (
      <Link
        to={isLocked ? '/settings?tab=billing' : item.href}
        data-testid={`sidebar-nav-${item.href.replace(/^\//, '').replace(/\//g, '-')}`}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98]',
          isActive && !isLocked
            ? 'bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-primary/20'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
          isLocked && 'opacity-60',
          collapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && !isLocked && 'text-sidebar-primary')} />
        {!collapsed && (
          <span className="flex-1">{item.label}</span>
        )}
        {!collapsed && isLocked && (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
            {isLocked && upgradeTier && (
              <span className="block text-xs text-muted-foreground capitalize">
                Requires {upgradeTier}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  // Show loading skeleton while tenant data is loading (but not if timeout occurred)
  if (tenantLoading && !loadingTimeout) {
    return (
      <aside
        className={cn(
          'flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header skeleton */}
        <div className={cn('flex items-center h-16 px-4 border-b border-sidebar-border', collapsed && 'justify-center px-2')}>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            {!collapsed && <Skeleton className="h-4 w-24" />}
          </div>
        </div>

        {/* Nav items skeleton */}
        <nav className="flex-1 p-3 space-y-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className={cn('h-10 rounded-lg', collapsed ? 'w-10' : 'w-full')} />
          ))}
        </nav>

        {/* Bottom skeleton */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className={cn('h-10 rounded-lg', collapsed ? 'w-10' : 'w-full')} />
          ))}
          <div className={cn('flex items-center gap-3 px-3 py-2.5 mt-2', collapsed && 'justify-center px-2')}>
            <Skeleton className="h-8 w-8 rounded-full" />
            {!collapsed && (
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2 w-12" />
              </div>
            )}
          </div>
          <Skeleton className={cn('h-9 rounded-lg', collapsed ? 'w-10' : 'w-full')} />
        </div>
      </aside>
    );
  }

  // Get filtered nav items
  const filteredMainNav = filterByRole(mainNavItems);
  const filteredBottomNav = filterByRole(bottomNavItems);
  
  // Check if we're in a "tenant loading" state
  const showTenantLoading = user && !tenant && !tenantLoading;

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border/50 transition-all duration-300 sidebar-enhanced relative overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Enhanced floating orb background with dual orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div 
          className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full blur-[80px] floating-orb opacity-60"
          style={{ background: 'radial-gradient(circle, hsl(var(--sidebar-primary) / 0.12), transparent 70%)' }}
        />
        <div 
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[60px] floating-orb opacity-40"
          style={{ 
            background: 'radial-gradient(circle, hsl(var(--sidebar-primary) / 0.08), transparent 70%)',
            animationDelay: '10s'
          }}
        />
      </div>
      
      {/* Inner glow edge accent */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-[1px] pointer-events-none"
        style={{ 
          background: 'linear-gradient(180deg, transparent 0%, hsl(var(--sidebar-primary) / 0.15) 30%, hsl(var(--sidebar-primary) / 0.15) 70%, transparent 100%)' 
        }}
        aria-hidden="true"
      />
      {/* Header */}
      <div className={cn('flex items-center h-16 px-4 border-b border-sidebar-border', collapsed && 'justify-center px-2')}>
        <div className="flex items-center gap-2 min-w-0">
          {showTenantLoading ? (
            // Tenant loading state in header
            <>
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
              {!collapsed && (
                <span className="text-sm text-muted-foreground truncate">
                  Loading...
                </span>
              )}
            </>
          ) : logoUrl ? (
            <>
              <img 
                src={logoUrl} 
                alt={branding.companyName} 
                className="h-8 w-8 object-contain rounded-lg flex-shrink-0" 
              />
              {!collapsed && (
                <span className="font-display font-bold text-lg text-sidebar-foreground truncate">
                  {branding.companyName}
                </span>
              )}
            </>
          ) : (
            <>
              {collapsed ? (
                <span className="font-display font-bold text-lg">
                  <span className="text-sidebar-foreground">F</span>
                  <span className="text-primary">T</span>
                </span>
              ) : tenant?.name ? (
                <span className="font-display font-bold text-lg text-sidebar-foreground truncate max-w-[200px]" title={tenant.name}>
                  {tenant.name}
                </span>
              ) : (
                <Logo size="sm" asLink={false} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
        {showTenantLoading ? (
          // Show minimal fallback nav with retry when tenant is missing
          <div className="space-y-1">
            {fallbackNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
            {!collapsed && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Loading workspace...
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshTenant()}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            )}
          </div>
        ) : filteredMainNav.length > 0 ? (
          filteredMainNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))
        ) : (
          // Fallback if no items (edge case)
          fallbackNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-3 border-t border-sidebar-border/50 space-y-1 relative">
        {/* Top edge glow */}
        <div 
          className="absolute top-0 left-4 right-4 h-[1px]"
          style={{ 
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--sidebar-primary) / 0.2) 50%, transparent 100%)' 
          }}
          aria-hidden="true"
        />
        
        {(showTenantLoading ? [] : filteredBottomNav).map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {/* User Profile with role ring */}
        <div className={cn(
          'flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg transition-colors hover:bg-sidebar-accent/30',
          collapsed && 'justify-center px-2'
        )}>
          <div className="relative">
            <Avatar className="h-8 w-8 ring-2 ring-sidebar-primary/30 ring-offset-1 ring-offset-sidebar">
              <AvatarImage src="" />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-medium">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {/* Online status indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-sidebar" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{role || 'Loading...'}</p>
            </div>
          )}
        </div>

        {/* Sign Out with enhanced styling */}
        <Button
          variant="ghost"
          size="sm"
          data-testid="sidebar-signout-button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={cn(
            'w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 touch-native transition-all duration-200',
            collapsed ? 'justify-center px-2' : 'justify-start'
          )}
        >
          {isSigningOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {!collapsed && <span className="ml-2">{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>}
        </Button>
      </div>

      {/* Collapse Toggle with glow on hover */}
      <button
        onClick={() => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {} }}
        className="absolute -right-3 top-20 w-6 h-6 bg-sidebar border border-sidebar-border/50 rounded-full flex items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:border-sidebar-primary/30 hover:shadow-[0_0_8px_hsl(var(--sidebar-primary)/0.3)] transition-all duration-200"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}