import { useState, useEffect } from "react";
import { X, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface LaunchBannerProps {
  onJoinWaitlist: () => void;
}

const BANNER_DISMISSED_KEY = "fieldtek_launch_banner_dismissed";
const BANNER_HEIGHT = 44;

export function LaunchBanner({ onJoinWaitlist }: LaunchBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    const isVisible = dismissed !== "true";
    setIsDismissed(!isVisible);
    
    // Set CSS variable for navbar coordination
    document.documentElement.style.setProperty(
      '--launch-banner-height', 
      isVisible ? `${BANNER_HEIGHT}px` : '0px'
    );
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(BANNER_DISMISSED_KEY, "true");
    // Update CSS variable when dismissed
    document.documentElement.style.setProperty('--launch-banner-height', '0px');
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: BANNER_HEIGHT, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-primary text-primary-foreground overflow-hidden"
          style={{ height: BANNER_HEIGHT }}
        >
          <div className="container mx-auto px-4 h-full">
            <div className="flex items-center justify-center gap-2 sm:gap-4 h-full text-sm relative">
              <Rocket className="h-4 w-4 shrink-0 hidden sm:block" />
              <span className="text-center">
                <span className="font-semibold">Launching Soon</span>
                <span className="hidden sm:inline"> — </span>
                <br className="sm:hidden" />
                <button 
                  onClick={onJoinWaitlist}
                  className="underline underline-offset-2 hover:no-underline font-medium"
                >
                  Join the waitlist for early access
                </button>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 absolute right-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
