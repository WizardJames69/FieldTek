import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

interface ExitIntentPopupProps {
  onJoinWaitlist: () => void;
}

export function ExitIntentPopup({ onJoinWaitlist }: ExitIntentPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    // Only trigger when mouse leaves through the top of the viewport
    if (e.clientY <= 0 && !hasTriggered) {
      // Check if already shown this session
      const alreadyShown = sessionStorage.getItem("exit-intent-shown");
      if (alreadyShown) return;
      
      setIsVisible(true);
      setHasTriggered(true);
      sessionStorage.setItem("exit-intent-shown", "true");
      trackEvent("exit_intent_shown");
    }
  }, [hasTriggered]);

  useEffect(() => {
    // Only add listener on desktop (no exit intent on mobile)
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) return;

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [handleMouseLeave]);

  const handleClose = () => {
    setIsVisible(false);
    trackEvent("exit_intent_dismissed");
  };

  const handleJoinWaitlist = () => {
    setIsVisible(false);
    trackEvent("exit_intent_converted");
    onJoinWaitlist();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          
          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
                aria-label="Close popup"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Header with gradient */}
              <div className="bg-gradient-to-br from-primary to-primary/80 px-6 py-8 text-primary-foreground">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary-foreground/20 rounded-full">
                    <Gift className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium uppercase tracking-wide opacity-90">
                    Exclusive Offer
                  </span>
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Wait! Don't miss early access pricing.
                </h2>
                <p className="text-primary-foreground/85 text-sm">
                  Join the waitlist now and lock in founding member rates before we launch.
                </p>
              </div>

              {/* Benefits */}
              <div className="px-6 py-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <p className="text-sm text-foreground">
                    <strong>30% lifetime discount</strong> for founding members
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <p className="text-sm text-foreground">
                    <strong>Priority onboarding</strong> with dedicated support
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <p className="text-sm text-foreground">
                    <strong>Shape the product</strong> with direct feedback access
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6 space-y-3">
                <Button 
                  onClick={handleJoinWaitlist} 
                  className="w-full py-6 text-base font-semibold"
                  size="lg"
                >
                  Claim My Early Access Spot
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <button
                  onClick={handleClose}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  No thanks, I'll pay full price later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
