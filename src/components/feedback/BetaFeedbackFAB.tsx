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

  // Sentinel (/assistant) is the flagship surface and owns the bottom of the
  // screen with its composer; keep it free of floating chrome. Feedback stays
  // one tap away on every other page.
  const isAssistant = location.pathname === '/assistant';

  // Only show for authenticated users within a tenant
  if (!user || !tenant || isAssistant) {
    return null;
  }

  // Technicians have a fixed mobile bottom nav; lift the FAB above it on
  // mobile so the two don't overlap.
  const hasTechBottomNav = role === 'technician';

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
            hasTechBottomNav
              ? "bottom-[calc(1.5rem+env(safe-area-inset-bottom))] max-md:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
          )}
        >
          <Button
            onClick={() => setOpen(true)}
            size="lg"
            aria-label="Send beta feedback"
            title="Beta Feedback"
            className="h-14 gap-2 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <MessageSquarePlus className="h-5 w-5" />
            <span className="hidden sm:inline">Beta Feedback</span>
          </Button>
        </motion.div>
      </AnimatePresence>

      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}