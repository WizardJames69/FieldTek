import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefersReducedMotion } from "@/hooks/useReducedAnimations";

interface BetaFABProps {
  onApply: () => void;
}

export function BetaFAB({ onApply }: BetaFABProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isBetaSectionVisible, setIsBetaSectionVisible] = useState(false);
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Delay entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Hide when beta section is in view
  useEffect(() => {
    const betaSection = document.getElementById("beta-program");
    if (!betaSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBetaSectionVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(betaSection);
    return () => observer.disconnect();
  }, []);

  const shouldShow = isVisible && !isBetaSectionVisible;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20, y: 20 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-20 left-4 sm:left-6 z-50 overflow-visible"
        >
          <div className="relative overflow-visible">
            <Button
              onClick={onApply}
              size={isMobile ? "icon" : "default"}
              className={`
                overflow-visible shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30
                transition-shadow duration-300 touch-target
                ${isMobile ? "h-14 w-14 rounded-full" : "rounded-full px-5 py-3 h-auto"}
                ${!prefersReducedMotion ? "animate-pulse-subtle" : ""}
              `}
              aria-label="Apply for Beta Program - 50% off first year"
            >
              <FlaskConical className={isMobile ? "h-6 w-6" : "h-5 w-5 mr-2"} />
              {!isMobile && <span className="font-medium">Join Beta</span>}
            </Button>
            
            {/* 50% Off Badge - positioned outside button to avoid clipping */}
            <span className="absolute -top-2 -right-1 bg-accent text-accent-foreground text-xs font-bold px-1.5 py-0.5 rounded-full shadow-md whitespace-nowrap pointer-events-none">
              50%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
