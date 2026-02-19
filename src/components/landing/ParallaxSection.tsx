import { useRef, ReactNode, memo } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { usePrefersReducedMotion, useReducedAnimations } from "@/hooks/useReducedAnimations";
import { useIsMobile } from "@/hooks/use-mobile";

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: "up" | "down";
  fadeOut?: boolean;
  scale?: boolean;
}

export const ParallaxSection = memo(function ParallaxSection({ 
  children, 
  className = "",
  speed = 0.3,
  direction = "up",
  fadeOut = false,
  scale = false
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Reduce parallax intensity on mobile for performance, disable if accessibility preference
  const effectiveSpeed = prefersReducedMotion ? 0 : (isMobile ? speed * 0.3 : speed);
  
  const yRange = direction === "up" 
    ? [100 * effectiveSpeed, -100 * effectiveSpeed] 
    : [-100 * effectiveSpeed, 100 * effectiveSpeed];
  
  const y = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : yRange);
  const opacity = useTransform(
    scrollYProgress, 
    [0, 0.2, 0.8, 1], 
    prefersReducedMotion ? [1, 1, 1, 1] : [0, 1, 1, fadeOut ? 0 : 1]
  );
  const scaleValue = useTransform(
    scrollYProgress, 
    [0, 0.5, 1], 
    prefersReducedMotion ? [1, 1, 1] : (scale ? [0.95, 1, 0.95] : [1, 1, 1])
  );

  return (
    <motion.div
      ref={ref}
      style={{ 
        y,
        opacity,
        scale: scaleValue,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

interface ParallaxBackgroundProps {
  className?: string;
  speed?: number;
  children?: ReactNode;
}

export const ParallaxBackground = memo(function ParallaxBackground({ 
  className = "", 
  speed = 0.5, 
  children 
}: ParallaxBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Reduce intensity on mobile for performance
  const effectiveSpeed = prefersReducedMotion ? 0 : (isMobile ? speed * 0.3 : speed);

  const y = useTransform(
    scrollYProgress, 
    [0, 1], 
    [0, -200 * effectiveSpeed]
  );

  return (
    <div ref={ref} className="relative overflow-hidden">
      <motion.div
        style={{ y }}
        className={`absolute inset-0 -z-10 ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
});

interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
}

export const FloatingElement = memo(function FloatingElement({ 
  children, 
  className = "",
  delay = 0,
  duration = 4,
  distance = 10
}: FloatingElementProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.1 });
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  
  // Reduced distance on mobile for performance, static if accessibility preference
  const effectiveDistance = prefersReducedMotion ? 0 : (isMobile ? distance * 0.5 : distance);
  
  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      animate={isInView ? {
        y: [-effectiveDistance, effectiveDistance, -effectiveDistance],
      } : { y: 0 }}
      transition={{
        duration: isMobile ? duration * 0.8 : duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  duration?: number;
}

export const ScrollReveal = memo(function ScrollReveal({ 
  children, 
  className = "",
  direction = "up",
  delay = 0,
  duration = 0.4
}: ScrollRevealProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  // Simplified animation offsets - enabled on all devices unless accessibility preference
  const directionOffset = {
    up: { y: prefersReducedMotion ? 0 : 20, x: 0 },
    down: { y: prefersReducedMotion ? 0 : -20, x: 0 },
    left: { y: 0, x: prefersReducedMotion ? 0 : 20 },
    right: { y: 0, x: prefersReducedMotion ? 0 : -20 }
  };

  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        x: directionOffset[direction].x,
        y: directionOffset[direction].y 
      }}
      whileInView={{ 
        opacity: 1, 
        x: 0, 
        y: 0 
      }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: prefersReducedMotion ? 0.2 : duration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: "easeOut"
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

export default ParallaxSection;
