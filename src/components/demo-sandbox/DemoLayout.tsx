import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Outlet, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { DemoSandboxProvider, useDemoSandbox } from '@/contexts/DemoSandboxContext';
import { DemoModeBanner } from './DemoModeBanner';
import { DemoChecklist } from './DemoChecklist';
import { DemoChecklistFAB } from './DemoChecklistFAB';
import { DemoTooltipOverlay } from './DemoTooltip';
import { DemoLeadCaptureModal } from './DemoLeadCapture';
import { DemoHeader } from './DemoHeader';
import { DemoTour, StartTourButton } from './DemoTour';
import { DemoDesktopSuggestion } from './DemoDesktopSuggestion';
import { DemoWaitlistPrompt } from './DemoWaitlistPrompt';
import { WaitlistModal } from '@/components/landing/WaitlistModal';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { LayoutDashboard, CalendarDays, Clipboard, Users, Wrench, Receipt, Bot, Inbox } from 'lucide-react';
import { IndustryType } from '@/config/industryTerminology';
import { useTerminologyWithIndustry } from '@/hooks/useTerminology';

export function DemoLayout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [industry, setIndustry] = useState<IndustryType>('general');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const token = searchParams.get('session');
    
    console.log('[DemoLayout] validating session...', { hasToken: !!token });
    
    if (!token) {
      console.log('[DemoLayout] no session token, redirecting to demo-sandbox');
      navigate('/demo-sandbox');
      return;
    }

    // Validate session using SECURITY DEFINER RPC (bypasses RLS for anonymous users)
    const validateSession = async () => {
      try {
        const { data, error } = await supabase.rpc('get_demo_sandbox_session_by_token', {
          p_session_token: token,
        });

        if (error) {
          console.error('[DemoLayout] session validation RPC error:', error);
          navigate('/demo-sandbox');
          return;
        }

        // RPC returns an array; empty = invalid/expired session
        if (!data || data.length === 0) {
          console.log('[DemoLayout] invalid or expired session, redirecting');
          navigate('/demo-sandbox?expired=true');
          return;
        }

        const session = data[0];
        console.log('[DemoLayout] session validated', { industry: session.industry });
        
        setSessionToken(token);
        setIndustry((session.industry as IndustryType) || 'general');
      } catch (err) {
        console.error('[DemoLayout] session validation failed:', err);
        navigate('/demo-sandbox');
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
  }, [searchParams, navigate]);

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!sessionToken) {
    return null;
  }

  return (
    <DemoSandboxProvider sessionToken={sessionToken} industry={industry}>
      <DemoLayoutContent 
        mobileNavOpen={mobileNavOpen} 
        setMobileNavOpen={setMobileNavOpen} 
      />
    </DemoSandboxProvider>
  );
}

// Separate component to use context
function DemoLayoutContent({ 
  mobileNavOpen, 
  setMobileNavOpen 
}: { 
  mobileNavOpen: boolean; 
  setMobileNavOpen: (open: boolean) => void;
}) {
  const { 
    industry, 
    tourStepIndex, 
    setTourStepIndex, 
    tourCompleted, 
    setTourCompleted,
  } = useDemoSandbox();
  
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const location = useLocation();

  const handleTourStepChange = (stepIndex: number) => {
    setTourStepIndex(stepIndex);
  };

  // Auto-start tour on first dashboard visit (desktop only)
  useEffect(() => {
    const tourSeen = sessionStorage.getItem('demo-tour-seen');
    
    // On mobile/tablet, skip tour entirely and mark as seen
    const isMobileView = window.innerWidth < 1024;
    if (isMobileView && !tourSeen) {
      sessionStorage.setItem('demo-tour-seen', 'true');
      setHasSeenTour(true);
      return;
    }
    
    if (!tourSeen && location.pathname.includes('/demo/dashboard')) {
      const timer = setTimeout(() => {
        setIsTourOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (tourSeen) {
      setHasSeenTour(true);
    }
  }, [location.pathname]);

  const handleTourComplete = () => {
    sessionStorage.setItem('demo-tour-seen', 'true');
    setHasSeenTour(true);
  };

  const openWaitlist = () => setWaitlistOpen(true);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden max-w-[100vw]">
      <DemoModeBanner />
      <DemoDesktopSuggestion />
      
      <SidebarProvider defaultOpen>
        <div className="flex min-h-[calc(100vh-44px)] w-full max-w-[100vw] overflow-x-hidden">
          {/* Desktop Sidebar - hidden on mobile */}
          <div className="hidden md:block flex-shrink-0">
            <DemoSidebar />
          </div>
          
          {/* Mobile Navigation Sheet */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-64 p-0">
              <DemoSidebar onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <SidebarInset className="flex-1 min-w-0 overflow-x-hidden">
            <DemoHeader 
              onMenuToggle={() => setMobileNavOpen(true)}
              actions={hasSeenTour ? <StartTourButton onStart={() => setIsTourOpen(true)} /> : undefined}
            />
            <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
              <div className="flex gap-4 md:gap-6 max-w-full">
                {/* Main content area */}
                <div className="flex-1 min-w-0 overflow-x-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={location.pathname}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Outlet />
                    </motion.div>
                  </AnimatePresence>
                </div>
                
                {/* Checklist sidebar - desktop only */}
                <div className="hidden lg:block w-72 flex-shrink-0">
                  <div className="sticky top-6 space-y-4">
                    {!hasSeenTour && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                        <p className="text-sm text-muted-foreground mb-2">New to FieldTek?</p>
                        <StartTourButton onStart={() => setIsTourOpen(true)} />
                      </div>
                    )}
                    <DemoChecklist />
                  </div>
                </div>
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>

      {/* Guided Tour - disable other overlays when active */}
      <DemoTour 
        isOpen={isTourOpen} 
        onClose={() => setIsTourOpen(false)}
        onComplete={handleTourComplete}
        industry={industry}
        initialStepIndex={tourStepIndex}
        onStepChange={handleTourStepChange}
      />

      {/* Tooltip overlay - hidden during tour */}
      {!isTourOpen && <DemoTooltipOverlay />}
      
      {/* Lead capture modal - hidden during tour */}
      {!isTourOpen && <DemoLeadCaptureModal />}
      
      {/* Mobile Checklist FAB - hidden during tour */}
      {!isTourOpen && <DemoChecklistFAB />}
      
      {/* Waitlist Prompt - appears after 3 minutes of engagement */}
      {!isTourOpen && <DemoWaitlistPrompt onJoinWaitlist={openWaitlist} />}
      
      {/* Waitlist Modal */}
      <WaitlistModal open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </div>
  );
}

// Icon map for dynamic rendering
const iconMap = {
  LayoutDashboard,
  CalendarDays,
  Clipboard,
  Users,
  Wrench,
  Receipt,
  Bot,
  Inbox,
};

// Demo-aware sidebar with demo navigation using React Router Links
function DemoSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { demoTenant, industry, sessionToken } = useDemoSandbox();
  const { t } = useTerminologyWithIndustry(industry);
  
  // Get session from context (preferred) or fallback to URL params
  const session = sessionToken || searchParams.get('session');
  
  const navItems = [
    { icon: 'LayoutDashboard', label: 'Dashboard', href: '/demo/dashboard' },
    { icon: 'CalendarDays', label: t('schedule'), href: '/demo/schedule' },
    { icon: 'Clipboard', label: t('jobs'), href: '/demo/jobs' },
    { icon: 'Users', label: t('clients'), href: '/demo/clients' },
    { icon: 'Wrench', label: t('equipment'), href: '/demo/equipment' },
    { icon: 'Receipt', label: 'Invoices', href: '/demo/invoices' },
    { icon: 'Inbox', label: t('serviceRequests'), href: '/demo/requests' },
    { icon: 'Bot', label: 'AI Assistant', href: '/demo/assistant' },
  ];

  return (
    <aside className="flex flex-col h-full w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <span className="font-display font-bold text-lg text-sidebar-foreground truncate">
          {demoTenant.name}
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href === '/demo/dashboard' && location.pathname === '/demo');
          const IconComponent = iconMap[item.icon as keyof typeof iconMap];
          
          // Use React Router Link for SPA navigation (no hard refresh)
          return (
            <Link
              key={item.href}
              to={`${item.href}?session=${session}`}
              onClick={onNavigate}
              data-testid={`demo-nav-${item.href.replace('/demo/', '')}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50'
              }`}
            >
              {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
