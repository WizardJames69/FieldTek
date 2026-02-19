import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackDialog } from './FeedbackDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { cn } from '@/lib/utils';

export function BetaFeedbackFAB() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();

  // Only show for authenticated users within a tenant
  if (!user || !tenant) {
    return null;
  }

  // Move FAB higher on pages with bottom input bars (e.g. /assistant)
  const hasBottomInput = location.pathname === '/assistant';

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1 }}
          className={cn("fixed right-6 z-50", hasBottomInput ? "bottom-32" : "bottom-6")}
        >
          <Button
            onClick={() => setOpen(true)}
            size="lg"
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