import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Wrench, 
  PlusCircle,
  LogOut,
  User,
  Settings
} from 'lucide-react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { usePortalRealtimeNotifications } from '@/hooks/usePortalRealtimeNotifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';

interface PortalLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/portal/jobs', label: 'My Jobs', icon: Briefcase },
  { path: '/portal/invoices', label: 'Invoices', icon: FileText },
  { path: '/portal/equipment', label: 'Equipment', icon: Wrench },
  { path: '/portal/request', label: 'New Request', icon: PlusCircle },
  { path: '/portal/profile', label: 'Profile', icon: User },
];

export function PortalLayout({ children }: PortalLayoutProps) {
  const { client, signOut } = usePortalAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Enable real-time notifications for portal users
  usePortalRealtimeNotifications();

  const handleSignOut = async () => {
    await signOut();
    navigate('/portal/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background relative">
      {/* Subtle floating orbs in background */}
      <FloatingOrbs intensity="subtle" />
      
      {/* Header with Premium Glassmorphism */}
      <header className="sticky top-0 z-50 glass-navbar shadow-sm">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Company Name with hover glow */}
            <div className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)]">
                <span className="text-primary-foreground font-bold text-sm">
                  {client?.tenant_name?.[0] || 'P'}
                </span>
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{client?.tenant_name || 'Customer Portal'}</h1>
                <p className="text-xs text-muted-foreground">Customer Portal</p>
              </div>
            </div>

            {/* Navigation - Desktop with glass pills */}
            <nav className="hidden md:flex items-center gap-1 bg-muted/40 backdrop-blur-md rounded-xl p-1.5 border border-border/30 shadow-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] touch-native ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-[0_2px_10px_-3px_hsl(var(--primary)/0.4)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/70'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu with avatar ring */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 touch-native active:scale-[0.97]">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {client?.name ? getInitials(client.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium">{client?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 backdrop-blur-xl bg-popover/95 border-border/50">
                <DropdownMenuItem className="flex items-center gap-2 cursor-default">
                  <User className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{client?.name}</span>
                    <span className="text-xs text-muted-foreground">{client?.email}</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/portal/profile')} className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 safe-area-bottom">
        <div className="grid grid-cols-5 gap-0">
          {navItems
            .filter(item => item.path !== '/portal/profile')
            .map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isNewRequest = item.path === '/portal/request';
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center py-2 pt-2.5 gap-0.5 transition-colors duration-200 active:scale-[0.95] touch-native ${
                    isNewRequest && !isActive
                      ? 'text-primary'
                      : isActive
                        ? 'text-primary'
                        : 'text-muted-foreground'
                  }`}
                >
                  <div className={`flex items-center justify-center h-7 w-7 rounded-full transition-all duration-200 ${
                    isNewRequest && !isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : isActive
                        ? 'bg-primary/10'
                        : ''
                  }`}>
                    <Icon className={`${isNewRequest ? 'h-4 w-4' : 'h-5 w-5'}`} />
                  </div>
                  <span className="text-[10px] font-medium leading-tight">{item.label.replace('New ', '')}</span>
                </Link>
              );
            })}
        </div>
      </nav>

      {/* Main Content with page entrance animation */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 relative z-10 page-enter">
        {children}
      </main>
    </div>
    </>
  );
}
