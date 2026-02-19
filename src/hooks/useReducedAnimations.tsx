import { useState, useEffect } from "react";

/**
 * Hook to detect if reduced animations should be used.
 * Returns true on mobile devices OR when user prefers reduced motion.
 */
export function useReducedAnimations() {
  const [shouldReduce, setShouldReduce] = useState(false);

  useEffect(() => {
    // Only check for prefers-reduced-motion accessibility setting
    // Animations are now enabled on mobile/tablet for visual consistency
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    
    const updateState = () => {
      setShouldReduce(motionQuery.matches);
    };

    updateState();

    motionQuery.addEventListener("change", updateState);
    
    return () => {
      motionQuery.removeEventListener("change", updateState);
    };
  }, []);

  return shouldReduce;
}

/**
 * Hook to detect if user prefers reduced motion (accessibility setting)
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Simplified motion variants for reduced animation mode
 */
export const reducedMotionVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 }
  }
};

/**
 * Standard motion variants with reduced option
 */
export function getMotionVariants(reducedMotion: boolean) {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.15 } }
    };
  }
  return {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };
}
