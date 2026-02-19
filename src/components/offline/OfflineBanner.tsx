import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { motion, AnimatePresence } from 'framer-motion';

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-amber-500 text-white overflow-hidden"
        >
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm font-medium">
                You're offline. Changes will sync when you reconnect.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-7 text-xs"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
