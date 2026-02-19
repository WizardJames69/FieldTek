import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

const STORAGE_KEY = 'demo-desktop-suggestion-dismissed';

export function DemoDesktopSuggestion() {
  const isMobile = useIsMobile();
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash
  const [isVisible, setIsVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setIsDismissed(dismissed);

    // Auto-hide after 15 seconds
    if (!dismissed) {
      const timer = setTimeout(() => setIsVisible(false), 15000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsDismissed(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Link copied! Open on desktop to continue.');
      setTimeout(() => {
        setCopied(false);
        handleDismiss();
      }, 1500);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  // Don't render on desktop or if dismissed
  if (!isMobile || isDismissed || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-blue-50 dark:bg-blue-950/50 border-b border-blue-100 dark:border-blue-900"
      >
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                For the full experience with dashboards & scheduling, try this demo on desktop.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-8 px-3 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  Continue on Mobile
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8 px-3 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
