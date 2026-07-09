import { Link, useLocation } from 'react-router-dom';
import { ClipboardList, CalendarDays, MessageSquare, Menu } from 'lucide-react';
import { useFeatureAccess, FeatureKey } from '@/hooks/useFeatureAccess';
import { cn } from '@/lib/utils';

type TabItem = {
  icon: typeof ClipboardList;
  label: string;
  href: string;
  feature?: FeatureKey;
};

// Technician thumb-zone primaries. Secondary destinations (Equipment, Documents,
// Tutorials, Diagnostics, Sign out) live behind "More", which reopens the same
// left Sheet the header hamburger uses — so nothing becomes unreachable.
const TAB_CANDIDATES: TabItem[] = [
  { icon: ClipboardList, label: 'My Jobs', href: '/my-jobs' },
  { icon: CalendarDays, label: 'Calendar', href: '/my-calendar' },
  { icon: MessageSquare, label: 'Sentinel', href: '/assistant', feature: 'ai_assistant' },
];

interface TechnicianBottomNavProps {
  onMore: () => void;
}

/**
 * Mobile-only bottom tab bar for technicians. Mirrors the portal bottom nav
 * (fixed, safe-area-aware, blurred surface) so field users get their primary
 * actions in the thumb zone instead of the top-left hamburger.
 */
export function TechnicianBottomNav({ onMore }: TechnicianBottomNavProps) {
  const location = useLocation();
  const { hasAccess } = useFeatureAccess();

  // Drop feature-locked tabs from the bar (they remain in the "More" sheet with
  // their lock affordance) rather than showing a dead tab in the thumb zone.
  const tabs = TAB_CANDIDATES.filter((tab) => !tab.feature || hasAccess(tab.feature));

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 safe-area-bottom"
      aria-label="Technician navigation"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.href;
          return (
            <Link
              key={tab.href}
              to={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center py-2 pt-2.5 gap-0.5 min-h-[3.25rem] transition-colors duration-200 active:scale-[0.97] touch-native',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-full transition-colors duration-200',
                  isActive && 'bg-primary/10'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onMore}
          aria-label="More navigation"
          className="flex flex-col items-center justify-center py-2 pt-2.5 gap-0.5 min-h-[3.25rem] text-muted-foreground transition-colors duration-200 active:scale-[0.97] touch-native"
        >
          <div className="flex items-center justify-center h-7 w-7 rounded-full">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-medium leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
