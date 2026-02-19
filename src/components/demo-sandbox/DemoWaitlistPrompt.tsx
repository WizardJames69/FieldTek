import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoSandbox } from "@/contexts/DemoSandboxContext";
import { trackEvent } from "@/lib/analytics";

interface DemoWaitlistPromptProps {
  onJoinWaitlist: () => void;
}

const PROMPT_DELAY_MS = 3 * 60 * 1000; // 3 minutes

export function DemoWaitlistPrompt({ onJoinWaitlist }: DemoWaitlistPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const { checklistProgress, featuresExplored } = useDemoSandbox();

  useEffect(() => {
    // Check if already dismissed this session
    const alreadyDismissed = sessionStorage.getItem("demo-waitlist-prompt-dismissed");
    if (alreadyDismissed) {
      setIsDismissed(true);
      return;
    }

    // Start timer when component mounts
    timerRef.current = window.setTimeout(() => {
      // Only show if user has explored at least 2 features (engaged user)
      if (featuresExplored.length >= 2) {
        setIsVisible(true);
        trackEvent("demo_waitlist_prompt_shown", {
          features_explored: featuresExplored.length,
          checklist_progress: checklistProgress,
        });
      }
    }, PROMPT_DELAY_MS);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [featuresExplored.length, checklistProgress]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem("demo-waitlist-prompt-dismissed", "true");
    trackEvent("demo_waitlist_prompt_dismissed");
  };

  const handleJoinWaitlist = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem("demo-waitlist-prompt-dismissed", "true");
    trackEvent("demo_waitlist_prompt_converted", {
      features_explored: featuresExplored.length,
    });
    onJoinWaitlist();
  };

  if (isDismissed) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Loving the demo?
                </span>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                You've explored {featuresExplored.length} features! Join the waitlist to be first in line when we launch.
              </p>

              {/* Progress indicator */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Demo progress</span>
                  <span className="font-medium text-foreground">{Math.round(checklistProgress)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${checklistProgress}%` }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>

              {/* CTAs */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDismiss}
                >
                  Keep exploring
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleJoinWaitlist}
                >
                  Join Waitlist
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
