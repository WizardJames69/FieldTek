import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useBrandingColors } from '@/hooks/useBrandingColors';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { BetaFeedbackFAB } from '@/components/feedback/BetaFeedbackFAB';
import { OfflineBanner } from '@/components/offline/OfflineBanner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useBranding, useUserRole } from '@/contexts/TenantContext';
import { useBrandingAssets } from '@/hooks/useBrandingAssets';
import { useFeatureAccess, FeatureKey } from '@/hooks/useFeatureAccess';
import { useJobRealtimeNotifications } from '@/hooks/useJobRealtimeNotifications';
import { useNotificationDeeplink } from '@/hooks/useNotificationDeeplink';
import { cn } from '@/lib/utils';
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
  LogOut,
  BarChart3,
  Lock,
  Loader2,
  BookOpen,
} from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

type NavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  roles: string[];
  feature?: FeatureKey;
};

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', roles: ['owner', 'admin', 'dispatcher'] },
  { icon: CalendarDays, label: 'Schedule', href: '/schedule', roles: ['owner', 'admin', 'dispatcher'] },
  { icon: Clipboard, label: 'Jobs', href: '/jobs', roles: ['owner', 'admin', 'dispatcher'] },
  { icon: ClipboardList, label: 'My Jobs', href: '/my-jobs', roles: ['technician'] },
  { icon: CalendarDays, label: 'My Calendar', href: '/my-calendar', roles: ['technician'] },
  { icon: Users, label: 'Clients', href: '/clients', roles: ['owner', 'admin', 'dispatcher'] },
  { icon: Wrench, label: 'Equipment', href: '/equipment', roles: ['owner', 'admin', 'dispatcher', 'technician'], feature: 'equipment_tracking' },
  { icon: Receipt, label: 'Invoices', href: '/invoices', roles: ['owner', 'admin'], feature: 'invoicing_full' },
  { icon: ClipboardList, label: 'Requests', href: '/requests', roles: ['owner', 'admin', 'dispatcher'] },
  { icon: FileText, label: 'Documents', href: '/documents', roles: ['owner', 'admin', 'dispatcher', 'technician'] },
  { icon: MessageSquare, label: 'AI Assistant', href: '/assistant', roles: ['owner', 'admin', 'dispatcher', 'technician'], feature: 'ai_assistant' },
];

const bottomNavItems: NavItem[] = [
  { icon: BookOpen, label: 'Tutorials', href: '/tutorials', roles: ['owner', 'admin', 'dispatcher', 'technician'] },
  { icon: BarChart3, label: 'Reports', href: '/reports', roles: ['owner', 'admin'], feature: 'advanced_analytics' },
  { icon: Users, label: 'Team', href: '/team', roles: ['owner', 'admin'] },
  { icon: Settings, label: 'Settings', href: '/settings', roles: ['owner', 'admin'] },
];

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { tenant } = useTenant();
  const branding = useBranding();
  const { role } = useUserRole();
  const { logoUrl } = useBrandingAssets();
  const { hasAccess, getUpgradeTier } = useFeatureAccess();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Apply tenant branding colors as CSS variables
  useBrandingColors();

  // Enable real-time push notifications for job status changes
  useJobRealtimeNotifications();

  // Handle push notification deeplinks (in-app navigation + launch URL params)
  useNotificationDeeplink();

  const filterByRole = (items: NavItem[]) => {
    if (!role && tenant) {
      return items.filter(item => 
        item.roles.includes('owner') || item.roles.includes('admin')
      );
    }
    if (!role) return [];
    return items.filter(item => item.roles.includes(role));
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsSigningOut(false);
      window.location.replace('/');
    }
  };

  const filteredMainNav = filterByRole(mainNavItems);
  const filteredBottomNav = filterByRole(bottomNavItems);

  const MobileNavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    const isLocked = item.feature && !hasAccess(item.feature);
    const upgradeTier = item.feature ? getUpgradeTier(item.feature) : null;

    return (
      <Link
        to={isLocked ? '/settings?tab=billing' : item.href}
        onClick={() => setMobileNavOpen(false)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
          isActive && !isLocked
            ? 'bg-primary/10 text-primary'
            : 'text-foreground/70 hover:bg-muted hover:text-foreground',
          isLocked && 'opacity-60'
        )}
      >
        <Icon className={cn('h-5 w-5', isActive && !isLocked && 'text-primary')} />
        <span className="flex-1">{item.label}</span>
        {isLocked && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            {upgradeTier && <span className="capitalize">{upgradeTier}</span>}
          </div>
        )}
      </Link>
    );
  };

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex flex-col h-screen bg-background overflow-hidden">
      <OfflineBanner />
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden layered-bg">
          <Header 
            title={title} 
            subtitle={subtitle} 
            actions={actions} 
            onMenuToggle={() => setMobileNavOpen(true)}
          />
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Navigation Sheet */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              {logoUrl ? (
                <>
                  <img 
                    src={logoUrl} 
                    alt={branding.companyName} 
                    className="h-8 w-8 object-contain rounded-lg" 
                  />
                  <span className="font-display font-bold text-lg truncate">
                    {branding.companyName}
                  </span>
                </>
              ) : tenant?.name ? (
                <span className="font-display font-bold text-lg truncate">
                  {tenant.name}
                </span>
              ) : (
                <Logo size="sm" asLink={false} />
              )}
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col h-[calc(100%-65px)]">
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {filteredMainNav.map((item) => (
                <MobileNavLink key={item.href} item={item} />
              ))}
              
              {filteredBottomNav.length > 0 && (
                <div className="pt-4 mt-4 border-t space-y-1">
                  {filteredBottomNav.map((item) => (
                    <MobileNavLink key={item.href} item={item} />
                  ))}
                </div>
              )}
            </nav>

            {/* User Profile & Sign Out */}
            <div className="p-4 border-t space-y-3">
              <div className="flex items-center gap-3 px-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{role || 'User'}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Beta Feedback FAB */}
      <BetaFeedbackFAB />
    </div>
    </>
  );
}
