import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackDialog } from './FeedbackDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useUserRole } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

export function BetaFeedbackFAB() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { role } = useUserRole();
  const location = useLocation();

  // Only show for authenticated users within a tenant
  if (!user || !tenant) {
    return null;
  }

  // Move FAB higher on pages with bottom input bars (e.g. /assistant)
  const hasBottomInput = location.pathname === '/assistant';
  // Technicians have a fixed mobile bottom nav everywhere except /assistant;
  // lift the FAB above it on mobile so the two don't overlap.
  const hasTechBottomNav = role === 'technician' && !hasBottomInput;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1 }}
          className={cn(
            "fixed right-6 z-50",
            hasBottomInput
              ? "bottom-[calc(8rem+env(safe-area-inset-bottom))]"
              : hasTechBottomNav
                ? "bottom-[calc(1.5rem+env(safe-area-inset-bottom))] max-md:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
                : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
          )}
        >
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            aria-label="Send beta feedback"
            title="Beta Feedback"
            className={cn(
              "rounded-full shadow-lg hover:shadow-xl transition-shadow",
              // Compact icon-only on /assistant so the FAB never covers the
              // chat composer's controls.
              hasBottomInput ? "h-12 w-12 p-0" : "h-14 gap-2"
            )}
          >
            <MessageSquarePlus className="h-5 w-5" />
            {!hasBottomInput && <span className="hidden sm:inline">Beta Feedback</span>}
          </Button>
        </motion.div>
      </AnimatePresence>

      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}